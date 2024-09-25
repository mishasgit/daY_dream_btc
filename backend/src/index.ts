import express, { Request, Response, NextFunction } from 'express';
import Binance, { OrderType, ExchangeInfo, NewOrderSpot } from 'binance-api-node';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Trade, ITrade } from './models/ITrade';
import { AutoSellOrder, IAutoSellOrder } from './models/IAutoSellOrder';

dotenv.config();

const app = express();
app.use(express.json());

const apiKey = process.env.BINANCE_API_KEY;
const apiSecret = process.env.BINANCE_SECRET_KEY;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD as string;
const MONGODB_URI = process.env.MONGODB_URI as string;
const HTTP_BASE = process.env.HTTP_BASE as string;

const client = Binance({
  apiKey,
  apiSecret,
  httpBase: HTTP_BASE,
});

let exchangeInfo: ExchangeInfo;

async function updateExchangeInfo() {
  try {
    exchangeInfo = await client.exchangeInfo();
    console.log('Информация о бирже обновлена');
  } catch (error) {
    console.error('Ошибка при обновлении информации о бирже:', error);
  }
}

// Обновляем информацию при запуске сервера и каждый час
updateExchangeInfo();
setInterval(updateExchangeInfo, 60 * 60 * 1000);

function adjustQuantity(symbol: string, quantity: string): string {
  const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);
  if (!symbolInfo) {
    throw new Error(`Символ ${symbol} не найден`);
  }

  const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
  if (!lotSizeFilter || !('stepSize' in lotSizeFilter)) {
    throw new Error(`Фильтр LOT_SIZE не найден для символа ${symbol}`);
  }

  const stepSize = parseFloat(lotSizeFilter.stepSize);
  const minQty = parseFloat(lotSizeFilter.minQty);
  const maxQty = parseFloat(lotSizeFilter.maxQty);

  let adjustedQuantity = Math.floor(parseFloat(quantity) / stepSize) * stepSize;
  adjustedQuantity = Math.max(minQty, Math.min(maxQty, adjustedQuantity));

  return adjustedQuantity.toFixed(8).replace(/\.?0+$/, '');
}

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader === AUTH_PASSWORD) {
    console.log(`Успешная аутентификация для ${req.path}`);
    next();
  } else {
    console.log(`Неудачная попытка аутентификации для ${req.path}`);
    console.log(`Полученный заголовок авторизации: ${authHeader}`);
    console.log(`IP-адрес запроса: ${req.ip}`);
    console.log(`Метод запроса: ${req.method}`);
    console.log(`Заголовки запроса: ${JSON.stringify(req.headers)}`);
    res.status(401).send('Unauthorized');
  }
}

app.use('/api', authMiddleware);

// Новая функция для создания ордера на автопродажу
async function createAutoSellOrder(buyOrder: any, targetPrice: number) {
    console.log(`Создаем auto ордер на продажу: ${buyOrder.symbol} ${buyOrder.executedQty} ${targetPrice}`);
  try {
    // Форматируем цену, чтобы она соответствовала требованиям Binance API
    const formattedPrice = targetPrice.toFixed(8).replace(/\.?0+$/, '');

    const sellOrder = await client.order({
      symbol: buyOrder.symbol,
      side: 'SELL',
      type: OrderType.LIMIT,
      quantity: buyOrder.executedQty,
      price: formattedPrice,
    } as NewOrderSpot);

    const autoSellOrder = new AutoSellOrder({
      symbol: buyOrder.symbol,
      buyOrderId: buyOrder.orderId,
      sellOrderId: sellOrder.orderId,
      quantity: buyOrder.executedQty,
      targetPrice: formattedPrice,
      status: 'SELL_ORDER_PLACED',
    });
    await autoSellOrder.save();
    console.log(`Создан автоордер на продажу: ${JSON.stringify(autoSellOrder)}`);
  } catch (error) {
    console.error('Ошибка при создании автоматического ордера на продажу:', error);
    throw error;
  }
}

