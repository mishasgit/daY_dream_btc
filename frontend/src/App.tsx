import React, { useState, useEffect, useRef } from "react";
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
  symbol: string;
  id: number;
  orderId: number;
  price: number;
  quantity: number;
  quoteQuantity: number;
  commission: number;
  commissionAsset: string;
  time: string;
  isBuyer: boolean;
  isMaker: boolean;
  isBestMatch: boolean;
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
  const [priceChange, setPriceChange] = useState<"up" | "down" | "same">("same");
  const prevPriceRef = useRef<string>("");
  const lastChangeRef = useRef<"up" | "down">("up");
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
  const [showMarketPriceModal, setShowMarketPriceModal] = useState(false);
  const [marketPriceUsdtAmount, setMarketPriceUsdtAmount] = useState('');
  const [marketPriceLimit, setMarketPriceLimit] = useState('');
  const [marketPriceAutoSell, setMarketPriceAutoSell] = useState(false);
  const [marketPriceTargetPrice, setMarketPriceTargetPrice] = useState('');
  const [autoSellPriceWarning, setAutoSellPriceWarning] = useState<string | null>(null);
  const [sortOrderAsc, setSortOrderAsc] = useState<boolean>(false);
  const [isMarketPrice, setIsMarketPrice] = useState<boolean>(false);
  const [priceLimit, setPriceLimit] = useState<string>('');
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [stopLimitPrice, setStopLimitPrice] = useState('');
  const [stopLossAmount, setStopLossAmount] = useState('');
  const [stopLimitAmount, setStopLimitAmount] = useState('');

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
        const newPrice = response.data.price;
        setCurrentPrice(newPrice);
        
        // Сравниваем новую цену с предыдущей
        if (prevPriceRef.current) {
          if (parseFloat(newPrice) > parseFloat(prevPriceRef.current)) {
            setPriceChange("up");
            lastChangeRef.current = "up";
          } else if (parseFloat(newPrice) < parseFloat(prevPriceRef.current)) {
            setPriceChange("down");
            lastChangeRef.current = "down";
          } else {
            setPriceChange("same");
          }
        }
        
        // Сохраняем текущую цену для следующего авнения
        prevPriceRef.current = newPrice;
        
        console.log(`Текущая цена ${symbol}: ${newPrice} USDT`);
      } catch (error) {
        console.error("Ошибка при получении цены:", error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 5000);

    const fetchTrades = async (period: 'week' | 'month' | '5days' = '5days') => {
      try {
        const response = await axios.get(`/api/trades?period=${period}`, {
          headers: setAuthHeader({}),
        });
        setTrades(response.data);
      } catch (error) {
        console.error('Ошибка при получении истории сделок:', error);
      }
    };

    fetchTrades();
    const tradesInterval = setInterval(() => fetchTrades(), 10000);

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

  const validateStopLossInputs = () => {
    if (stopLossEnabled) {
      const stopLossPriceValue = parseFloat(stopLossPrice);
      const stopLimitPriceValue = parseFloat(stopLimitPrice);
      const currentPriceValue = parseFloat(currentPrice);

      if (!isNaN(stopLossPriceValue) || !isNaN(stopLimitPriceValue)) {
        return "Введите корректные значения для стоп-лосс";
      }

      if (stopLossPriceValue >= currentPriceValue) {
        return "Цена соп-лосс должна быть ниже текущей цены";
      }

      if (stopLimitPriceValue >= stopLossPriceValue) {
        return "Лимитная цена стоп-лосс должна быть ниже цены стоп-лосс";
      }
    }
    return null;
  };

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const stopLossError = validateStopLossInputs();
    if (stopLossError) {
      alert(stopLossError);
      return;
    }

    try {
      const quantity = orderType === "BUY" ? estimatedBtcAmount : btcAmount;
      const orderData = {
        symbol,
        side: orderType,
        quantity,
        price: isMarketPrice ? undefined : desiredPrice,
        autoSell: autoSellEnabled,
        targetPrice: Number(targetSellPrice),
        stopLossAmount: stopLossEnabled ? Number(stopLossAmount) : undefined,
        stopLimitAmount: stopLossEnabled ? Number(stopLimitAmount) : undefined,
        isMarketPrice,
      };

      let response;
      if (isMarketPrice) {
        console.log(`stopLossEnabled: ${stopLossEnabled} stopLossPrice: ${stopLossPrice} stopLimitPrice: ${stopLimitPrice} stopLossAmount: ${stopLossAmount} stopLimitAmount: ${stopLimitAmount}`);
        const marketPriceOrderData = {
          symbol,
          usdtAmount: parseFloat(usdtAmount),
          autoSell: autoSellEnabled,
          desiredProfit: parseFloat(desiredProfit),
          stopLossAmount: stopLossEnabled ? Number(stopLossAmount) : undefined,
          stopLimitAmount: stopLossEnabled ? Number(stopLimitAmount) : undefined,
        };
        console.log("Отправка ордера по текущей цене:", marketPriceOrderData);
        response = await axios.post("/api/market-price-order", marketPriceOrderData, {
          headers: setAuthHeader({
            "Content-Type": "application/json",
          }),
        });
      } else {
        console.log("Отправка ордера:", orderData);
        response = await axios.post("/api/order", orderData, {
          headers: setAuthHeader({
            "Content-Type": "application/json",
          }),
        });
      }

      console.log("Ответ на создание ордера:", response.data);
      addNotification(
        `Ордер ${orderType} на ${quantity} ${symbol.replace(
          "USDT",
          ""
        )} по цене ${isMarketPrice ? 'текущей рыночной' : desiredPrice} USDT размещен успешно`
      );
      fetchBalance();
      fetchPendingOrders();
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

      // Можно добавить сброс полей здесь, если эт необходимо
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
    setStopLossEnabled(false);
    setStopLossPrice('');
    setStopLimitPrice('');
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
      alert("Не удалось удалить ордер. Поалуйста, попроуйте еще раз.");
    }
  };

  const handleTogglePendingOrders = async () => {
    setShowPendingOrders(!showPendingOrders);
    if (!showPendingOrders) {
      // Если мы открваем вкладку, обновляем список ордеров
      await fetchPendingOrders();
    }
  };

  const handleMarketPriceOrder = async () => {
    console.log('запускаем market price order handler');
    try {
      const response = await axios.post('/api/market-price-order', {
        symbol: 'BTCUSDT',
        usdtAmount: parseFloat(marketPriceUsdtAmount),
        limit: parseFloat(marketPriceLimit),
        autoSell: marketPriceAutoSell,
        targetPrice: marketPriceAutoSell ? parseFloat(marketPriceTargetPrice) : null,
        desiredProfit: marketPriceAutoSell ? parseFloat(desiredProfit) : null, // Добавляем эту строку
      }, {
        headers: setAuthHeader({
          'Content-Type': 'application/json',
        }),
      });

      if (response.data.success) {
        addNotification('Ордер по текущей цене выполнен успешно');
      } else {
        const keepOrder = window.confirm('Ордер не выполнен. Хотите оставить его активным?');
        if (!keepOrder) {
          await axios.delete(`/api/order/BTCUSDT/${response.data.order.orderId}`, {
            headers: setAuthHeader({}),
          });
          addNotification('Ордер отменен');
        } else {
          addNotification('Ордер оставлен активным');
        }
      }

      setShowMarketPriceModal(false);
      fetchBalance();
      fetchPendingOrders();
    } catch (error: any) {
      console.error('Ошибка при создании ордера по текущей цене:', error);
      alert(`шибка при создании ордера по текщей цене: ${error.response?.data?.error || error.message}`);
    }
  };

  // Функция для проверки цены автопродажи
  const checkAutoSellPrice = (price: string) => {
    if (!currentPrice) return;

    const autoSellPrice = parseFloat(price);
    const currentPriceValue = parseFloat(currentPrice);

    if (isNaN(autoSellPrice) || autoSellPrice <= 0) {
      setAutoSellPriceWarning("Введите корректную цену");
    } else if (autoSellPrice < currentPriceValue * 0.9) {
      setAutoSellPriceWarning("Цена слишком низкая");
    } else if (autoSellPrice > currentPriceValue * 1.5) {
      setAutoSellPriceWarning("Цена слишком высоя");
    } else {
      setAutoSellPriceWarning(null);
    }
  };

  // Обновляем обработчик изеения желаемой прибыли
  const handleDesiredProfitChange = (value: string) => {
    setDesiredProfit(value);
    if (desiredPrice) {
      const buyPrice = parseFloat(desiredPrice);
      const profit = parseFloat(value);
      if (!isNaN(buyPrice) && !isNaN(profit)) {
        const newTargetSellPrice = (buyPrice + profit).toFixed(2);
        setTargetSellPrice(newTargetSellPrice);
        checkAutoSellPrice(newTargetSellPrice);
      }
    }
  };

  const toggleSortOrder = () => {
    setSortOrderAsc(!sortOrderAsc);
  };

  const sortedTrades = [...trades].sort((a, b) => {
    const timeA = new Date(a.time).getTime();
    const timeB = new Date(b.time).getTime();
    return sortOrderAsc ? timeA - timeB : timeB - timeA;
  });

  const handleMarketPriceToggle = () => {
    setIsMarketPrice(!isMarketPrice);
    if (!isMarketPrice) {
      setDesiredPrice(''); // Очищаем поле "Желаемая цена" при включении режима покупки по текущей цене
    }
  };

  const renderPriceArrow = () => {
    const arrowDirection = priceChange === "same" ? lastChangeRef.current : priceChange;
    if (arrowDirection === "up") {
      return <span className="text-green-500 ml-2">&#9650;</span>; // Зеленая стрелка вверх
    } else if (arrowDirection === "down") {
      return <span className="text-red-500 ml-2">&#9660;</span>; // Красная стрелка вниз
    }
    return null;
  };

  const handleOrderTypeChange = (type: "BUY" | "SELL") => {
    setOrderType(type);
    // Здесь можно добавить дополнительную логику при смене типа ордера
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-gray-900 rounded-lg shadow-md text-gray-200">
      <h1 className="text-2xl font-bold text-center text-gray-100 mb-6">
        Aoro
        <span className="text-gray-400 text-sm"> (Binance API)</span>
        <div>
          <h2 className="max-w-4xl mx-auto bg-gray-900 rounded-lg shadow-md text-gray-200 text-sm">day trading dream machine</h2>
        </div>
      </h1>
      <div className="space-y-6">
      <div>
              <div className="block text-2xl font-medium text-gray-200 text-center">
                <span className="text-gray-200 font-bold">
                <span className="blocktext-sm font-medium text-gray-200">
                Текущая цена:
              </span>
                  {currentPrice ? ` ${currentPrice} USDT` : "Загрузка..."}
                </span>
                {renderPriceArrow()}
              </div>
            </div>
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-100 text-center">Баланс аккаунта</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {balances.map((balance) => (
              <div key={balance.asset} className="balance-item flex items-center gap-2 bg-gray-800 p-2 rounded">
                <span className="font-bold text-gray-200">{balance.asset}:</span>
                <span className="px-2 py-1 rounded bg-green-500 text-white text-sm">
                  {parseFloat(balance.free).toFixed(8)}
                </span>
                {parseFloat(balance.locked) > 0 && (
                  <span className="px-2 py-1 rounded bg-red-500 text-white text-sm">
                    {parseFloat(balance.locked).toFixed(8)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <form onSubmit={handleOrder} className="space-y-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Тип ордера:
              </label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => handleOrderTypeChange("BUY")}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-300 ${
                    orderType === "BUY"
                      ? "bg-green-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  Купить
                </button>
                <button
                  type="button"
                  onClick={() => handleOrderTypeChange("SELL")}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-300 ${
                    orderType === "SELL"
                      ? "bg-red-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  Продать
                </button>
              </div>
            </div>
            <div>
              {!isMarketPrice && (
                <label
                  htmlFor="desiredPrice"
                className="block text-sm font-medium text-gray-200 mb-1"
              >
                Желаемая цена (USDT):
              </label>
              )}
              <div className="flex items-center space-x-2">
                {!isMarketPrice && (
                  <input
                    id="desiredPrice"
                    type="number"
                    value={desiredPrice}
                    onChange={(e) => setDesiredPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
                <button
                  type="button"
                  onClick={handleMarketPriceToggle}
                  className={`h-10 w-full px-2 rounded-md text-white font-medium transition-all duration-300 ${
                    isMarketPrice
                      ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                      : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 w-70`}
                >
                  {isMarketPrice ? (
                    <>
                      <span className="sm:hidden">ОТМЕНА МАРКЕТ</span>
                      <span className="hidden sm:inline">ОТМЕНИТЬ МАРКЕТ ЦЕНУ</span>
                    </>
                  ) : (
                    "МАРКЕТ ЦЕНА"
                  )}
                </button>
              </div>
            </div>
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-200 mb-1"
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
                className="w-full px-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="range"
                min="0"
                max="100"
                value={sliderValue}
                onChange={handleSliderChange}
                className="w-full mt-2 bg-gray-700"
              />
              <div className="text-sm text-gray-600 mt-1">
                Максимально доступно:{" "}
                {orderType === "BUY"
                  ? `${maxUsdtAmount.toFixed(2)} USDT`
                  : `${maxBtcAmount.toFixed(8)} BTC`}
              </div>
            </div>
            {orderType === "BUY" && !isMarketPrice && (
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Предполагаемое количество BTC:
                </label>
                <div className="block text-sm font-medium text-gray-200 mb-1">
                  {estimatedBtcAmount ? (
                    estimatedBtcAmount
                  ) : (
                    <div>
                    <span className="text-gray-400">Введите цену и сумму USDT </span>
                    <span className="text-gray-400 text-xl font-bold text-red-500">!</span>
                    </div>
                  )}
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
                    type="button"
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
                      onChange={(e) => handleDesiredProfitChange(e.target.value)}
                      placeholder="Желаемая прибыль (USDT)"
                      className="w-full px-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                    />
                    {targetSellPrice && (
                      <div className="text-sm mb-2">
                        <span className="text-gray-400">
                          Целевая цена продажи: {targetSellPrice} USDT
                        </span>
                      </div>
                    )}
                    <div className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id="stopLoss"
                        checked={stopLossEnabled}
                        onChange={(e) => setStopLossEnabled(e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="stopLoss" className="text-gray-200">
                        Установить стоп-лосс
                      </label>
                    </div>
                    {stopLossEnabled && (
                      <>
                        <input
                          type="number"
                          value={stopLossAmount}
                          onChange={(e) => setStopLossAmount(e.target.value)}
                          placeholder="Стоп-лосс сумма (USDT)"
                          className="w-full px-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                        />
                        <input
                          type="number"
                          value={stopLimitAmount}
                          onChange={(e) => setStopLimitAmount(e.target.value)}
                          placeholder="Лимитная сумма стоп-лосс (USDT)"
                          className="w-full px-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            >
              {orderType === "BUY" ? "Купить BTC" : "Продать BTC"}
            </button>
          </form>
        </div>

        <div className="mt-6">
          <div
            onClick={handleTogglePendingOrders}
            className="flex items-center justify-between cursor-pointer bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 w-full"
          >
            <span>Отложенные ордры</span>
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
                <table className="min-w-full bg-gray-800 border border-gray-700">
                  <thead>
                    <tr className="bg-gray-700">
                      <th className="py-2 px-4 border-b border-gray-600">Символ</th>
                      <th className="py-2 px-4 border-b border-gray-600">ID ордера</th>
                      <th className="py-2 px-4 border-b border-gray-600">Цена</th>
                      <th className="py-2 px-4 border-b border-gray-600">Количество</th>
                      <th className="py-2 px-4 border-b border-gray-600">Выполнено</th>
                      <th className="py-2 px-4 border-b border-gray-600">Статус</th>
                      <th className="py-2 px-4 border-b border-gray-600">Тип</th>
                      <th className="py-2 px-4 border-b border-gray-600">Сторона</th>
                      <th className="py-2 px-4 border-b border-gray-600">Сумма USDT</th>
                      <th className="py-2 px-4 border-b border-gray-600">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrders.map((order) => (
                      <tr key={order.orderId}>
                        <td className="py-2 px-4 border-b border-gray-700">{order.symbol}</td>
                        <td className="py-2 px-4 border-b border-gray-700">{order.orderId}</td>
                        <td className="py-2 px-4 border-b border-gray-700">{order.price}</td>
                        <td className="py-2 px-4 border-b border-gray-700">{order.origQty}</td>
                        <td className="py-2 px-4 border-b border-gray-700">
                          {order.executedQty}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-700">{order.status}</td>
                        <td className="py-2 px-4 border-b border-gray-700">{order.type}</td>
                        <td className="py-2 px-4 border-b border-gray-700">{order.side}</td>
                        <td className="py-2 px-4 border-b border-gray-700">
                          {order.totalUSDT.toFixed(2)}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-700">
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
            className="flex items-center justify-between cursor-pointer bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 w-full"
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
              <div className="flex justify-end mb-2">
                <button
                  onClick={toggleSortOrder}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded inline-flex items-center"
                >
                  <span>{sortOrderAsc ? "Старые сверху" : "Новые сверху"}</span>
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-gray-800 border border-gray-700">
                  <thead>
                    <tr className="bg-gray-700">
                      <th className="py-2 px-4 border-b border-gray-600">Символ</th>
                      <th className="py-2 px-4 border-b border-gray-600">ID ордера</th>
                      <th className="py-2 px-4 border-b border-gray-600">Сторона</th>
                      <th className="py-2 px-4 border-b border-gray-600">Количество</th>
                      <th className="py-2 px-4 border-b border-gray-600">Цена</th>
                      <th className="py-2 px-4 border-b border-gray-600">Сумма USDT</th>
                      <th className="py-2 px-4 border-b border-gray-600">Комиссия</th>
                      <th className="py-2 px-4 border-b border-gray-600">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTrades.map((trade) => (
                      <tr key={trade.id}>
                        <td className="py-2 px-4 border-b border-gray-700">{trade.symbol}</td>
                        <td className="py-2 px-4 border-b border-gray-700">{trade.orderId}</td>
                        <td className="py-2 px-4 border-b border-gray-700">
                          {trade.isBuyer ? "BUY" : "SELL"}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-700">
                          {trade.quantity.toFixed(8)}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-700">
                          {trade.price.toFixed(2)}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-700">
                          {trade.quoteQuantity.toFixed(2)}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-700">
                          {`${trade.commission} ${trade.commissionAsset}`}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-700">
                          {new Date(trade.time).toLocaleString()}
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

      {/* Модальное окно подтверждения удаления */}
      {orderToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full" id="my-modal">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-gray-800">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-100">
                Подтверждение удаления
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-200">
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