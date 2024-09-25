import mongoose, { Document, Schema } from 'mongoose';

export interface IAutoSellOrder extends Document {
  symbol: string;
  buyOrderId: number;
  sellOrderId?: number;
  quantity: string;
  targetPrice: string;
  status: 'WAITING_FOR_BUY' | 'SELL_ORDER_PLACED' | 'COMPLETED' | 'CANCELLED';
}

const AutoSellOrderSchema: Schema = new Schema({
  symbol: { type: String, required: true },
  buyOrderId: { type: Number, required: true },
  sellOrderId: { type: Number },
  quantity: { type: String, required: true },
  targetPrice: { type: String, required: true },
  status: { type: String, required: true },
});

export const AutoSellOrder = mongoose.model<IAutoSellOrder>('AutoSellOrder', AutoSellOrderSchema);
