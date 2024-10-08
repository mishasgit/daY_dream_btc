import mongoose, { Document, Schema } from 'mongoose';

export interface IAutoSellOrder extends Document {
  symbol: string;
  buyOrderId: number;
  sellOrderId?: number;
  quantity: string;
  targetPrice: number;
  stopPrice?: number;
  stopLimitPrice?: number;
  status: 'WAITING_FOR_BUY' | 'SELL_ORDER_PLACED' | 'COMPLETED' | 'CANCELLED';
  isOco: boolean;
}

const AutoSellOrderSchema: Schema = new Schema({
  symbol: { type: String, required: true },
  buyOrderId: { type: Number, required: true },
  sellOrderId: { type: Number },
  quantity: { type: String, required: true },
  targetPrice: { type: Number, required: true },
  stopPrice: { type: Number },
  stopLimitPrice: { type: Number },
  status: { type: String, required: true },
  isOco: { type: Boolean, required: true },
});

export const AutoSellOrder = mongoose.model<IAutoSellOrder>('AutoSellOrder', AutoSellOrderSchema);
