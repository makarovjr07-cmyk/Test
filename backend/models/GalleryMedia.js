const mongoose = require('mongoose');

const GalleryMediaSchema = new mongoose.Schema(
  {
    albumName: { type: String, required: true, trim: true, maxlength: 80 },
    fileName: { type: String, required: true, trim: true, maxlength: 180 },
    path: { type: String, required: true, trim: true, maxlength: 320 },
    mediaType: { type: String, required: true, enum: ['image', 'video'] },
    mimeType: { type: String, required: true, trim: true, maxlength: 80 },
    sizeBytes: { type: Number, required: true, min: 0 },
    durationSeconds: { type: Number, default: 0, min: 0 },
    thumbnailPath: { type: String, default: '', trim: true, maxlength: 320 },
    muted: { type: Boolean, default: true },
  },
  { timestamps: true }
);

GalleryMediaSchema.index({ albumName: 1, fileName: 1 }, { unique: true });
GalleryMediaSchema.index({ mediaType: 1, updatedAt: -1 });

module.exports = mongoose.model('GalleryMedia', GalleryMediaSchema);
