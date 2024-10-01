import mongoose, { Document, Schema } from 'mongoose';

export interface IAutoSellOrder extends Document {
  symbol: string;
  buyOrderId: number;
  quantity: string;
  targetPrice: number;
  stopPrice?: number;
  stopLimitPrice?: number;
  status: string;
  sellOrderId?: number;
  isOco: boolean;
}

const AutoSellOrderSchema: Schema = new Schema({
  symbol: { type: String, required: true },
  buyOrderId: { type: Number, required: true },
  quantity: { type: String, required: true },
  targetPrice: { type: Number, required: true },
  stopPrice: { type: Number },
  stopLimitPrice: { type: Number },
  status: { type: String, required: true },
  sellOrderId: { type: Number },
  isOco: { type: Boolean, default: false },
});

export const AutoSellOrder = mongoose.model<IAutoSellOrder>('AutoSellOrder', AutoSellOrderSchema);
