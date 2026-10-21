import mongoose from 'mongoose';

export const STATUSES = ['WAITING', 'CALLED', 'IN_SERVICE', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
export const BOOKING_TYPES = ['WALK_IN', 'APPOINTMENT'];

const queueEntrySchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true, maxlength: 60 },
    tokenNumber: { type: String, required: true },
    operatingDate: { type: String, required: true }, // YYYY-MM-DD in salon timezone
    bookingType: { type: String, enum: BOOKING_TYPES, required: true },
    scheduledAt: { type: Date, default: null },
    checkedInAt: { type: Date, required: true }, // registration timestamp
    isPresent: { type: Boolean, default: true }, // appointments start false unless checked in at registration
    arrivedAt: { type: Date, default: null },
    status: { type: String, enum: STATUSES, default: 'WAITING' },
    calledAt: { type: Date, default: null },
    serviceStartedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

queueEntrySchema.index({ operatingDate: 1, tokenNumber: 1 }, { unique: true });
queueEntrySchema.index({ operatingDate: 1, status: 1 });
queueEntrySchema.index({ operatingDate: 1, bookingType: 1, scheduledAt: 1 });

export default mongoose.model('QueueEntry', queueEntrySchema);
