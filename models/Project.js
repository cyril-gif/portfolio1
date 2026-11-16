import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, enum: ['development', 'office'], default: 'development' },
    description: { type: String, default: '', maxlength: 500 },
    tools: { type: [String], default: [] },
    liveUrl: { type: String, default: '' },
    codeUrl: { type: String, default: '' },
    visible: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.model('Project', projectSchema);
