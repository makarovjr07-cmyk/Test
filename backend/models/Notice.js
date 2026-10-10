const mongoose = require('mongoose');

const NoticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 720 },
    publishedOn: {
      type: String,
      required: true,
      default: () => new Date().toISOString().slice(0, 10),
    },
    pinned: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    linkLabel: { type: String, default: '', trim: true, maxlength: 40 },
    linkUrl: { type: String, default: '', trim: true, maxlength: 300 },
  },
  {
    timestamps: true,
  }
);

NoticeSchema.index({ active: -1, pinned: -1, publishedOn: -1, updatedAt: -1 });

module.exports = mongoose.model('Notice', NoticeSchema);
