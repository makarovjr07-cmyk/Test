const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    mode: { type: String, enum: ['75-25', '50-50'], default: '75-25' },
    credit: { type: Number, default: 4 },
    th: Number,
    pr: Number,
    theoryMax: Number,
    practicalMax: Number,
    finalGrade: String,
    gradePoint: Number,
    grade: String,
    gpa: Number,
  },
  { _id: false }
);

const ResultSchema = new mongoose.Schema({
  symbolNumber: { type: String, unique: true, required: true, uppercase: true },
  studentName: { type: String, required: true, trim: true },
  class: { type: String, required: true },
  section: { type: String, trim: true, uppercase: true },
  examType: { type: String, default: 'Final' },
  dateOfBirth: { type: String },
  subjects: [SubjectSchema],
  totalObtained: Number,
  totalMax: Number,
  percentage: Number,
  overallGrade: String,
  overallGPA: Number,
  createdAt: { type: Date, default: Date.now },
});

ResultSchema.index({ createdAt: -1 });
ResultSchema.index({ class: 1, section: 1, createdAt: -1 });

module.exports = mongoose.model('Result', ResultSchema);
