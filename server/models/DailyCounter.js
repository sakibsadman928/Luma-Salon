import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  operatingDate: { type: String, required: true, unique: true },
  lastTokenNumber: { type: Number, default: 0 },
});
export default mongoose.model('DailyCounter', schema);
