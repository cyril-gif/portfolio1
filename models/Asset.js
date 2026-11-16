import mongoose from 'mongoose';

// Uploaded files (profile photo, CV) are stored in MongoDB because Render's disk
// is wiped on every deploy. Both are small, so this is fine for a portfolio.
const assetSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, enum: ['photo', 'cv'] },
    contentType: { type: String, required: true },
    filename: { type: String, default: '' },
    size: { type: Number, default: 0 },
    data: { type: Buffer, required: true }
  },
  { timestamps: true }
);

export default mongoose.model('Asset', assetSchema);