// Функция для проверки статуса ордеров на покупку и создания ордеров на продажу
async function checkBuyOrdersAndCreateSellOrders() {
  try {
    const pendingAutoSellOrders = await AutoSellOrder.find({ status: 'WAITING_FOR_BUY' });
    console.log(`Найдено ${pendingAutoSellOrders.length} ожидающих ордеров на продажу`);
    
    for (const autoSellOrder of pendingAutoSellOrders) {
      const order = await client.getOrder({
        symbol: autoSellOrder.symbol,
        orderId: autoSellOrder.buyOrderId,
      });
      
      if (order.status === 'FILLED') {
        // Создаем ордер на продажу
        console.log(`Создаем ордер на продажу: ${autoSellOrder.symbol} ${autoSellOrder.quantity} ${autoSellOrder.targetPrice}`);
        const sellOrder = await client.order({
          symbol: autoSellOrder.symbol,
          side: 'SELL',
          type: OrderType.LIMIT,
          quantity: autoSellOrder.quantity,
          price: autoSellOrder.targetPrice.toString(),
        } as NewOrderSpot);
        
        // Обновляем статус автоордера на продажу
        autoSellOrder.status = 'SELL_ORDER_PLACED';
        autoSellOrder.sellOrderId = sellOrder.orderId;
        await autoSellOrder.save();
        
        console.log(`Создан ордер на продажу: ${JSON.stringify(sellOrder)}`);
      } else if (order.status === 'CANCELED' || order.status === 'EXPIRED' || order.status === 'REJECTED') {
        // Если ордер на покупку отменен, истек или отклонен, удаляем запись об автопродаже
        await AutoSellOrder.deleteOne({ _id: autoSellOrder._id });
        console.log(`Удален автоордер на продажу из-за отмены ордера на покупку: ${autoSellOrder.buyOrderId}`);
      }
      // Если ордер все еще в статусе NEW или PARTIALLY_FILLED, ничего не делаем и ждем следующей проверки
    }
  } catch (error) {
    console.error('Ошибка при проверке ордеров на покупку и создании ордеров на продажу:', error);
  }
}

// Запускаем проверку каждую минуту
setInterval(checkBuyOrdersAndCreateSellOrders, 60 * 1000);

app.post('/api/order', async (req: Request, res: Response) => {
  const { symbol, side, quantity, price, autoSell, targetPrice } = req.body;
  console.log(`Получен запрос на создание ордера: ${symbol} ${side} ${quantity} ${price} ${autoSell} ${targetPrice}`);

  try {
    const adjustedQuantity = adjustQuantity(symbol, quantity);
    console.log(`Скорректированное количество: ${adjustedQuantity}`);

    const order = await client.order({
      symbol,
      side,
      type: price ? OrderType.LIMIT : OrderType.MARKET,
      quantity: adjustedQuantity,
      price: price || undefined,
    } as NewOrderSpot);
    console.log(`Ордер успешно создан: ${JSON.stringify(order)}`);

    const totalUSDT = parseFloat(adjustedQuantity) * parseFloat(order.price);
    
    // Сохраняем сделку в базу данных
    const trade = new Trade({
      symbol,
      side,
      quantity: parseFloat(adjustedQuantity),
      price: parseFloat(order.price),
      timestamp: order.transactTime ? new Date(order.transactTime) : new Date(),
      totalUSDT: totalUSDT,
      quantityUSDT: side === 'BUY' ? totalUSDT : parseFloat(adjustedQuantity),
    });
    await trade.save();

    // Если включена автопродажа, создаем запись для автоордера на продажу
    if (side === 'BUY' && autoSell && targetPrice) {
      console.log(`Создаем AutoSellOrder: ${symbol} ${order.orderId} ${adjustedQuantity} ${targetPrice}`);
      try {
        const autoSellOrder = new AutoSellOrder({
          symbol,
          buyOrderId: order.orderId,
          quantity: adjustedQuantity,
          targetPrice,
          status: 'WAITING_FOR_BUY',
        });
        await autoSellOrder.save();
        console.log(`Создан автоордер на продажу: ${JSON.stringify(autoSellOrder)}`);
      } catch (error) {
        console.error(`Ошибка при создании AutoSellOrder: ${error}`);
      }
    }

    res.json(order);
  } catch (error: any) {
    console.error(`Ошибка при создании ордера: ${error.body || error.message}`);
    res.status(500).json({ error: error.body || error.message });
  }
});

