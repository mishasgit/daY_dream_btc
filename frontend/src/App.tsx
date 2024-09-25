import React, { useState, useEffect } from "react";
import axios from "axios";
import Notification from "./components/Notification";

const AUTH_PASSWORD = process.env.REACT_APP_AUTH_PASSWORD as string;

if (!AUTH_PASSWORD) {
  console.error("REACT_APP_AUTH_PASSWORD не установлен в .env файле");
}

function setAuthHeader(headers: any): any {
  if (AUTH_PASSWORD) {
    console.log("AUTH_PASSWORD установлен:", AUTH_PASSWORD);
    headers["Authorization"] = AUTH_PASSWORD;
  }
  return headers;
}

interface Trade {
  _id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  timestamp: string;
  totalUSDT: number;
  quantityUSDT: number;
}

interface Balance {
  asset: string;
  free: string;
  locked: string;
}

interface PendingOrder {
  symbol: string;
  orderId: number;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  type: string;
  side: string;
  totalUSDT: number;
}

const App: React.FC = () => {
  const [symbol, setSymbol] = useState<string>("BTCUSDT");
  const [orderType, setOrderType] = useState<"BUY" | "SELL">("BUY");
  const [desiredPrice, setDesiredPrice] = useState<string>("");
  const [usdtAmount, setUsdtAmount] = useState<string>("");
  const [estimatedBtcAmount, setEstimatedBtcAmount] = useState<string>("");
  const [currentPrice, setCurrentPrice] = useState<string>("");
  const [balances, setBalances] = useState<Balance[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [showTrades, setShowTrades] = useState<boolean>(false);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [showPendingOrders, setShowPendingOrders] = useState<boolean>(false);
  const [autoSellEnabled, setAutoSellEnabled] = useState<boolean>(false);
  const [desiredProfit, setDesiredProfit] = useState<string>("");
  const [targetSellPrice, setTargetSellPrice] = useState<string>("");
  const [maxUsdtAmount, setMaxUsdtAmount] = useState<number>(0);
  const [btcAmount, setBtcAmount] = useState<string>("");
  const [maxBtcAmount, setMaxBtcAmount] = useState<number>(0);
  const [orderToDelete, setOrderToDelete] = useState<{
    symbol: string;
    orderId: number;
  } | null>(null);
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [notifications, setNotifications] = useState<string[]>([]);

  const addNotification = (message: string) => {
    setNotifications((prev) => [...prev, message]);
  };

  const removeNotification = () => {
    setNotifications((prev) => prev.slice(1));
  };

  const fetchBalance = async () => {
    try {
      const response = await axios.get("/api/balance", {
        headers: setAuthHeader({}),
      });
      setBalances(response.data);
      const usdtBalance = response.data.find(
        (balance: Balance) => balance.asset === "USDT"
      );
      const btcBalance = response.data.find(
        (balance: Balance) => balance.asset === "BTC"
      );
      if (usdtBalance) {
        setMaxUsdtAmount(parseFloat(usdtBalance.free));
      }
      if (btcBalance) {
        setMaxBtcAmount(parseFloat(btcBalance.free));
      }
    } catch (error) {
      console.error("Ошибка при получении баланса:", error);
    }
  };

  const fetchPendingOrders = async () => {
    try {
      const response = await axios.get("/api/pending-orders", {
        headers: setAuthHeader({}),
      });
      setPendingOrders(response.data);
    } catch (error) {
      console.error("Ошибка при получении отложенных ордеров:", error);
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchPendingOrders();

    const fetchPrice = async () => {
      try {
        const response = await axios.get(`/api/price?symbol=${symbol}`, {
          headers: setAuthHeader({}),
        });
        setCurrentPrice(response.data.price);
        console.log(`Текущая цена ${symbol}: ${response.data.price} USDT`);
      } catch (error) {
        console.error("Ошибка при получении цены:", error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 5000);

    const fetchTrades = async () => {
      try {
        const response = await axios.get("/api/trades", {
          headers: setAuthHeader({}),
        });
        setTrades(response.data);
      } catch (error) {
        console.error("Ошибка при получении истории сделок:", error);
      }
    };

    fetchTrades();
    const tradesInterval = setInterval(fetchTrades, 10000);

    const pendingOrdersInterval = setInterval(fetchPendingOrders, 30000);

    return () => {
      clearInterval(interval);
      clearInterval(tradesInterval);
      clearInterval(pendingOrdersInterval);
    };
  }, [symbol]);

  useEffect(() => {
    if (orderType === "BUY") {
      if (desiredPrice && usdtAmount) {
        const estimated = parseFloat(usdtAmount) / parseFloat(desiredPrice);
        setEstimatedBtcAmount(estimated.toFixed(8));
        setSliderValue((parseFloat(usdtAmount) / maxUsdtAmount) * 100);
      } else {
        setEstimatedBtcAmount("");
        setSliderValue(0);
      }
    } else {
      setEstimatedBtcAmount("");
      setSliderValue((parseFloat(btcAmount) / maxBtcAmount) * 100);
    }
  }, [
    orderType,
    desiredPrice,
    usdtAmount,
    btcAmount,
    maxUsdtAmount,
    maxBtcAmount,
  ]);

  useEffect(() => {
    if (desiredPrice && usdtAmount && desiredProfit) {
      const buyPrice = parseFloat(desiredPrice);
      const buyAmount = parseFloat(usdtAmount);
      const profit = parseFloat(desiredProfit);
      const buyQuantity = buyAmount / buyPrice;
      const targetTotal = buyAmount + profit;
      const calculatedTargetPrice = targetTotal / buyQuantity;
      setTargetSellPrice(calculatedTargetPrice.toFixed(2));
    } else {
      setTargetSellPrice("");
    }
  }, [desiredPrice, usdtAmount, desiredProfit]);

  const handleAmountChange = (value: string) => {
    if (orderType === "BUY") {
      setUsdtAmount(value);
      setSliderValue((parseFloat(value) / maxUsdtAmount) * 100);
    } else {
      setBtcAmount(value);
      setSliderValue((parseFloat(value) / maxBtcAmount) * 100);
    }
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    setSliderValue(value);
    const amount =
      orderType === "BUY"
        ? ((value / 100) * maxUsdtAmount).toFixed(2)
        : ((value / 100) * maxBtcAmount).toFixed(8);
    handleAmountChange(amount);
  };

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const quantity = orderType === "BUY" ? estimatedBtcAmount : btcAmount;
      const orderData = {
        symbol,
        side: orderType,
        quantity,
        price: desiredPrice,
        autoSell: autoSellEnabled,
        targetPrice: targetSellPrice,
      };
      console.log("Отправка ордера:", orderData);

      const response = await axios.post("/api/order", orderData, {
        headers: setAuthHeader({
          "Content-Type": "application/json",
        }),
      });
      console.log("Ответ на создание ордера:", response.data);
      addNotification(
        `Ордер ${orderType} на ${quantity} ${symbol.replace(
          "USDT",
          ""
        )} по цене ${desiredPrice} USDT размещен успешно`
      );
      fetchBalance();

      if (orderType === "BUY" && autoSellEnabled && desiredProfit) {
        await createAutoSellOrder(response.data);
      }

      // Убираем вызов resetForm() о��сюда
    } catch (error: any) {
      console.error("Ошибка при создании ордера:", error);
      alert(
        `Ошибка выполнения заказа: ${
          error.response?.data?.msg || error.message
        }`
      );
    }
  };

  const createAutoSellOrder = async (buyOrder: any) => {
    if (!buyOrder || !desiredProfit) {
      console.error("Недостаточно данных для создания автоордера на продажу");
      return;
    }

    const buyPrice = parseFloat(buyOrder.price);
    const buyQuantity = parseFloat(buyOrder.executedQty);

    if (isNaN(buyPrice) || isNaN(buyQuantity) || buyQuantity === 0) {
      console.error("Некорректные данные ордера на покупку:", {
        buyPrice,
        buyQuantity,
      });
      return;
    }

    const totalCost = buyPrice * buyQuantity;
    const targetTotal = totalCost + parseFloat(desiredProfit);
    const targetPrice = targetTotal / buyQuantity;

    const autoSellOrderData = {
      symbol,
      side: "SELL",
      quantity: buyQuantity.toFixed(8),
      price: targetPrice.toFixed(2),
    };

    console.log("Отправка автоордера на продажу:", autoSellOrderData);

    try {
      const response = await axios.post("/api/order", autoSellOrderData, {
        headers: setAuthHeader({
          "Content-Type": "application/json",
        }),
      });
      console.log("Ответ на создание автоордера на продажу:", response.data);
      addNotification(
        `Автоордер на продажу ${buyQuantity.toFixed(8)} ${symbol.replace(
          "USDT",
          ""
        )} по цене ${targetPrice.toFixed(2)} USDT размещен успешно`
      );
      fetchBalance();

      // Можно добавить сброс полей здесь, если это необходимо
      // resetForm();
    } catch (error: any) {
      console.error("Ошибка при создании автоордера на продажу:", error);
      alert(
        `Ошибка создания автоматического ордера на продажу: ${
          error.response?.data?.msg || error.message
        }`
      );
    }
  };

  const resetForm = () => {
    setDesiredPrice("");
    setUsdtAmount("");
    setBtcAmount("");
    setEstimatedBtcAmount("");
    setAutoSellEnabled(false);
    setDesiredProfit("");
    setTargetSellPrice("");
    setSliderValue(0);
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;

    try {
      await axios.delete(
        `/api/order/${orderToDelete.symbol}/${orderToDelete.orderId}`,
        {
          headers: setAuthHeader({}),
        }
      );
      // После успешного удаления обновляем список отложенных ордеров
      fetchPendingOrders();
      setOrderToDelete(null); // Закрваем модальное окно
    } catch (error) {
      console.error("Ошибка при удалении ордера:", error);
      alert("Не удалось удалить ордер. Пожалуйста, попробуйте еще раз.");
    }
  };

  const handleTogglePendingOrders = async () => {
    setShowPendingOrders(!showPendingOrders);
    if (!showPendingOrders) {
      // Если мы открываем вкладку, обновляем список ордеров
      await fetchPendingOrders();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-gray-100 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
        Торговый бот Binance
      </h1>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Баланс аккаунта</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 border-b">Актив</th>
                  <th className="py-2 px-4 border-b">Доступно</th>
                  <th className="py-2 px-4 border-b">Заблокировано</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((balance) => (
                  <tr key={balance.asset}>
                    <td className="py-2 px-4 border-b">{balance.asset}</td>
                    <td className="py-2 px-4 border-b">
                      {parseFloat(balance.free).toFixed(8)}
                    </td>
                    <td className="py-2 px-4 border-b">
                      {parseFloat(balance.locked).toFixed(8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <form onSubmit={handleOrder} className="space-y-4">
            <div>
              <label
                htmlFor="orderType"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Тип ордера:
              </label>
              <select
                id="orderType"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as "BUY" | "SELL")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="BUY">Купить</option>
                <option value="SELL">Продать</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Текущая цена:
              </label>
              <div className="w-full px-3 py-2 bg-gray-200 rounded-md text-gray-800 font-semibold">
                {currentPrice ? `${currentPrice} USDT` : "Загрузка..."}
              </div>
            </div>
            <div>
              <label
                htmlFor="desiredPrice"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Желаемая цена (USDT):
              </label>
              <input
                id="desiredPrice"
                type="number"
                value={desiredPrice}
                onChange={(e) => setDesiredPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {orderType === "BUY" ? "Сумма USDT:" : "Количество BTC:"}
              </label>
              <input
                id="amount"
                type="number"
                value={orderType === "BUY" ? usdtAmount : btcAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                max={orderType === "BUY" ? maxUsdtAmount : maxBtcAmount}
                step={orderType === "BUY" ? "0.01" : "0.00000001"}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="range"
                min="0"
                max="100"
                value={sliderValue}
                onChange={handleSliderChange}
                className="w-full mt-2"
              />
              <div className="text-sm text-gray-600 mt-1">
                Максимально доступно:{" "}
                {orderType === "BUY"
                  ? `${maxUsdtAmount.toFixed(2)} USDT`
                  : `${maxBtcAmount.toFixed(8)} BTC`}
              </div>
            </div>
            {orderType === "BUY" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Предполагаемое количество BTC:
                </label>
                <div className="w-full px-3 py-2 bg-gray-200 rounded-md text-gray-800 font-semibold">
                  {estimatedBtcAmount || "Введите цену и сумму USDT"}
                </div>
              </div>
            )}
            {orderType === "BUY" && (
              <div className="mt-4">
                <h2 className="text-xl font-semibold mb-2">
                  Автоматический ордер на продажу
                </h2>
                <div className="mb-2">
                  <button
                    type="button" // Добавляем этот атрибут, чтобы кнопка не отправляла форму
                    onClick={() => setAutoSellEnabled(!autoSellEnabled)}
                    className={`w-full py-2 px-4 rounded-md text-white font-medium transition-all duration-300 ${
                      autoSellEnabled
                        ? "bg-gradient-to-r from-pink-500 to-green-500 hover:from-pink-600 hover:to-green-600"
                        : "bg-gradient-to-r from-green-500 to-pink-500 hover:from-green-600 hover:to-pink-600"
                    }`}
                  >
                    {autoSellEnabled ? "Отключить автопродажу" : "Включить автопродажу"}
                  </button>
                </div>
                {autoSellEnabled && (
                  <>
                    <input
                      type="number"
                      value={desiredProfit}
                      onChange={(e) => setDesiredProfit(e.target.value)}
                      placeholder="Желаемая прибыль (USDT)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
                    />
                    {targetSellPrice && (
                      <div className="text-sm text-gray-600 mt-2">
                        Целевая цена продажи: {targetSellPrice} USDT
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            >
              {orderType === "BUY" ? "Купить BTC" : "Продать BTC"}
            </button>
          </form>
        </div>

        <div className="mt-6">
          <div
            onClick={handleTogglePendingOrders}
            className="flex items-center justify-between cursor-pointer bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 w-full"
          >
            <span>Отложенные ордеры</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                showPendingOrders ? "transform rotate-90" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>

          {showPendingOrders && (
            <div className="mt-4">
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 border-b">Символ</th>
                      <th className="py-2 px-4 border-b">ID ордера</th>
                      <th className="py-2 px-4 border-b">Цена</th>
                      <th className="py-2 px-4 border-b">Количество</th>
                      <th className="py-2 px-4 border-b">Выполнено</th>
                      <th className="py-2 px-4 border-b">Статус</th>
                      <th className="py-2 px-4 border-b">Тип</th>
                      <th className="py-2 px-4 border-b">Сторона</th>
                      <th className="py-2 px-4 border-b">Сумма USDT</th>
                      <th className="py-2 px-4 border-b">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrders.map((order) => (
                      <tr key={order.orderId}>
                        <td className="py-2 px-4 border-b">{order.symbol}</td>
                        <td className="py-2 px-4 border-b">{order.orderId}</td>
                        <td className="py-2 px-4 border-b">{order.price}</td>
                        <td className="py-2 px-4 border-b">{order.origQty}</td>
                        <td className="py-2 px-4 border-b">
                          {order.executedQty}
                        </td>
                        <td className="py-2 px-4 border-b">{order.status}</td>
                        <td className="py-2 px-4 border-b">{order.type}</td>
                        <td className="py-2 px-4 border-b">{order.side}</td>
                        <td className="py-2 px-4 border-b">
                          {order.totalUSDT.toFixed(2)}
                        </td>
                        <td className="py-2 px-4 border-b">
                          <button
                            onClick={() =>
                              setOrderToDelete({
                                symbol: order.symbol,
                                orderId: order.orderId,
                              })
                            }
                            className="text-red-500 hover:text-red-700"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6">
          <div
            onClick={() => setShowTrades(!showTrades)}
            className="flex items-center justify-between cursor-pointer bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 w-full"
          >
            <span>История сделок</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                showTrades ? "transform rotate-90" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>

          {showTrades && (
            <div className="mt-4">
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 border-b">Символ</th>
                      <th className="py-2 px-4 border-b">Сторона</th>
                      <th className="py-2 px-4 border-b">Количество BTC</th>
                      <th className="py-2 px-4 border-b">Количество USDT</th>
                      <th className="py-2 px-4 border-b">Цена</th>
                      <th className="py-2 px-4 border-b">Сумма USDT</th>
                      <th className="py-2 px-4 border-b">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade._id}>
                        <td className="py-2 px-4 border-b">{trade.symbol}</td>
                        <td className="py-2 px-4 border-b">{trade.side}</td>
                        <td className="py-2 px-4 border-b">
                          {trade.quantity?.toFixed(8) || "N/A"}
                        </td>
                        <td className="py-2 px-4 border-b">
                          {trade.quantityUSDT?.toFixed(2) || "N/A"}
                        </td>
                        <td className="py-2 px-4 border-b">
                          {trade.price?.toFixed(2) || "N/A"}
                        </td>
                        <td className="py-2 px-4 border-b">
                          {trade.totalUSDT?.toFixed(2) || "N/A"}
                        </td>
                        <td className="py-2 px-4 border-b">
                          {trade.timestamp
                            ? new Date(trade.timestamp).toLocaleString()
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно подтверждения удален��я */}
      {orderToDelete && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full"
          id="my-modal"
        >
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Подтверждение удаления
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Вы уверены, что хотите удалить ордер {orderToDelete.orderId}{" "}
                  для {orderToDelete.symbol}?
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  id="ok-btn"
                  className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-24 mr-2 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                  onClick={handleDeleteOrder}
                >
                  Удалить
                </button>
                <button
                  id="cancel-btn"
                  className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-24 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  onClick={() => setOrderToDelete(null)}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notifications.map((notification, index) => (
        <Notification
          key={index}
          message={notification}
          onClose={removeNotification}
        />
      ))}
    </div>
  );
};

export default App;
