import mongoose from 'mongoose';
// One document per operating day, with a deterministic _id ("active:YYYY-MM-DD").
// MongoDB's unique _id guarantees that only ONE insert can succeed, so two
// concurrent "call next" requests can never both start a service.
const schema = new mongoose.Schema(
  {
    _id: { type: String },
    operatingDate: { type: String, required: true },
    entryId: { type: mongoose.Schema.Types.ObjectId, ref: 'QueueEntry', required: true },
  },
  { timestamps: true }
);
export default mongoose.model('ActiveService', schema);
