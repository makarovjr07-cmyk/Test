const MIN_SUBJECTS = 6;
const MAX_SUBJECTS = 9;

const DEFAULT_CREDIT = 4;
const CREDIT_MIN = 0;
const CREDIT_MAX = 10;
const THEORY_MIN = 0;
const THEORY_MAX = 75;
const PRACTICAL_MIN = 0;
const PRACTICAL_MAX = 50;
const FINAL_SCORE_MIN = 0;
const FINAL_SCORE_MAX = 100;
const SUBJECT_MODE_75_25 = '75-25';
const SUBJECT_MODE_50_50 = '50-50';
const SUBJECT_MARK_CONFIG = Object.freeze({
  [SUBJECT_MODE_75_25]: Object.freeze({
    theoryMax: 75,
    practicalMax: 25,
    practicalPassPercent: 40,
  }),
  [SUBJECT_MODE_50_50]: Object.freeze({
    theoryMax: 50,
    practicalMax: 50,
    practicalPassPercent: 40,
  }),
});

// Ordered from highest to lowest. First matching rule is used.
const GRADE_SCALE = Object.freeze([
  { minimumScore: 90, letterGrade: 'A+', gpa: 4.0 },
  { minimumScore: 80, letterGrade: 'A', gpa: 3.6 },
  { minimumScore: 70, letterGrade: 'B+', gpa: 3.2 },
  { minimumScore: 60, letterGrade: 'B', gpa: 2.8 },
  { minimumScore: 50, letterGrade: 'C+', gpa: 2.4 },
  { minimumScore: 40, letterGrade: 'C', gpa: 2.0 },
  { minimumScore: 35, letterGrade: 'D', gpa: 1.6 },
  { minimumScore: Number.NEGATIVE_INFINITY, letterGrade: 'F', gpa: 0.0 },
]);

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value, digits) {
  return Number(toFiniteNumber(value, 0).toFixed(digits));
}

function normalizeToArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'undefined') return [];
  return [value];
}

function clampSubjectCount(value) {
  const safeCount = Math.trunc(toFiniteNumber(value, MIN_SUBJECTS));
  return clampNumber(safeCount, MIN_SUBJECTS, MAX_SUBJECTS);
}

function gradeFromScore(score) {
  const numericScore = toFiniteNumber(score, 0);
  const matchedBand =
    GRADE_SCALE.find((band) => numericScore >= band.minimumScore) ||
    GRADE_SCALE[GRADE_SCALE.length - 1];

  // Keep output keys compatible with existing code and templates.
  return {
    min: matchedBand.minimumScore,
    grade: matchedBand.letterGrade,
    gpa: matchedBand.gpa,
  };
}

function isFailingGrade(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'F' || normalized === 'NG';
}

function normalizeSubjectMode(value) {
  return String(value || '').trim() === SUBJECT_MODE_50_50
    ? SUBJECT_MODE_50_50
    : SUBJECT_MODE_75_25;
}

function isComputerSubjectName(value) {
  const normalizedName = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return /\b(computer|programming|software|website|web design|java|microprocessor|database|data base|data structure|visual programming|operating system|electro system|aoc|wmat|os)\b/.test(normalizedName);
}

function getSubjectMarkConfig(mode) {
  return SUBJECT_MARK_CONFIG[normalizeSubjectMode(mode)] || SUBJECT_MARK_CONFIG[SUBJECT_MODE_75_25];
}