async function updatePendingOrders() {
  try {
    const openOrders = await client.openOrders({
      recvWindow: 60000,
    });
    console.log(`Обновлено ${openOrders.length} отложенных ордеров`);
    return openOrders;
  } catch (error) {
    console.error('Ошибка при обновлении отложенных ордеров:', error);
    throw error;
  }
}

app.get('/api/trades', async (req: Request, res: Response) => {
  try {
    const trades = await Trade.find().sort({ timestamp: -1 });
    res.json(trades);
  } catch (error: any) {
    console.error(`Ошибка при получении сделок: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/balance', async (req: Request, res: Response) => {
  try {
    const accountInfo = await client.accountInfo();
    const balances = accountInfo.balances
      .filter(b => ['BTC', 'USDT'].includes(b.asset) && (parseFloat(b.free) > 0 || parseFloat(b.locked) > 0));
    res.json(balances);
  } catch (error) {
    console.error('Ошибка при получении баланса:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Неизвестная ошибка' });
  }
});

app.get('/api/price', async (req: Request, res: Response) => {
  const { symbol } = req.query;
  console.log(`Получен запрос на цену для символа: ${symbol}`);
  try {
    const ticker = await client.prices({ symbol: symbol as string });
    console.log(`Цена для ${symbol}: ${ticker[symbol as string]}`);
    res.json({ price: ticker[symbol as string] });
  } catch (error: any) {
    console.error(`Ошибка при получении цены: ${error.body || error.message}`);
    res.status(500).json({ error: error.body || error.message });
  }
});

app.get('/api/pending-orders', async (req: Request, res: Response) => {
  try {
    const openOrders = await client.openOrders({
      recvWindow: 60000,
    });
    const ordersWithTotal = openOrders.map(order => ({
      ...order,
      totalUSDT: parseFloat(order.price) * parseFloat(order.origQty),
    }));
    console.log(`Получено ${ordersWithTotal.length} отложенных ордеров`);
    res.json(ordersWithTotal);
  } catch (error) {
    console.error('Ошибка при получении отложенных ордеров:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Неизвестная ошибка' });
  }
});

app.delete('/api/order/:symbol/:orderId', async (req: Request, res: Response) => {
  const { symbol, orderId } = req.params;
  try {
    const result = await client.cancelOrder({
      symbol,
      orderId: parseInt(orderId),
    });
    console.log(`Ордер успешно отменен: ${JSON.stringify(result)}`);

    // Удаляем соответствующую запись AutoSellOrder, если она существует
    await AutoSellOrder.deleteOne({ symbol, buyOrderId: parseInt(orderId) });

    res.json(result);
  } catch (error: any) {
    console.error(`Ошибка при отмене ордера: ${error.body || error.message}`);
    res.status(500).json({ error: error.body || error.message });
  }
});

app.get('/api/auto-sell-orders', async (req: Request, res: Response) => {
  try {
    const autoSellOrders = await AutoSellOrder.find().sort({ _id: -1 }).limit(100);
    res.json(autoSellOrders);
  } catch (error) {
    console.error('Ошибка при получении AutoSellOrders:', error);
    res.status(500).json({ error: 'Ошибка при получении AutoSellOrders' });
  }
});

const PORT = process.env.PORT || 4000;

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Подключено к MongoDB');
    app.listen(PORT, () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Ошибка подключения к MongoDB:', error);
  });