import mongoose, { Document, Schema } from 'mongoose';

export interface ITrade extends Document {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: Date;
  totalUSDT: number;
  quantityUSDT: number; // Добавляем это поле
}

const TradeSchema: Schema = new Schema({
  symbol: { type: String, required: true },
  side: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  timestamp: { type: Date, required: true },
  totalUSDT: { type: Number, required: true },
  quantityUSDT: { type: Number, required: true }, // Добавляем это поле
});

export const Trade = mongoose.model<ITrade>('Trade', TradeSchema);
