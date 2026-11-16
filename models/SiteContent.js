import mongoose from 'mongoose';

// One document (key: "main") holding every editable section of the site:
// profile, about, skills, experience, services, contact, site.
const siteContentSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'main' },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    projectsSeeded: { type: Boolean, default: false }
  },
  { timestamps: true, minimize: false }
);

export default mongoose.model('SiteContent', siteContentSchema);