function parseSubjectInputs(body = {}) {
  const names = normalizeToArray(body.subjectName);
  const credits = normalizeToArray(body.credit);
  const theoryMarks = normalizeToArray(body.th);
  const practicalMarks = normalizeToArray(body.pr);
  const modes = normalizeToArray(body.subjectMode);

  const rowCount = Math.max(names.length, credits.length, theoryMarks.length, practicalMarks.length, modes.length);
  const subjects = [];

  for (let index = 0; index < rowCount; index += 1) {
    // Skip rows where subject name is empty so partial rows are ignored cleanly.
    const name = String(names[index] || '').trim();
    if (!name) continue;

    const mode = isComputerSubjectName(name)
      ? SUBJECT_MODE_50_50
      : normalizeSubjectMode(modes[index]);
    const markConfig = getSubjectMarkConfig(mode);

    subjects.push({
      name,
      mode,
      credit: clampNumber(toFiniteNumber(credits[index], DEFAULT_CREDIT), CREDIT_MIN, CREDIT_MAX),
      th: clampNumber(toFiniteNumber(theoryMarks[index], 0), THEORY_MIN, markConfig.theoryMax),
      pr: clampNumber(toFiniteNumber(practicalMarks[index], 0), PRACTICAL_MIN, markConfig.practicalMax),
    });
  }

  return subjects;
}

function buildCalculatedSubject(subject = {}) {
  const name = String(subject.name || '').trim();
  const mode = isComputerSubjectName(name)
    ? SUBJECT_MODE_50_50
    : normalizeSubjectMode(subject.mode);
  const markConfig = getSubjectMarkConfig(mode);
  const credit = clampNumber(toFiniteNumber(subject.credit, DEFAULT_CREDIT), CREDIT_MIN, CREDIT_MAX);
  const th = clampNumber(toFiniteNumber(subject.th, 0), THEORY_MIN, markConfig.theoryMax);
  const pr = clampNumber(toFiniteNumber(subject.pr, 0), PRACTICAL_MIN, markConfig.practicalMax);

  const finalScore = clampNumber(th + pr, FINAL_SCORE_MIN, FINAL_SCORE_MAX);
  const practicalPassMark = roundTo((markConfig.practicalMax * markConfig.practicalPassPercent) / 100, 2);
  const hasPracticalFailure = pr < practicalPassMark;
  const gradeInfo = hasPracticalFailure
    ? { grade: 'NG', gpa: 0 }
    : gradeFromScore(finalScore);

  return {
    name,
    mode,
    credit,
    th,
    pr,
    theoryMax: markConfig.theoryMax,
    practicalMax: markConfig.practicalMax,
    // Keep both naming styles for compatibility with existing templates/data.
    finalGrade: gradeInfo.grade,
    gradePoint: gradeInfo.gpa,
    grade: gradeInfo.grade,
    gpa: gradeInfo.gpa,
  };
}

function calculateResult(subjectInputs = []) {
  const subjects = subjectInputs.map(buildCalculatedSubject);

  const totalObtainedRaw = subjects.reduce((sum, subject) => sum + subject.th + subject.pr, 0);
  const totalMax = subjects.length * FINAL_SCORE_MAX;
  const percentage =
    totalMax > 0 ? roundTo((totalObtainedRaw / totalMax) * 100, 2) : 0;

  const overallGradeInfo = gradeFromScore(percentage);
  const totalCredits = subjects.reduce((sum, subject) => sum + subject.credit, 0);
  const weightedGradePoints = subjects.reduce((sum, subject) => sum + subject.gradePoint * subject.credit, 0);
  const hasFailingSubject = subjects.some((subject) => isFailingGrade(subject.finalGrade || subject.grade));
  const overallGPA = hasFailingSubject
    ? 0
    : (totalCredits > 0 ? roundTo(weightedGradePoints / totalCredits, 3) : 0);

  return {
    subjects,
    totalObtained: roundTo(totalObtainedRaw, 2),
    totalMax,
    percentage,
    overallGrade: hasFailingSubject ? 'NG' : overallGradeInfo.grade,
    overallGPA,
  };
}

module.exports = {
  MIN_SUBJECTS,
  MAX_SUBJECTS,
  clampSubjectCount,
  gradeFromScore,
  normalizeSubjectMode,
  parseSubjectInputs,
  calculateResult,
};
