const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
if (!globalThis.crypto?.getRandomValues && crypto.webcrypto) {
  globalThis.crypto = crypto.webcrypto;
}
const os = require('os');
const { spawn } = require('child_process');
const express = require('express');
const compression = require('compression');
const multer = require('multer');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const bcrypt = require('bcryptjs');

function loadLocalEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && typeof process.env[key] === 'undefined') {
        process.env[key] = value;
      }
    });
}

loadLocalEnv();

function uniqueResolvedPaths(paths) {
  const seen = new Set();
  return paths
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const resolved = path.resolve(value);
      if (seen.has(resolved)) {
        return false;
      }
      seen.add(resolved);
      return true;
    });
}

function requireEnv(key, message) {
  const value = String(process.env[key] || '').trim();
  if (value) return value;
  const fallback = message || `Missing required environment variable: ${key}`;
  throw new Error(fallback);
}

function isWritableStorageRoot(storageRoot) {
  const resolvedRoot = String(storageRoot || '').trim();
  if (!resolvedRoot) {
    return false;
  }

  const dataDir = path.join(resolvedRoot, 'data');
  const photoDir = path.join(resolvedRoot, 'photos');
  const probePath = path.join(dataDir, `.storage-probe-${process.pid}-${Date.now()}.tmp`);

  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(photoDir, { recursive: true });
    fs.writeFileSync(probePath, `${Date.now()}`, 'utf8');
    fs.unlinkSync(probePath);
    return true;
  } catch (error) {
    try {
      if (fs.existsSync(probePath)) {
        fs.unlinkSync(probePath);
      }
    } catch { }
    return false;
  }
}

function resolveWritableStorageDir(candidates) {
  const resolvedCandidates = uniqueResolvedPaths(candidates);
  const writableCandidate = resolvedCandidates.find((candidatePath) => isWritableStorageRoot(candidatePath));
  return writableCandidate || resolvedCandidates[0] || path.join(process.cwd(), 'storage');
}

const Result = require('./models/Result');
const Notice = require('./models/Notice');
const PopupSettings = require('./models/PopupSettings');
const GalleryMedia = require('./models/GalleryMedia');
const {
  MIN_SUBJECTS,
  MAX_SUBJECTS,
  clampSubjectCount,
  parseSubjectInputs,
  calculateResult,
} = require('./utils/gradeCalculator');

const app = express();
const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const FRONTEND_PHOTO_DIR = path.join(FRONTEND_DIR, 'photos');
const BACKEND_DATA_DIR = path.join(__dirname, 'data');
const DEFAULT_RAILWAY_STORAGE_DIR = '/app/storage';
const DEFAULT_LOCAL_STORAGE_DIR = path.join(ROOT_DIR, 'storage');
const FALLBACK_LOCAL_STORAGE_DIR = path.join(ROOT_DIR, '.storage');
const TEMP_STORAGE_DIR = path.join(os.tmpdir(), 'kankai-storage');
const CONFIGURED_STORAGE_DIR = String(process.env.STORAGE_DIR || '').trim();
const STORAGE_DIR_CANDIDATES = uniqueResolvedPaths([
  CONFIGURED_STORAGE_DIR,
  DEFAULT_RAILWAY_STORAGE_DIR,
  TEMP_STORAGE_DIR,
  DEFAULT_LOCAL_STORAGE_DIR,
  FALLBACK_LOCAL_STORAGE_DIR,
]);
const STORAGE_DIR = resolveWritableStorageDir(STORAGE_DIR_CANDIDATES);
const MUTABLE_DATA_DIR = path.join(STORAGE_DIR, 'data');
const MUTABLE_PHOTO_DIR = path.join(STORAGE_DIR, 'photos');
const READ_ONLY_STORAGE_DIRS = STORAGE_DIR_CANDIDATES.filter(
  (candidatePath) => path.resolve(candidatePath) !== path.resolve(STORAGE_DIR)
);
const READ_ONLY_STORAGE_DATA_DIRS = READ_ONLY_STORAGE_DIRS.map((candidatePath) => path.join(candidatePath, 'data'));
const READ_ONLY_STORAGE_PHOTO_DIRS = READ_ONLY_STORAGE_DIRS.map((candidatePath) => path.join(candidatePath, 'photos'));
const DEFAULT_TEACHERS_DATA_PATH = path.join(BACKEND_DATA_DIR, 'teachers.json');
const PHOTO_STATIC_DIRS = uniqueResolvedPaths([MUTABLE_PHOTO_DIR, ...READ_ONLY_STORAGE_PHOTO_DIRS, FRONTEND_PHOTO_DIR]);
const TEACHER_PHOTO_SOURCE_DIRS = uniqueResolvedPaths([
  path.join(MUTABLE_PHOTO_DIR, 'Teacher'),
  ...READ_ONLY_STORAGE_PHOTO_DIRS.map((photoDir) => path.join(photoDir, 'Teacher')),
  path.join(FRONTEND_PHOTO_DIR, 'Teacher'),
]);
const TEACHER_PHOTO_PUBLIC_SOURCE_DIRS = uniqueResolvedPaths([
  path.join(FRONTEND_PHOTO_DIR, 'Teacher'),
  path.join(MUTABLE_PHOTO_DIR, 'Teacher'),
  ...READ_ONLY_STORAGE_PHOTO_DIRS.map((photoDir) => path.join(photoDir, 'Teacher')),
]);
const TEACHER_PHOTO_PUBLIC_FALLBACK_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
const LOCAL_TEACHER_PHOTO_DIR = path.join(DEFAULT_LOCAL_STORAGE_DIR, 'photos', 'Teacher');
const TEACHER_PHOTO_MUTATION_TARGET_DIRS = uniqueResolvedPaths([
  path.join(MUTABLE_PHOTO_DIR, 'Teacher'),
  LOCAL_TEACHER_PHOTO_DIR,
]);
const GALLERY_PHOTO_SOURCE_DIRS = uniqueResolvedPaths([
  MUTABLE_PHOTO_DIR,
  ...READ_ONLY_STORAGE_PHOTO_DIRS,
  FRONTEND_PHOTO_DIR,
]);
const TEACHERS_DATA_SOURCE_PATHS = uniqueResolvedPaths([
  path.join(MUTABLE_DATA_DIR, 'teachers.json'),
  ...READ_ONLY_STORAGE_DATA_DIRS.map((dataDir) => path.join(dataDir, 'teachers.json')),
  DEFAULT_TEACHERS_DATA_PATH,
]);

try {
  fs.mkdirSync(MUTABLE_DATA_DIR, { recursive: true });
  fs.mkdirSync(MUTABLE_PHOTO_DIR, { recursive: true });
} catch (error) {
  console.error('Failed to prepare writable storage directories:', error);
}

if (CONFIGURED_STORAGE_DIR && path.resolve(STORAGE_DIR) !== path.resolve(CONFIGURED_STORAGE_DIR)) {
  console.warn(`Configured STORAGE_DIR "${path.resolve(CONFIGURED_STORAGE_DIR)}" is not writable. Using "${STORAGE_DIR}" instead.`);
}

console.log(`Gallery storage root: ${STORAGE_DIR}`);

app.disable('x-powered-by');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_SECRET = requireEnv('SESSION_SECRET', 'Set SESSION_SECRET to a strong random value.');
const SESSION_COOKIE_NAME = String(process.env.SESSION_COOKIE_NAME || 'kankai.sid').trim() || 'kankai.sid';
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS = 10;
const ADMIN_WRITE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const ADMIN_WRITE_RATE_LIMIT_MAX_ATTEMPTS = 90;
const ADMIN_PASSWORD_HASH_ROUNDS = Math.min(
  14,
  Math.max(12, Number.parseInt(process.env.ADMIN_PASSWORD_HASH_ROUNDS || '12', 10) || 12)
);
const ADMIN_SENSITIVE_ACTION_WINDOW_MS = Number(
  process.env.ADMIN_SENSITIVE_ACTION_WINDOW_MS || 15 * 60 * 1000
);
const ADMIN_SESSION_NETWORK_BINDING_ENABLED =
  String(process.env.ADMIN_SESSION_NETWORK_BINDING || 'true').trim().toLowerCase() !== 'false';
const loginAttempts = new Map();
const adminWriteAttempts = new Map();
const PRIMARY_MONGODB_URI = normalizeMongoUri(requireEnv('MONGODB_URI', 'Set MONGODB_URI to your MongoDB connection URI.'));
const FALLBACK_MONGODB_URI = normalizeMongoUri(process.env.MONGODB_URI_FALLBACK || '');
const PREFER_DIRECT_MONGODB_URI = !IS_PRODUCTION && Boolean(FALLBACK_MONGODB_URI);
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'kankai_result_db';
const STATIC_MEDIA_CACHE_MAX_AGE_MS = IS_PRODUCTION ? 1000 * 60 * 60 * 24 * 90 : 1000 * 60 * 30;
const STATIC_MEDIA_CACHE_CONTROL = `public, max-age=${Math.floor(STATIC_MEDIA_CACHE_MAX_AGE_MS / 1000)}`;
const STATIC_TEXT_ASSET_CACHE_CONTROL = IS_PRODUCTION
  ? 'public, max-age=604800, immutable'
  : 'public, max-age=0, must-revalidate';
const STATIC_HTML_CACHE_CONTROL = IS_PRODUCTION
  ? 'public, max-age=300, stale-while-revalidate=60'
  : 'public, max-age=0, must-revalidate';
const PUBLIC_API_CACHE_CONTROL = IS_PRODUCTION
  ? 'public, max-age=60, stale-while-revalidate=300'
  : 'no-store, no-cache, must-revalidate, private';
const STATIC_IMAGE_EXT_PATTERN = /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i;
const STATIC_VIDEO_EXT_PATTERN = /\.(?:mp4|webm)$/i;
const STATIC_SCRIPT_STYLE_PATTERN = /\.(?:css|js)$/i;
const POPUP_SETTINGS_CACHE_TTL_MS = 1000 * 60;
const popupSettingsCache = {
  value: null,
  expiresAt: 0,
};
const GALLERY_ALBUM_CACHE_TTL_MS = 1000 * 15;
const RESULT_CACHE_TTL_MS = 1000 * 60 * 5;
const resultLookupCache = new Map();
const galleryAlbumsCache = new Map();
const galleryHiddenPhotosCache = {
  value: null,
  sourcePath: '',
  mtimeMs: 0,
};
const galleryMediaSettingsCache = {
  value: null,
  sourcePath: '',
  mtimeMs: 0,
};
const teachersDataCache = {
  value: null,
  sourcePath: '',
  mtimeMs: 0,
};
const TEACHERS_DATA_PATH = path.join(MUTABLE_DATA_DIR, 'teachers.json');
const GALLERY_HIDDEN_PHOTOS_SOURCE_PATHS = uniqueResolvedPaths([
  path.join(MUTABLE_DATA_DIR, 'gallery-hidden-photos.json'),
  path.join(MUTABLE_PHOTO_DIR, '.gallery-hidden-photos.json'),
  ...READ_ONLY_STORAGE_DATA_DIRS.map((dataDir) => path.join(dataDir, 'gallery-hidden-photos.json')),
  ...READ_ONLY_STORAGE_PHOTO_DIRS.map((photoDir) => path.join(photoDir, '.gallery-hidden-photos.json')),
  path.join(BACKEND_DATA_DIR, 'gallery-hidden-photos.json'),
  path.join(FRONTEND_PHOTO_DIR, '.gallery-hidden-photos.json'),
]);
const GALLERY_HIDDEN_PHOTOS_PREFERRED_PATH =
  GALLERY_HIDDEN_PHOTOS_SOURCE_PATHS[0] || path.join(MUTABLE_DATA_DIR, 'gallery-hidden-photos.json');
const GALLERY_MEDIA_SETTINGS_SOURCE_PATHS = uniqueResolvedPaths([
  path.join(MUTABLE_DATA_DIR, 'gallery-media-settings.json'),
  path.join(MUTABLE_PHOTO_DIR, '.gallery-media-settings.json'),
  ...READ_ONLY_STORAGE_DATA_DIRS.map((dataDir) => path.join(dataDir, 'gallery-media-settings.json')),
  ...READ_ONLY_STORAGE_PHOTO_DIRS.map((photoDir) => path.join(photoDir, '.gallery-media-settings.json')),
  path.join(BACKEND_DATA_DIR, 'gallery-media-settings.json'),
  path.join(FRONTEND_PHOTO_DIR, '.gallery-media-settings.json'),
]);
const GALLERY_MEDIA_SETTINGS_PREFERRED_PATH =
  GALLERY_MEDIA_SETTINGS_SOURCE_PATHS[0] || path.join(MUTABLE_DATA_DIR, 'gallery-media-settings.json');
const TEACHER_PHOTO_DIR = path.join(MUTABLE_PHOTO_DIR, 'Teacher');
const MAX_TEACHER_PHOTO_UPLOAD_BYTES = 8 * 1024 * 1024;
const GALLERY_PHOTO_DIR = MUTABLE_PHOTO_DIR;
const LOCAL_GALLERY_PHOTO_DIR = path.join(DEFAULT_LOCAL_STORAGE_DIR, 'photos');
const GALLERY_MUTATION_TARGET_DIRS = uniqueResolvedPaths([GALLERY_PHOTO_DIR, LOCAL_GALLERY_PHOTO_DIR]);
const MAX_GALLERY_PHOTO_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_GALLERY_VIDEO_UPLOAD_BYTES = 15 * 1024 * 1024;
const MIN_GALLERY_VIDEO_UPLOAD_BYTES = 64 * 1024;
const MAX_GALLERY_THUMB_UPLOAD_BYTES = 1024 * 1024;
const GALLERY_THUMBNAIL_DIR_NAME = '_thumbs';
const GALLERY_TRASH_DIR_NAME = '.gallery-trash';
const GALLERY_MIRROR_MARKER_FILE_NAME = '.mirror-ready';
const GALLERY_CACHE_SIGNAL_FILE_NAME = '.gallery-cache-signal';
const GALLERY_CACHE_SIGNAL_PATH = path.join(GALLERY_PHOTO_DIR, GALLERY_CACHE_SIGNAL_FILE_NAME);
const HAS_SEPARATE_MUTABLE_GALLERY_STORAGE =
  path.resolve(GALLERY_PHOTO_DIR) !== path.resolve(FRONTEND_PHOTO_DIR);
const GALLERY_IGNORED_DIRS = new Set(['teacher', 'management', 'collage higlight', GALLERY_THUMBNAIL_DIR_NAME]);
const PROJECT_REFERENCE_SOURCE_EXTENSIONS = new Set(['.ejs', '.html', '.js']);
const PROJECT_REFERENCE_IGNORED_DIRS = new Set(['.git', '.edge-tmp', 'data', 'node_modules', 'photos']);
const TEACHER_PHOTO_EXTENSION_BY_MIME = Object.freeze({
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});
const TEACHER_PHOTO_ALLOWED_EXTENSIONS = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp']);
const GALLERY_VIDEO_EXTENSION_BY_MIME = Object.freeze({
  'video/mp4': '.mp4',
  'video/webm': '.webm',
});
const GALLERY_VIDEO_ALLOWED_EXTENSIONS = new Set(['.mp4', '.webm']);
const GALLERY_IMAGE_ALLOWED_MIME_TYPES = new Set(['image/gif', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const GALLERY_VIDEO_ALLOWED_MIME_TYPES = new Set(['video/mp4', 'video/webm']);
const MONGO_MAX_POOL_SIZE = Number(process.env.MONGO_MAX_POOL_SIZE || 10);
const MONGO_MIN_POOL_SIZE = Number(process.env.MONGO_MIN_POOL_SIZE || 2);
const MONGO_SERVER_SELECTION_TIMEOUT_MS = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000);
const MONGO_SOCKET_TIMEOUT_MS = Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000);
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_MS || 30 * 60 * 1000); // default 30 minutes
const SESSION_TTL_SECONDS = Math.max(60, Math.floor(SESSION_MAX_AGE_MS / 1000));
const ADMIN_SESSION_IDLE_TIMEOUT_MS = Number(process.env.ADMIN_SESSION_IDLE_TIMEOUT_MS || 10 * 60 * 1000);
const ADMIN_SESSION_ABSOLUTE_TIMEOUT_MS = Number(
  process.env.ADMIN_SESSION_ABSOLUTE_TIMEOUT_MS || 2 * 60 * 60 * 1000
);
const ADMIN_PERSIST_SESSION_COOKIE =
  String(process.env.ADMIN_PERSIST_SESSION_COOKIE || 'false').trim().toLowerCase() === 'true';
const ADMIN_DASHBOARD_FRESH_AUTH_WINDOW_MS = Number(
  process.env.ADMIN_DASHBOARD_FRESH_AUTH_WINDOW_MS || 5 * 60 * 1000
);
const ADMIN_USERNAME = requireEnv('ADMIN_USERNAME', 'Set ADMIN_USERNAME for the bootstrap admin.');
const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD', 'Set ADMIN_PASSWORD for the bootstrap admin.');
const ADMIN_SEED_ENABLED = process.env.ADMIN_SEED_ENABLED !== 'false';
const CLEAR_DB_SECRET = requireEnv('CLEAR_DB_SECRET', 'Set CLEAR_DB_SECRET for the clear DB action.');
const ADMIN_LOGIN_ALLOWED_IDENTITIES = new Set(
  String(process.env.ADMIN_LOGIN_ALLOWED_IDENTITIES || '')
    .split(',')
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
);
const ADMIN_PASSWORD_FALLBACK_HASH = bcrypt.hashSync(
  `${SESSION_SECRET}:admin-login-fallback`,
  ADMIN_PASSWORD_HASH_ROUNDS
);
const ADMISSION_EMAIL_TO = String(process.env.ADMISSION_EMAIL_TO || 'nischalp258@gmail.com').trim() || 'nischalp258@gmail.com';
const ADMISSION_EMAIL_FROM = String(
  process.env.ADMISSION_EMAIL_FROM || `Kankai Secondary School <${ADMISSION_EMAIL_TO}>`
).trim();
const SMTP_HOST = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.SMTP_SECURE || (SMTP_PORT === 465 ? 'true' : 'false'))
    .trim()
    .toLowerCase()
);
const SMTP_USER = String(process.env.SMTP_USER || ADMISSION_EMAIL_TO).trim();
const RAW_SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const SMTP_PASS = isGmailSmtpHost(SMTP_HOST) ? RAW_SMTP_PASS.replace(/\s+/g, '') : RAW_SMTP_PASS;
const SMTP_CONNECTION_TIMEOUT_MS = Math.max(1000, Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000));
const SMTP_GREETING_TIMEOUT_MS = Math.max(1000, Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000));
const SMTP_SOCKET_TIMEOUT_MS = Math.max(1000, Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 25000));
const OUTBOUND_MAIL_QUEUE_LIMIT = Math.max(10, Number(process.env.OUTBOUND_MAIL_QUEUE_LIMIT || 40));
const OUTBOUND_MAIL_DELIVERY_TIMEOUT_MS = Math.max(5000, Number(process.env.OUTBOUND_MAIL_DELIVERY_TIMEOUT_MS || 30000));
const MAX_ADMISSION_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const ADMISSION_ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const ADMISSION_ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ADMISSION_ALLOWED_DOCUMENT_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);
const ADMISSION_ALLOWED_PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ADMISSION_REQUESTS_DIR = path.join(MUTABLE_DATA_DIR, 'admission-requests');
let admissionMailer = null;
let admissionMailerCacheKey = '';
let admissionMailerAuthFailed = false;
const outboundMailQueue = [];
let outboundMailQueueActive = false;
const admissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 2,
    fileSize: MAX_ADMISSION_ATTACHMENT_BYTES,
  },
  fileFilter(req, file, callback) {
    const fieldName = String(file.fieldname || '').trim();
    const contentType = String(file.mimetype || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const extension = path.extname(String(file.originalname || '')).trim().toLowerCase();

    if (fieldName === 'latestGradeSheet') {
      if (ADMISSION_ALLOWED_DOCUMENT_MIME_TYPES.has(contentType) || ADMISSION_ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) {
        callback(null, true);
        return;
      }
      callback(new Error('Use PDF, JPG, PNG, or WEBP for the latest grade sheet.'));
      return;
    }

    if (fieldName === 'studentPhoto') {
      if (ADMISSION_ALLOWED_PHOTO_MIME_TYPES.has(contentType) || ADMISSION_ALLOWED_PHOTO_EXTENSIONS.has(extension)) {
        callback(null, true);
        return;
      }
      callback(new Error('Use JPG, PNG, or WEBP for the student photo.'));
      return;
    }

    callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', fieldName));
  },
});

const galleryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 2,
    fileSize: Math.max(MAX_GALLERY_PHOTO_UPLOAD_BYTES, MAX_GALLERY_VIDEO_UPLOAD_BYTES),
  },
  fileFilter(req, file, callback) {
    const fieldName = String(file.fieldname || '').trim();
    const contentType = String(file.mimetype || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const extension = path.extname(String(file.originalname || '')).trim().toLowerCase();

    if (fieldName !== 'photo' && fieldName !== 'thumbnail') {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', fieldName));
      return;
    }

    if (fieldName === 'thumbnail') {
      if (GALLERY_IMAGE_ALLOWED_MIME_TYPES.has(contentType) || TEACHER_PHOTO_ALLOWED_EXTENSIONS.has(extension)) {
        callback(null, true);
        return;
      }

      callback(new Error('Use JPG, PNG, WEBP, or GIF for gallery thumbnails.'));
      return;
    }

    if (
      GALLERY_IMAGE_ALLOWED_MIME_TYPES.has(contentType) ||
      GALLERY_VIDEO_ALLOWED_MIME_TYPES.has(contentType) ||
      TEACHER_PHOTO_ALLOWED_EXTENSIONS.has(extension) ||
      GALLERY_VIDEO_ALLOWED_EXTENSIONS.has(extension)
    ) {
      callback(null, true);
      return;
    }

    callback(new Error('Use JPG, PNG, WEBP, GIF, MP4, or WEBM files only.'));
  },
});

function getCachedResult(symbolNumber) {
  const key = String(symbolNumber || '').trim().toUpperCase();
  if (!key) return undefined;

  const entry = resultLookupCache.get(key);
  if (!entry) return undefined;

  if (Date.now() > entry.expiresAt) {
    resultLookupCache.delete(key);
    return undefined;
  }

  return entry.value;
}

function setCachedResult(symbolNumber, value) {
  const key = String(symbolNumber || '').trim().toUpperCase();
  if (!key) return;
  resultLookupCache.set(key, {
    value,
    expiresAt: Date.now() + RESULT_CACHE_TTL_MS,
  });
}

function clearResultCache() {
  resultLookupCache.clear();
}

function normalizeMongoUri(uri) {
  return String(uri || '')
    .trim()
    .replace('kanlkai.majlzgy.mongodb.net', 'kankai.majlzgy.mongodb.net');
}

function isMongoSrvLookupFailure(error) {
  const normalizedMessage = String(error?.message || '').toUpperCase();
  const normalizedCode = String(error?.code || '').trim().toUpperCase();
  const lookupDetails = `${normalizedCode} ${normalizedMessage}`;
  return lookupDetails.includes('QUERYSRV') || lookupDetails.includes('_MONGODB._TCP');
}

function getMongoConnectionCandidates() {
  const preferredCandidates = PREFER_DIRECT_MONGODB_URI
    ? [
      { label: 'fallback direct URI', uri: FALLBACK_MONGODB_URI },
      { label: 'primary URI', uri: PRIMARY_MONGODB_URI },
    ]
    : [
      { label: 'primary URI', uri: PRIMARY_MONGODB_URI },
      { label: 'fallback direct URI', uri: FALLBACK_MONGODB_URI },
    ];

  const seen = new Set();
  return preferredCandidates.filter((candidate) => {
    const normalizedUri = String(candidate.uri || '').trim();
    if (!normalizedUri || seen.has(normalizedUri)) {
      return false;
    }

    seen.add(normalizedUri);
    return true;
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeEmailAddress(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

function normalizePhoneNumber(value) {
  return String(value || '')
    .trim()
    .replace(/[^\d+\-\s()]/g, '')
    .slice(0, 40);
}

function formatAdmissionTimestamp(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-NP', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kathmandu',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function isAdmissionMailerConfigured() {
  return Boolean(ADMISSION_EMAIL_TO && ADMISSION_EMAIL_FROM && SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

function isGmailSmtpHost(host) {
  const normalizedHost = String(host || '').trim().toLowerCase();
  return normalizedHost === 'smtp.gmail.com' || normalizedHost === 'gmail.com' || normalizedHost.endsWith('.gmail.com');
}

function getGmailFallbackTransportProfile() {
  if (!isGmailSmtpHost(SMTP_HOST)) return null;

  if (SMTP_PORT === 465 && SMTP_SECURE) {
    return { port: 587, secure: false };
  }

  if (SMTP_PORT === 587 && !SMTP_SECURE) {
    return { port: 465, secure: true };
  }

  return { port: 587, secure: false };
}

function buildAdmissionMailerOptions(profile = null) {
  const activeProfile = profile || { port: SMTP_PORT, secure: SMTP_SECURE };
  const options = {
    host: SMTP_HOST,
    port: activeProfile.port,
    secure: activeProfile.secure,
    requireTLS: !activeProfile.secure,
    family: isGmailSmtpHost(SMTP_HOST) ? 4 : undefined,
    pool: true,
    maxConnections: 3,
    maxMessages: 200,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  };

  Object.keys(options).forEach((key) => {
    if (typeof options[key] === 'undefined') {
      delete options[key];
    }
  });

  return options;
}

function getAdmissionMailer(profile = null) {
  const options = buildAdmissionMailerOptions(profile);
  const cacheKey = JSON.stringify({
    host: options.host,
    port: options.port,
    secure: options.secure,
    requireTLS: options.requireTLS,
    user: options.auth.user,
  });

  if (admissionMailer && admissionMailerCacheKey === cacheKey) {
    return admissionMailer;
  }

  resetAdmissionMailer();
  admissionMailer = nodemailer.createTransport(options);
  admissionMailerCacheKey = cacheKey;
  return admissionMailer;
}

function resetAdmissionMailer() {
  if (!admissionMailer) return;
  try {
    admissionMailer.close();
  } catch (error) {
    // Ignore close errors while resetting the transport.
  }
  admissionMailer = null;
  admissionMailerCacheKey = '';
}

function isSmtpAuthError(error) {
  const responseCode = Number(error && error.responseCode);
  const code = String((error && error.code) || '').toUpperCase();
  const command = String((error && error.command) || '').toUpperCase();
  const message = String((error && error.message) || '').toLowerCase();

  return (
    responseCode === 535 ||
    code === 'EAUTH' ||
    command === 'AUTH' ||
    message.includes('invalid login') ||
    message.includes('username and password not accepted') ||
    message.includes('badcredentials')
  );
}

function markAdmissionMailerAuthFailure(error) {
  if (!isSmtpAuthError(error)) return false;
  admissionMailerAuthFailed = true;
  return true;
}

function foldBase64(value) {
  return String(value || '').replace(/.{1,76}/g, '$&\r\n').trimEnd();
}

function encodeMailHeader(value) {
  const text = String(value || '').replace(/[\r\n]+/g, ' ').trim();
  return /^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function buildCurlMailMessage(mailOptions) {
  const boundary = `kankai-${crypto.randomBytes(12).toString('hex')}`;
  const from = encodeMailHeader(mailOptions.from || SMTP_USER);
  const to = encodeMailHeader(mailOptions.to || ADMISSION_EMAIL_TO);
  const replyTo = mailOptions.replyTo ? encodeMailHeader(mailOptions.replyTo) : '';
  const subject = encodeMailHeader(mailOptions.subject || 'Kankai Website Message');
  const text = String(mailOptions.text || '').replace(/\r?\n/g, '\r\n');
  const html = String(mailOptions.html || '').replace(/\r?\n/g, '\r\n');
  const attachments = Array.isArray(mailOptions.attachments) ? mailOptions.attachments : [];

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ];

  if (replyTo) {
    lines.push(`Reply-To: ${replyTo}`);
  }

  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`, '');
  lines.push(`--${boundary}`);
  lines.push('Content-Type: multipart/alternative; boundary="alt-' + boundary + '"', '');
  lines.push(`--alt-${boundary}`);
  lines.push('Content-Type: text/plain; charset=UTF-8');
  lines.push('Content-Transfer-Encoding: 8bit', '', text, '');
  lines.push(`--alt-${boundary}`);
  lines.push('Content-Type: text/html; charset=UTF-8');
  lines.push('Content-Transfer-Encoding: 8bit', '', html || escapeHtml(text).replace(/\r\n/g, '<br>'), '');
  lines.push(`--alt-${boundary}--`, '');

  attachments.forEach((attachment) => {
    const filename = encodeMailHeader(path.basename(String(attachment.filename || 'attachment')));
    const contentType = String(attachment.contentType || 'application/octet-stream').replace(/[\r\n;]/g, '') || 'application/octet-stream';
    const content = Buffer.isBuffer(attachment.content)
      ? attachment.content
      : Buffer.from(String(attachment.content || ''), 'utf8');

    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${contentType}; name="${filename}"`);
    lines.push('Content-Transfer-Encoding: base64');
    lines.push(`Content-Disposition: attachment; filename="${filename}"`, '');
    lines.push(foldBase64(content.toString('base64')), '');
  });

  lines.push(`--${boundary}--`, '');
  return lines.join('\r\n');
}

function sendMailWithCurl(mailOptions) {
  return new Promise((resolve, reject) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kankai-mail-'));
    const messagePath = path.join(tempDir, 'message.eml');
    fs.writeFileSync(messagePath, buildCurlMailMessage(mailOptions), 'utf8');

    const args = [
      '--silent',
      '--show-error',
      '--url',
      `smtp://${SMTP_HOST}:${SMTP_PORT}`,
      '--ssl-reqd',
      '--mail-from',
      SMTP_USER,
      '--mail-rcpt',
      String(mailOptions.to || ADMISSION_EMAIL_TO),
      '--user',
      `${SMTP_USER}:${SMTP_PASS}`,
      '--upload-file',
      messagePath,
      '--max-time',
      String(Math.ceil(OUTBOUND_MAIL_DELIVERY_TIMEOUT_MS / 1000)),
    ];

    const child = spawn('curl.exe', args, { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch { }
      reject(error);
    });

    child.on('close', (code) => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch { }

      if (code === 0) {
        resolve(true);
        return;
      }

      reject(new Error(stderr.trim() || `curl SMTP exited with code ${code}`));
    });
  });
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timerId = setTimeout(() => {
      reject(new Error(timeoutMessage || 'Operation timed out.'));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timerId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timerId);
        reject(error);
      });
  });
}

async function sendQueuedMailJob(job) {
  const fallbackProfile = getGmailFallbackTransportProfile();

  if (isGmailSmtpHost(SMTP_HOST)) {
    try {
      await sendMailWithCurl(job.mailOptions);
      return true;
    } catch (curlError) {
      console.error(`curl SMTP failed for ${job.label}:`, curlError);
      if (markAdmissionMailerAuthFailure(curlError)) {
        return false;
      }
      return false;
    }
  }

  try {
    await withTimeout(
      getAdmissionMailer().sendMail(job.mailOptions),
      OUTBOUND_MAIL_DELIVERY_TIMEOUT_MS,
      `${job.label || 'Email delivery'} timed out.`
    );
    return true;
  } catch (error) {
    console.error(`Failed to send ${job.label}:`, error);
    resetAdmissionMailer();
    if (markAdmissionMailerAuthFailure(error)) {
      return false;
    }
  }

  if (fallbackProfile) {
    try {
      await withTimeout(
        getAdmissionMailer(fallbackProfile).sendMail(job.mailOptions),
        OUTBOUND_MAIL_DELIVERY_TIMEOUT_MS,
        `${job.label || 'Email delivery'} timed out on Gmail fallback.`
      );
      return true;
    } catch (fallbackError) {
      console.error(`Gmail fallback failed for ${job.label}:`, fallbackError);
      resetAdmissionMailer();
      if (markAdmissionMailerAuthFailure(fallbackError)) {
        return false;
      }
    }
  }

  try {
    await withTimeout(
      getAdmissionMailer().sendMail(job.mailOptions),
      OUTBOUND_MAIL_DELIVERY_TIMEOUT_MS,
      `${job.label || 'Email delivery'} timed out on retry.`
    );
    return true;
  } catch (retryError) {
    console.error(`Retry failed for ${job.label}:`, retryError);
    resetAdmissionMailer();
    markAdmissionMailerAuthFailure(retryError);
    return false;
  }
}

async function processOutboundMailQueue() {
  if (outboundMailQueueActive) return;
  outboundMailQueueActive = true;

  try {
    while (outboundMailQueue.length > 0) {
      const job = outboundMailQueue.shift();
      if (!job) {
        break;
      }
      const sent = await sendQueuedMailJob(job);
      if (typeof job.resolveDelivery === 'function') {
        job.resolveDelivery(sent);
      }
    }
  } finally {
    outboundMailQueueActive = false;
    if (outboundMailQueue.length > 0) {
      setImmediate(() => {
        void processOutboundMailQueue();
      });
    }
  }
}

function enqueueOutboundMail(mailOptions, label) {
  if (outboundMailQueue.length >= OUTBOUND_MAIL_QUEUE_LIMIT) {
    return null;
  }

  let resolveDelivery = null;
  const deliveryPromise = new Promise((resolve) => {
    resolveDelivery = resolve;
  });

  outboundMailQueue.push({
    mailOptions,
    label: label || 'email',
    resolveDelivery,
  });

  setImmediate(() => {
    void processOutboundMailQueue();
  });

  return deliveryPromise;
}

function warmAdmissionMailer() {
  if (!isAdmissionMailerConfigured()) {
    return;
  }

  if (isGmailSmtpHost(SMTP_HOST)) {
    admissionMailerAuthFailed = false;
    return;
  }

  setImmediate(async () => {
    try {
      await getAdmissionMailer().verify();
      admissionMailerAuthFailed = false;
    } catch (error) {
      console.warn('Admission mailer warmup failed:', error instanceof Error ? error.message : error);
      resetAdmissionMailer();
      markAdmissionMailerAuthFailure(error);
    }
  });
}

function getUploadedAdmissionFile(files, fieldName) {
  const entries = files && Array.isArray(files[fieldName]) ? files[fieldName] : [];
  return entries[0] || null;
}

function buildAdmissionMailPayload(submission) {
  const submittedAtLabel = formatAdmissionTimestamp(submission.submittedAt);
  const subject = `New Admission Request: ${submission.studentName} (${submission.applyingGrade})`;
  const notesText = submission.additionalNotes || 'None provided';
  const attachmentSummary = [
    `Latest Grade Sheet: ${submission.latestGradeSheet.originalname}`,
    `Student Photo: ${submission.studentPhoto.originalname}`,
  ].join('\n');

  const text = [
    'A new admission request was submitted.',
    '',
    `Submitted At: ${submittedAtLabel}`,
    `Student Name: ${submission.studentName}`,
    `Applying Grade: ${submission.applyingGrade}`,
    `Date of Birth: ${submission.dateOfBirth}`,
    `Previous School: ${submission.previousSchool || 'Not provided'}`,
    `Parent/Guardian Name: ${submission.parentName}`,
    `Phone Number: ${submission.phoneNumber}`,
    `Email: ${submission.email}`,
    `Address: ${submission.address}`,
    '',
    'Additional Notes:',
    notesText,
    '',
    'Attachments:',
    attachmentSummary,
  ].join('\n');

  const htmlRows = [
    ['Submitted At', submittedAtLabel],
    ['Student Name', submission.studentName],
    ['Applying Grade', submission.applyingGrade],
    ['Date of Birth', submission.dateOfBirth],
    ['Previous School', submission.previousSchool || 'Not provided'],
    ['Parent/Guardian Name', submission.parentName],
    ['Phone Number', submission.phoneNumber],
    ['Email', submission.email],
    ['Address', submission.address],
    ['Latest Grade Sheet', submission.latestGradeSheet.originalname],
    ['Student Photo', submission.studentPhoto.originalname],
  ]
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:8px 12px;background:#f4f8fc;border:1px solid #d9e4ef;">${escapeHtml(
          label
        )}</th><td style="padding:8px 12px;border:1px solid #d9e4ef;">${escapeHtml(value)}</td></tr>`
    )
    .join('');

  const html = [
    '<div style="font-family:Arial,sans-serif;color:#17324a;line-height:1.6;">',
    '  <h2 style="margin:0 0 14px;color:#114a7d;">New Admission Request</h2>',
    '  <table style="border-collapse:collapse;width:100%;max-width:760px;">',
    htmlRows,
    '  </table>',
    '  <div style="margin-top:16px;">',
    '    <strong>Additional Notes</strong>',
    `    <p style="margin:8px 0 0;">${escapeHtml(notesText)}</p>`,
    '  </div>',
    '</div>',
  ].join('\n');

  return { subject, text, html };
}

function getSafeAdmissionFileName(file, fallbackName) {
  const originalName = path.basename(String(file?.originalname || fallbackName || 'attachment').trim());
  const extension = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, extension)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'attachment';

  return `${baseName}${extension}`;
}

function saveAdmissionRequest(submission) {
  const submittedAt = submission.submittedAt instanceof Date ? submission.submittedAt : new Date();
  const requestId = `${submittedAt.toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;
  const requestDir = path.join(ADMISSION_REQUESTS_DIR, requestId);
  fs.mkdirSync(requestDir, { recursive: true });

  const latestGradeSheetName = getSafeAdmissionFileName(submission.latestGradeSheet, 'latest-grade-sheet');
  const studentPhotoName = getSafeAdmissionFileName(submission.studentPhoto, 'student-photo');

  fs.writeFileSync(path.join(requestDir, latestGradeSheetName), submission.latestGradeSheet.buffer);
  fs.writeFileSync(path.join(requestDir, studentPhotoName), submission.studentPhoto.buffer);

  const savedRequest = {
    id: requestId,
    submittedAt: submittedAt.toISOString(),
    studentName: submission.studentName,
    applyingGrade: submission.applyingGrade,
    dateOfBirth: submission.dateOfBirth,
    previousSchool: submission.previousSchool,
    parentName: submission.parentName,
    phoneNumber: submission.phoneNumber,
    email: submission.email,
    address: submission.address,
    additionalNotes: submission.additionalNotes,
    files: {
      latestGradeSheet: latestGradeSheetName,
      studentPhoto: studentPhotoName,
    },
    emailStatus: 'queued',
  };

  fs.writeFileSync(path.join(requestDir, 'request.json'), JSON.stringify(savedRequest, null, 2), 'utf8');
  return savedRequest;
}

function buildContactMailPayload(submission) {
  const submittedAtLabel = formatAdmissionTimestamp(submission.submittedAt);
  const contactMessage = submission.message || 'None provided';
  const subject = `New Contact Inquiry: ${submission.subject}`;

  const text = [
    'A new contact inquiry was submitted.',
    '',
    `Submitted At: ${submittedAtLabel}`,
    `Full Name: ${submission.fullName}`,
    `Email: ${submission.email}`,
    `Phone Number: ${submission.phoneNumber}`,
    `Subject: ${submission.subject}`,
    '',
    'Message:',
    contactMessage,
  ].join('\n');

  const htmlRows = [
    ['Submitted At', submittedAtLabel],
    ['Full Name', submission.fullName],
    ['Email', submission.email],
    ['Phone Number', submission.phoneNumber],
    ['Subject', submission.subject],
  ]
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:8px 12px;background:#f4f8fc;border:1px solid #d9e4ef;">${escapeHtml(
          label
        )}</th><td style="padding:8px 12px;border:1px solid #d9e4ef;">${escapeHtml(value)}</td></tr>`
    )
    .join('');

  const html = [
    '<div style="font-family:Arial,sans-serif;color:#17324a;line-height:1.6;">',
    '  <h2 style="margin:0 0 14px;color:#114a7d;">New Contact Inquiry</h2>',
    '  <table style="border-collapse:collapse;width:100%;max-width:760px;">',
    htmlRows,
    '  </table>',
    '  <div style="margin-top:16px;">',
    '    <strong>Message</strong>',
    `    <p style="margin:8px 0 0;white-space:pre-wrap;">${escapeHtml(contactMessage)}</p>`,
    '  </div>',
    '</div>',
  ].join('\n');

  return { subject, text, html };
}

function runAdmissionUpload(req, res) {
  return new Promise((resolve, reject) => {
    admissionUpload.fields([
      { name: 'latestGradeSheet', maxCount: 1 },
      { name: 'studentPhoto', maxCount: 1 },
    ])(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function slugifyTeacherName(value, fallback = 'teacher') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function slugifyAssetName(value, fallback = 'asset') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function getTeacherPhotoExtension(contentType, originalFileName) {
  const normalizedType = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (TEACHER_PHOTO_EXTENSION_BY_MIME[normalizedType]) {
    return TEACHER_PHOTO_EXTENSION_BY_MIME[normalizedType];
  }

  const originalExtension = path.extname(String(originalFileName || '')).trim().toLowerCase();
  if (TEACHER_PHOTO_ALLOWED_EXTENSIONS.has(originalExtension)) {
    return originalExtension === '.jpeg' ? '.jpg' : originalExtension;
  }

  return '';
}

function normalizeAssetPath(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
}

function getTeacherRoleText(teacher) {
  return String(teacher?.role || teacher?.position || '').trim();
}

function normalizeTeacherSectionValue(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  if (normalized === 'management' || normalized === 'management-committee') {
    return 'management';
  }
  if (normalized === 'administrative' || normalized === 'administrative-staff' || normalized === 'admin-staff') {
    return 'administrative';
  }
  if (normalized === 'faculty' || normalized === 'faculty-members' || normalized === 'teacher' || normalized === 'teachers') {
    return 'faculty';
  }
  return '';
}

const TEACHER_DEPARTMENTS = Object.freeze([
  'Computer Engineering',
  'Nepali',
  'English',
  'Mathematics',
  'Science',
  'Social Studies',
  'Economics',
  'Business Studies',
  'Physical Education',
  'Office Staff',
  'Leadership',
]);

function normalizeTeacherDepartmentValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return TEACHER_DEPARTMENTS.find((department) => department.toLowerCase() === normalized) || '';
}

function applyTeacherSectionPlacement(teachers, teacher, requestedPosition) {
  const teacherSection = inferTeacherSection(teacher);
  const teacherDepartment = inferTeacherDepartment(teacher);
  const peers = teachers
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (item === teacher || item?.id === teacher?.id) return false;
      if (inferTeacherSection(item) !== teacherSection) return false;
      return teacherSection !== 'faculty' || inferTeacherDepartment(item) === teacherDepartment;
    })
    .sort((left, right) => {
      const leftOrder = Number(left.item?.departmentOrder);
      const rightOrder = Number(right.item?.departmentOrder);
      const leftHasOrder = Number.isFinite(leftOrder) && leftOrder > 0;
      const rightHasOrder = Number.isFinite(rightOrder) && rightOrder > 0;
      if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
      if (leftHasOrder !== rightHasOrder) return leftHasOrder ? -1 : 1;
      return left.index - right.index;
    })
    .map(({ item }) => item);

  const safePosition = Number.isInteger(requestedPosition) && requestedPosition > 0
    ? Math.min(requestedPosition, peers.length + 1)
    : peers.length + 1;
  peers.splice(safePosition - 1, 0, teacher);
  peers.forEach((item, index) => {
    item.departmentOrder = (index + 1) * 10;
  });
}

function getGalleryMediaExtension(contentType, originalFileName) {
  const normalizedType = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (TEACHER_PHOTO_EXTENSION_BY_MIME[normalizedType]) {
    return TEACHER_PHOTO_EXTENSION_BY_MIME[normalizedType];
  }

  if (GALLERY_VIDEO_EXTENSION_BY_MIME[normalizedType]) {
    return GALLERY_VIDEO_EXTENSION_BY_MIME[normalizedType];
  }

  const originalExtension = path.extname(String(originalFileName || '')).trim().toLowerCase();
  if (TEACHER_PHOTO_ALLOWED_EXTENSIONS.has(originalExtension)) {
    return originalExtension === '.jpeg' ? '.jpg' : originalExtension;
  }

  if (GALLERY_VIDEO_ALLOWED_EXTENSIONS.has(originalExtension)) {
    return originalExtension;
  }

  return '';
}

function detectGalleryVideoExtension(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return '';
  }

  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    return '.mp4';
  }

  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return '.webm';
  }

  return '';
}

function normalizeTeacherRoleValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getTeacherExclusiveRoleKeyFromRole(role) {
  const normalizedRole = normalizeTeacherRoleValue(role);
  if (!normalizedRole) return '';
  if (
    normalizedRole === 'principal' ||
    normalizedRole === 'headmaster' ||
    normalizedRole === 'head teacher' ||
    (/principal/.test(normalizedRole) && !/vice/.test(normalizedRole))
  ) {
    return 'principal';
  }
  if (/vice principal/.test(normalizedRole)) {
    return 'vice-principal';
  }
  if (/coordinator/.test(normalizedRole)) {
    return 'coordinator';
  }
  return '';
}

function getTeacherExclusiveRoleKey(teacher) {
  return getTeacherExclusiveRoleKeyFromRole(getTeacherRoleText(teacher));
}

function getTeacherExclusiveRoleLabel(roleKey) {
  if (roleKey === 'principal') return 'Principal';
  if (roleKey === 'vice-principal') return 'Vice Principal';
  if (roleKey === 'coordinator') return 'Coordinator';
  return 'Teacher';
}

function normalizeTeacherRosterName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/\b(er|mr|mrs|ms|miss|dr)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TEACHER_PUBLIC_ROSTER_ORDER = Object.freeze([
  ['hariprasad paudyal', 'hari paudyal'],
  ['khemraj limbu', 'khem limbu'],
  ['teknath neupane'],
  ['bikash rai'],
  ['taranath khanal'],
  ['prakashchandra ghimire', 'prakash chandra ghimire'],
  ['vijay tamang', 'vijaya tamang'],
  ['vishwamano khanal', 'bishwa khanal'],
  ['suraj kavirath', 'suraj kabirath'],
  ['milan poudel'],
  ['madhusudan nepal', 'madhu sudan nepal'],
  ['dipendra dhamal', 'er dipendra dhamal'],
  ['khyam bahadur thandari', 'khyam bhandari', 'khyam bahadur bhandari'],
  ['manish nepal'],
  ['sameer wagle'],
  ['keshab pokhrel', 'kesheb pokhrel', 'prajwal pokharel', 'er prajwal pokharel'],
  ['vijay lawati', 'bijaya lawati'],
  ['dipendra kumari ghimire'],
  ['anjana bastola'],
  ['kanchan majhi'],
  ['chetan khatri', 'chetan khatri'],
  ['ek bahadur karki', 'dik bahadur karki'],
  ['savitra khadka', 'sabitra khadka'],
  ['khagindra basnet', 'khagendra basnet'],
  ['dilli ram magar'],
  ['khadg prasad dulal', 'khadga prasad dulal'],
  ['tila ullabh khatiwada', 'lila ballav khatiwada'],
  ['harinarayan shah', 'hari narayan sal', 'hari narayan shah'],
  ['madan prasad dhital'],
  ['prabhadevi niraula'],
  ['vishnumani shrestha', 'bisnu shrestha'],
  ['man kumari idhingo', 'mankumari edhingo'],
  ['ganga bahadur chemjong'],
  ['parbata phuyel', 'parbata phyual', 'parbata phuyal'],
  ['milan acharya'],
  ['sudha ghimire'],
  ['anjana shrestha'],
  ['shushma rakharka'],
  ['pugvir rai'],
  ['punam lago'],
]);

const TEACHER_PUBLIC_ROSTER_LOOKUP = new Map();
TEACHER_PUBLIC_ROSTER_ORDER.forEach((aliases, index) => {
  aliases.forEach((alias) => {
    const normalizedAlias = normalizeTeacherRosterName(alias);
    if (normalizedAlias) {
      TEACHER_PUBLIC_ROSTER_LOOKUP.set(normalizedAlias, index);
    }
  });
});

function getTeacherRosterOrderIndex(teacher) {
  const normalizedName = normalizeTeacherRosterName(teacher?.name);
  if (!normalizedName) {
    return Number.POSITIVE_INFINITY;
  }

  return TEACHER_PUBLIC_ROSTER_LOOKUP.has(normalizedName)
    ? TEACHER_PUBLIC_ROSTER_LOOKUP.get(normalizedName)
    : Number.POSITIVE_INFINITY;
}

function orderTeachersForPublicRoster(teachers) {
  if (!Array.isArray(teachers)) return [];

  return teachers
    .map((teacher, index) => ({
      teacher,
      index,
      order: getTeacherRosterOrderIndex(teacher),
    }))
    .filter(({ teacher }) => teacher && typeof teacher === 'object')
    .sort((left, right) => left.order - right.order || left.index - right.index)
    .map(({ teacher }) => teacher);
}

const DEFAULT_MANAGEMENT_COMMITTEE_TEACHERS = Object.freeze([
  ['management-1', 'Mr. Krishna Kumar Khaki', 'photos/management/1.jpg', 'Chairperson'],
  ['management-2', 'Mr. Radhakrishna Adhikari', 'photos/management/2.jpg', 'Member'],
  ['management-3', 'Mr. Gyan Bahadur Katwal', 'photos/management/3.jpg', 'Member'],
  ['management-4', 'Mrs. Maya Bhandari', 'photos/management/4.jpg', 'Member'],
  ['management-5', 'Mrs. Omadevi Dulal', 'photos/management/5.jpg', 'Member'],
  ['management-6', 'Mr. Ram Bahadur Thapa', 'photos/management/6.jpg', 'Member'],
  ['management-7', 'Mrs. Dhankumari Rai', 'photos/management/7.jpg', 'Member'],
  ['management-8', 'Mr. Ganga Bahadur Chemjong', 'photos/management/8.jpg', 'Member'],
  ['management-9', 'Mr. Prem Bahadur Karki', 'photos/management/9.jpg', 'Member'],
  ['management-10', 'Mr. Dhan Bahadur Karki', 'photos/management/10.jpg', 'Member'],
  ['management-11', 'Mr. Hari Prasad Paudyal', 'photos/management/11.jpg', 'Member Secretary'],
]).map(([id, name, img, role]) =>
  Object.freeze({
    id,
    name,
    img,
    alt: name,
    role,
    section: 'management',
  })
);

function ensureManagementCommitteeTeachers(teachers) {
  if (!Array.isArray(teachers)) return false;

  const hasManagementRecord = teachers.some((teacher) => inferTeacherSection(teacher) === 'management');
  if (hasManagementRecord) return false;

  DEFAULT_MANAGEMENT_COMMITTEE_TEACHERS.forEach((teacher) => {
    teachers.push({ ...teacher });
  });
  return true;
}

function inferTeacherDepartment(teacher) {
  const manualDepartment = String(teacher?.department || '').trim();
  if (manualDepartment) return manualDepartment;
  const exclusiveRoleKey = getTeacherExclusiveRoleKey(teacher);
  if (exclusiveRoleKey) {
    return 'Leadership';
  }
  const role = String(teacher?.role || '').toLowerCase();
  const qualification = String(teacher?.qualification || '').toLowerCase();
  const position = String(teacher?.position || '').toLowerCase();
  const combined = `${role} ${qualification} ${position}`.toLowerCase();
  if (/computer|ict/.test(qualification)) return 'Computer Engineering';
  if (/english/.test(qualification)) return 'English';
  if (/math/.test(qualification)) return 'Mathematics';
  if (/i-com/.test(qualification)) return 'Intermediate in Commerce';
  if (/science|physics|chemistry|biology/.test(qualification)) return 'Science';
  if (/accountant|office|security|guard|peon|pune/.test(position) || /accountant|office|security|guard|peon|pune/.test(combined)) return 'Office Staff';
  if (/business|management|finance|i-com|commerce/.test(qualification) || /finance/.test(combined)) {
    return 'Business Studies';
  }
  if (/physical education|health|pe\\b/.test(qualification)) return 'Physical Education';
  if (/nepali/.test(qualification) && /social/.test(qualification)) return 'Social Studies';
  if (/economics/.test(qualification)) return 'Economics';
  if (/social/.test(qualification)) return 'Social Studies';
  if (/nepali/.test(qualification)) return 'Nepali';
  if (/education|management|planning/.test(qualification)) return 'Social Studies';
  return 'Social Studies';
}

function inferTeacherSection(teacher) {
  const manualSection = normalizeTeacherSectionValue(teacher?.section);
  if (manualSection) {
    return manualSection;
  }

  const id = String(teacher?.id || '').trim().toLowerCase();
  const img = normalizeAssetPath(teacher?.img).toLowerCase();
  const role = getTeacherRoleText(teacher).toLowerCase();
  const department = String(teacher?.department || '').trim().toLowerCase();
  const combined = `${id} ${img} ${role} ${department}`;

  if (
    id.startsWith('management-') ||
    img.startsWith('photos/management/') ||
    /management committee|chairperson|member secretary/.test(combined) ||
    (/\bmember\b/.test(role) && img.includes('/management/'))
  ) {
    return 'management';
  }

  if (
    getTeacherExclusiveRoleKey(teacher) ||
    department === 'office staff' ||
    /accountant|librarian|security|guard|peon|office staff|administrative staff/.test(combined)
  ) {
    return 'administrative';
  }

  return 'faculty';
}

function ensureTeacherIds(teachers) {
  let changed = false;
  teachers.forEach((teacher, index) => {
    if (!teacher || typeof teacher !== 'object') return;
    if (!teacher.id) {
      teacher.id = `${slugifyTeacherName(teacher.name)}-${index + 1}`;
      changed = true;
    }
    if (!teacher.role && !teacher.position) {
      teacher.role = 'Teacher';
      changed = true;
    }
    const inferredDepartment = inferTeacherDepartment(teacher);
    if (!teacher.department || (getTeacherExclusiveRoleKey(teacher) && teacher.department !== inferredDepartment)) {
      teacher.department = inferredDepartment;
      changed = true;
    }

    const inferredSection = inferTeacherSection(teacher);
    if (!normalizeTeacherSectionValue(teacher.section) && teacher.section !== inferredSection) {
      teacher.section = inferredSection;
      changed = true;
    }
  });
  return changed;
}

function saveTeachers(teachers) {
  try {
    fs.mkdirSync(path.dirname(TEACHERS_DATA_PATH), { recursive: true });
    fs.writeFileSync(TEACHERS_DATA_PATH, JSON.stringify(teachers, null, 2), 'utf8');
    let mtimeMs = Date.now();
    try {
      mtimeMs = fs.statSync(TEACHERS_DATA_PATH).mtimeMs;
    } catch { }
    teachersDataCache.value = teachers;
    teachersDataCache.sourcePath = path.resolve(TEACHERS_DATA_PATH);
    teachersDataCache.mtimeMs = mtimeMs;
  } catch (error) {
    console.error('Failed to save teachers data:', error);
  }
}

function loadTeachers() {
  for (const sourcePath of TEACHERS_DATA_SOURCE_PATHS) {
    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    try {
      const resolvedSourcePath = path.resolve(sourcePath);
      const sourceStats = fs.statSync(sourcePath);
      if (
        teachersDataCache.value &&
        teachersDataCache.sourcePath === resolvedSourcePath &&
        teachersDataCache.mtimeMs === sourceStats.mtimeMs
      ) {
        return teachersDataCache.value;
      }

      const raw = fs.readFileSync(sourcePath, 'utf8');
      const parsed = JSON.parse(raw);
      const teachers = Array.isArray(parsed) ? parsed : [];
      const seededManagement = ensureManagementCommitteeTeachers(teachers);
      const normalizedTeachers = ensureTeacherIds(teachers);
      const changed = normalizedTeachers || seededManagement;
      const orderedTeachers = orderTeachersForPublicRoster(teachers);
      const orderChanged =
        orderedTeachers.length !== teachers.length ||
        orderedTeachers.some((teacher, index) => teacher !== teachers[index]);
      if (changed || orderChanged || resolvedSourcePath !== path.resolve(TEACHERS_DATA_PATH)) {
        saveTeachers(orderedTeachers);
        return orderedTeachers;
      }
      teachersDataCache.value = orderedTeachers;
      teachersDataCache.sourcePath = resolvedSourcePath;
      teachersDataCache.mtimeMs = sourceStats.mtimeMs;
      return orderedTeachers;
    } catch (error) {
      console.error(`Failed to load teachers data from "${sourcePath}":`, error);
    }
  }

  teachersDataCache.value = [];
  teachersDataCache.sourcePath = '';
  teachersDataCache.mtimeMs = 0;
  return [];
}

function getTeacherRoleLabel(teacher) {
  return getTeacherRoleText(teacher);
}

function normalizeAdminIdentity(value) {
  return String(value || '').trim().toLowerCase();
}

function collectApprovedAdminIdentities() {
  const approved = new Set([...ADMIN_LOGIN_ALLOWED_IDENTITIES]);
  const bootstrapUsername = normalizeAdminIdentity(ADMIN_USERNAME);
  if (bootstrapUsername) {
    approved.add(bootstrapUsername);
  }

  loadTeachers().forEach((teacher) => {
    const email = normalizeAdminIdentity(teacher?.email);
    if (!email) return;
    approved.add(email);
    const localPart = email.split('@')[0];
    if (localPart) {
      approved.add(localPart);
    }
  });

  return approved;
}

function isApprovedAdminIdentity(username) {
  const normalizedUsername = normalizeAdminIdentity(username);
  if (!normalizedUsername) {
    return false;
  }
  return collectApprovedAdminIdentities().has(normalizedUsername);
}

function getPrincipalRolePriority(role) {
  const normalizedRole = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  if (!normalizedRole) return Number.POSITIVE_INFINITY;
  if (normalizedRole === 'principal') return 0;
  if (normalizedRole === 'headmaster' || normalizedRole === 'head teacher') return 1;
  if (/principal/.test(normalizedRole) && !/vice/.test(normalizedRole)) return 2;
  if (/headmaster|head teacher/.test(normalizedRole)) return 3;
  if (/vice principal/.test(normalizedRole)) return 4;
  return Number.POSITIVE_INFINITY;
}

function findCurrentPrincipal(teachers) {
  if (!Array.isArray(teachers)) return null;

  const candidates = teachers
    .map((teacher, index) => ({
      teacher,
      index,
      priority: getPrincipalRolePriority(getTeacherRoleLabel(teacher)),
    }))
    .filter(({ teacher, priority }) => teacher && typeof teacher === 'object' && Number.isFinite(priority))
    .sort((left, right) => left.priority - right.priority || left.index - right.index);

  return candidates[0]?.teacher || null;
}

function buildPrincipalProfile(teacher) {
  if (!teacher || typeof teacher !== 'object') return null;

  const name = String(teacher.name || '').trim();
  if (!name) return null;

  const role = getTeacherRoleLabel(teacher) || 'Principal';
  const caption = `${role} ${name}`.trim();

  return {
    id: String(teacher.id || '').trim(),
    name,
    role,
    img: String(teacher.img || '').trim(),
    alt: String(teacher.alt || '').trim() || caption,
    caption,
    roleWithSchool: `${role}, Kankai Secondary School`,
  };
}

function loadPrincipalProfile() {
  return buildPrincipalProfile(findCurrentPrincipal(loadTeachers()));
}

function buildTeacherAdminRedirect({ message = '', error = '', editId = '' } = {}) {
  const params = new URLSearchParams();
  if (message) params.set('message', message);
  if (error) params.set('error', error);
  if (editId) params.set('edit', editId);
  const query = params.toString();
  return query ? `/admin/teachers?${query}` : '/admin/teachers';
}

function sanitizeGalleryAlbumName(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .slice(0, 80)
    .trim();
}

function isIgnoredGalleryDir(value) {
  return GALLERY_IGNORED_DIRS.has(String(value || '').trim().toLowerCase());
}

function isGalleryImageFile(fileName) {
  const extension = path.extname(String(fileName || '')).trim().toLowerCase();
  return TEACHER_PHOTO_ALLOWED_EXTENSIONS.has(extension);
}

function isGalleryVideoFile(fileName) {
  const extension = path.extname(String(fileName || '')).trim().toLowerCase();
  return GALLERY_VIDEO_ALLOWED_EXTENSIONS.has(extension);
}

function isGalleryMediaFile(fileName) {
  return isGalleryImageFile(fileName) || isGalleryVideoFile(fileName);
}

function getGalleryMediaType(fileName) {
  if (isGalleryVideoFile(fileName)) {
    return 'video';
  }

  if (isGalleryImageFile(fileName)) {
    return 'image';
  }

  return '';
}

function readUInt64SecondsBuffer(buffer, offset) {
  if (offset < 0 || offset + 8 > buffer.length) return 0;
  const value = buffer.readBigUInt64BE(offset);
  return value > BigInt(Number.MAX_SAFE_INTEGER) ? 0 : Number(value);
}

function getMp4DurationSeconds(filePath) {
  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch {
    return 0;
  }

  function readBoxes(start, end) {
    let offset = start;
    while (offset + 8 <= end && offset + 8 <= buffer.length) {
      let size = buffer.readUInt32BE(offset);
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      let headerSize = 8;
      if (size === 1 && offset + 16 <= buffer.length) {
        size = readUInt64SecondsBuffer(buffer, offset + 8);
        headerSize = 16;
      } else if (size === 0) {
        size = end - offset;
      }

      if (!size || offset + size > buffer.length || size < headerSize) {
        break;
      }

      if (type === 'mvhd') {
        const version = buffer[offset + headerSize];
        const timescaleOffset = offset + headerSize + (version === 1 ? 20 : 12);
        const durationOffset = offset + headerSize + (version === 1 ? 24 : 16);
        if (timescaleOffset + 4 > buffer.length) return 0;
        const timescale = buffer.readUInt32BE(timescaleOffset);
        const duration = version === 1
          ? readUInt64SecondsBuffer(buffer, durationOffset)
          : (durationOffset + 4 <= buffer.length ? buffer.readUInt32BE(durationOffset) : 0);
        return timescale > 0 && duration > 0 ? duration / timescale : 0;
      }

      if (type === 'moov') {
        const nestedDuration = readBoxes(offset + headerSize, offset + size);
        if (nestedDuration) return nestedDuration;
      }

      offset += size;
    }
    return 0;
  }

  const seconds = readBoxes(0, buffer.length);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

function getGalleryVideoDurationSeconds(filePath) {
  const extension = path.extname(String(filePath || '')).toLowerCase();
  if (extension === '.mp4') {
    return getMp4DurationSeconds(filePath);
  }
  return 0;
}

function normalizeGalleryAlbumKey(value) {
  const normalizedName = sanitizeGalleryAlbumName(value);
  if (!normalizedName || isIgnoredGalleryDir(normalizedName)) {
    return '';
  }

  return normalizedName.toLowerCase();
}

function normalizeGalleryPhotoKey(value) {
  const normalizedName = path.basename(String(value || '').trim());
  if (!normalizedName || !isGalleryMediaFile(normalizedName)) {
    return '';
  }

  return normalizedName.toLowerCase();
}

function normalizeGalleryHiddenPhotosState(value) {
  const rawAlbums =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value.albums && typeof value.albums === 'object' && !Array.isArray(value.albums) ? value.albums : value)
      : {};
  const albums = {};

  Object.entries(rawAlbums || {}).forEach(([albumName, photoNames]) => {
    const albumKey = normalizeGalleryAlbumKey(albumName);
    if (!albumKey || !Array.isArray(photoNames)) {
      return;
    }

    const normalizedPhotoNames = Array.from(
      new Set(
        photoNames
          .map((photoName) => normalizeGalleryPhotoKey(photoName))
          .filter(Boolean)
      )
    );

    if (normalizedPhotoNames.length) {
      albums[albumKey] = normalizedPhotoNames;
    }
  });

  return { albums };
}

function getExistingGalleryHiddenPhotosStatePath() {
  const existingCandidates = GALLERY_HIDDEN_PHOTOS_SOURCE_PATHS.map((candidatePath) => {
    try {
      if (!fs.existsSync(candidatePath)) {
        return null;
      }

      const stats = fs.statSync(candidatePath);
      return stats.isFile()
        ? {
          candidatePath,
          mtimeMs: Number(stats.mtimeMs) || 0,
        }
        : null;
    } catch (error) {
      return null;
    }
  }).filter(Boolean);

  if (!existingCandidates.length) {
    return '';
  }

  existingCandidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return existingCandidates[0].candidatePath;
}

function saveGalleryHiddenPhotosState(state) {
  const normalizedState = normalizeGalleryHiddenPhotosState(state);
  const serializedState = JSON.stringify(normalizedState, null, 2);
  const candidatePaths = GALLERY_HIDDEN_PHOTOS_SOURCE_PATHS.length
    ? GALLERY_HIDDEN_PHOTOS_SOURCE_PATHS
    : [GALLERY_HIDDEN_PHOTOS_PREFERRED_PATH];
  let savedPath = '';
  let lastError = null;

  candidatePaths.some((candidatePath) => {
    try {
      fs.mkdirSync(path.dirname(candidatePath), { recursive: true });
      fs.writeFileSync(candidatePath, serializedState, 'utf8');
      savedPath = candidatePath;
      return true;
    } catch (error) {
      lastError = error;
      return false;
    }
  });

  if (!savedPath) {
    throw lastError || new Error('Unable to save gallery hidden photos state.');
  }

  let mtimeMs = Date.now();
  try {
    mtimeMs = fs.statSync(savedPath).mtimeMs;
  } catch { }

  galleryHiddenPhotosCache.value = normalizedState;
  galleryHiddenPhotosCache.sourcePath = savedPath;
  galleryHiddenPhotosCache.mtimeMs = mtimeMs;
  return normalizedState;
}

function loadGalleryHiddenPhotosState() {
  const sourcePath = getExistingGalleryHiddenPhotosStatePath();
  if (!sourcePath) {
    galleryHiddenPhotosCache.value = { albums: {} };
    galleryHiddenPhotosCache.sourcePath = '';
    galleryHiddenPhotosCache.mtimeMs = 0;
    return galleryHiddenPhotosCache.value;
  }

  try {
    const fileStats = fs.statSync(sourcePath);
    if (
      galleryHiddenPhotosCache.value &&
      galleryHiddenPhotosCache.sourcePath === sourcePath &&
      galleryHiddenPhotosCache.mtimeMs === fileStats.mtimeMs
    ) {
      return galleryHiddenPhotosCache.value;
    }

    const raw = fs.readFileSync(sourcePath, 'utf8');
    const parsed = JSON.parse(raw);
    const normalizedState = normalizeGalleryHiddenPhotosState(parsed);
    galleryHiddenPhotosCache.value = normalizedState;
    galleryHiddenPhotosCache.sourcePath = sourcePath;
    galleryHiddenPhotosCache.mtimeMs = fileStats.mtimeMs;
    return normalizedState;
  } catch (error) {
    console.error('Failed to load gallery hidden photos state:', error);
    galleryHiddenPhotosCache.value = { albums: {} };
    galleryHiddenPhotosCache.sourcePath = '';
    galleryHiddenPhotosCache.mtimeMs = 0;
    return galleryHiddenPhotosCache.value;
  }
}

function getHiddenGalleryPhotoKeys(albumName) {
  const albumKey = normalizeGalleryAlbumKey(albumName);
  if (!albumKey) {
    return new Set();
  }

  const state = loadGalleryHiddenPhotosState();
  const photoKeys = Array.isArray(state?.albums?.[albumKey]) ? state.albums[albumKey] : [];
  return new Set(photoKeys);
}

function setGalleryPhotoHiddenState(albumName, photoName, hidden) {
  const albumKey = normalizeGalleryAlbumKey(albumName);
  const photoKey = normalizeGalleryPhotoKey(photoName);
  if (!albumKey || !photoKey) {
    return false;
  }

  const state = loadGalleryHiddenPhotosState();
  const albums = { ...(state?.albums || {}) };
  const currentKeys = new Set(Array.isArray(albums[albumKey]) ? albums[albumKey] : []);
  const shouldHide = hidden !== false;

  if (shouldHide) {
    currentKeys.add(photoKey);
  } else {
    currentKeys.delete(photoKey);
  }

  if (currentKeys.size) {
    albums[albumKey] = Array.from(currentKeys).sort();
  } else {
    delete albums[albumKey];
  }

  try {
    saveGalleryHiddenPhotosState({ albums });
    clearGalleryAlbumsCache();
    return true;
  } catch (error) {
    console.error('Failed to update gallery hidden photos state:', error);
    return false;
  }
}

function isGalleryPhotoHidden(albumName, photoName) {
  const photoKey = normalizeGalleryPhotoKey(photoName);
  if (!photoKey) {
    return false;
  }

  return getHiddenGalleryPhotoKeys(albumName).has(photoKey);
}

function normalizeGalleryMediaSettingsState(value) {
  const rawAlbums =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value.albums && typeof value.albums === 'object' && !Array.isArray(value.albums) ? value.albums : value)
      : {};
  const albums = {};

  Object.entries(rawAlbums || {}).forEach(([albumName, mediaSettings]) => {
    const albumKey = normalizeGalleryAlbumKey(albumName);
    if (!albumKey || !mediaSettings || typeof mediaSettings !== 'object' || Array.isArray(mediaSettings)) {
      return;
    }

    const normalizedItems = {};
    Object.entries(mediaSettings).forEach(([photoName, settings]) => {
      const photoKey = normalizeGalleryPhotoKey(photoName);
      if (!photoKey || !settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return;
      }

      normalizedItems[photoKey] = {
        muted: settings.muted !== false,
      };
    });

    if (Object.keys(normalizedItems).length) {
      albums[albumKey] = normalizedItems;
    }
  });

  return { albums };
}

function getExistingGalleryMediaSettingsPath() {
  const existingCandidates = GALLERY_MEDIA_SETTINGS_SOURCE_PATHS.map((candidatePath) => {
    try {
      if (!fs.existsSync(candidatePath)) return null;
      const stats = fs.statSync(candidatePath);
      return stats.isFile() ? { candidatePath, mtimeMs: Number(stats.mtimeMs) || 0 } : null;
    } catch {
      return null;
    }
  }).filter(Boolean);

  if (!existingCandidates.length) return '';
  existingCandidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return existingCandidates[0].candidatePath;
}

function saveGalleryMediaSettingsState(state) {
  const normalizedState = normalizeGalleryMediaSettingsState(state);
  const serializedState = JSON.stringify(normalizedState, null, 2);
  const candidatePaths = GALLERY_MEDIA_SETTINGS_SOURCE_PATHS.length
    ? GALLERY_MEDIA_SETTINGS_SOURCE_PATHS
    : [GALLERY_MEDIA_SETTINGS_PREFERRED_PATH];
  let savedPath = '';
  let lastError = null;

  candidatePaths.some((candidatePath) => {
    try {
      fs.mkdirSync(path.dirname(candidatePath), { recursive: true });
      fs.writeFileSync(candidatePath, serializedState, 'utf8');
      savedPath = candidatePath;
      return true;
    } catch (error) {
      lastError = error;
      return false;
    }
  });

  if (!savedPath) {
    throw lastError || new Error('Unable to save gallery media settings.');
  }

  let mtimeMs = Date.now();
  try {
    mtimeMs = fs.statSync(savedPath).mtimeMs;
  } catch { }

  galleryMediaSettingsCache.value = normalizedState;
  galleryMediaSettingsCache.sourcePath = savedPath;
  galleryMediaSettingsCache.mtimeMs = mtimeMs;
  return normalizedState;
}

function loadGalleryMediaSettingsState() {
  const sourcePath = getExistingGalleryMediaSettingsPath();
  if (!sourcePath) {
    galleryMediaSettingsCache.value = { albums: {} };
    galleryMediaSettingsCache.sourcePath = '';
    galleryMediaSettingsCache.mtimeMs = 0;
    return galleryMediaSettingsCache.value;
  }

  try {
    const fileStats = fs.statSync(sourcePath);
    if (
      galleryMediaSettingsCache.value &&
      galleryMediaSettingsCache.sourcePath === sourcePath &&
      galleryMediaSettingsCache.mtimeMs === fileStats.mtimeMs
    ) {
      return galleryMediaSettingsCache.value;
    }

    const parsed = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const normalizedState = normalizeGalleryMediaSettingsState(parsed);
    galleryMediaSettingsCache.value = normalizedState;
    galleryMediaSettingsCache.sourcePath = sourcePath;
    galleryMediaSettingsCache.mtimeMs = fileStats.mtimeMs;
    return normalizedState;
  } catch (error) {
    console.error('Failed to load gallery media settings:', error);
    galleryMediaSettingsCache.value = { albums: {} };
    galleryMediaSettingsCache.sourcePath = '';
    galleryMediaSettingsCache.mtimeMs = 0;
    return galleryMediaSettingsCache.value;
  }
}

function getGalleryMediaSettings(albumName, photoName) {
  const albumKey = normalizeGalleryAlbumKey(albumName);
  const photoKey = normalizeGalleryPhotoKey(photoName);
  if (!albumKey || !photoKey) {
    return { muted: true };
  }

  const state = loadGalleryMediaSettingsState();
  const settings = state?.albums?.[albumKey]?.[photoKey];
  return {
    muted: settings?.muted !== false,
  };
}

function setGalleryMediaSettings(albumName, photoName, settings = {}) {
  const albumKey = normalizeGalleryAlbumKey(albumName);
  const photoKey = normalizeGalleryPhotoKey(photoName);
  if (!albumKey || !photoKey) {
    return false;
  }

  const state = loadGalleryMediaSettingsState();
  const albums = { ...(state?.albums || {}) };
  const albumSettings = { ...(albums[albumKey] || {}) };
  albumSettings[photoKey] = {
    muted: settings.muted !== false,
  };
  albums[albumKey] = albumSettings;

  try {
    saveGalleryMediaSettingsState({ albums });
    clearGalleryAlbumsCache();
    return true;
  } catch (error) {
    console.error('Failed to update gallery media settings:', error);
    return false;
  }
}

function removeGalleryMediaSettings(albumName, photoName) {
  const albumKey = normalizeGalleryAlbumKey(albumName);
  const photoKey = normalizeGalleryPhotoKey(photoName);
  if (!albumKey || !photoKey) {
    return false;
  }

  const state = loadGalleryMediaSettingsState();
  const albums = { ...(state?.albums || {}) };
  const albumSettings = { ...(albums[albumKey] || {}) };
  if (!Object.prototype.hasOwnProperty.call(albumSettings, photoKey)) {
    return false;
  }

  delete albumSettings[photoKey];
  if (Object.keys(albumSettings).length) {
    albums[albumKey] = albumSettings;
  } else {
    delete albums[albumKey];
  }

  try {
    saveGalleryMediaSettingsState({ albums });
    clearGalleryAlbumsCache();
    return true;
  } catch (error) {
    console.error('Failed to remove gallery media settings:', error);
    return false;
  }
}

function getGalleryThumbnailFileName(photoFileName) {
  const parsedName = path.parse(path.basename(String(photoFileName || '').trim()));
  const safeBaseName = slugifyAssetName(parsedName.name, 'gallery-photo');
  return `${safeBaseName}.jpg`;
}

function getLegacyGalleryThumbnailFileName(photoFileName) {
  const parsedName = path.parse(path.basename(String(photoFileName || '').trim()));
  const legacyBaseName = String(parsedName.name || '').trim() || 'gallery-photo';
  return `${legacyBaseName}.jpg`;
}

function getGalleryThumbnailDirectoryAbsolutePath(albumPath) {
  const normalizedAlbumPath = String(albumPath || '').trim();
  return normalizedAlbumPath ? path.join(normalizedAlbumPath, GALLERY_THUMBNAIL_DIR_NAME) : '';
}

function getGalleryThumbnailAbsolutePath(albumPath, photoFileName) {
  const thumbnailDir = getGalleryThumbnailDirectoryAbsolutePath(albumPath);
  if (!thumbnailDir) {
    return '';
  }

  return path.join(thumbnailDir, getGalleryThumbnailFileName(photoFileName));
}

function getGalleryThumbnailCandidateFileNames(photoFileName) {
  return Array.from(
    new Set([
      getGalleryThumbnailFileName(photoFileName),
      getLegacyGalleryThumbnailFileName(photoFileName),
    ].filter(Boolean))
  );
}

function getGalleryThumbnailAbsolutePaths(albumPath, photoFileName) {
  const thumbnailDir = getGalleryThumbnailDirectoryAbsolutePath(albumPath);
  if (!thumbnailDir) {
    return [];
  }

  return getGalleryThumbnailCandidateFileNames(photoFileName).map((fileName) => path.join(thumbnailDir, fileName));
}

function getExistingGalleryThumbnailAbsolutePath(albumPath, photoFileName) {
  const thumbnailPaths = getGalleryThumbnailAbsolutePaths(albumPath, photoFileName);
  return thumbnailPaths.find((thumbnailPath) => {
    try {
      return fs.existsSync(thumbnailPath) && fs.statSync(thumbnailPath).isFile();
    } catch (error) {
      return false;
    }
  }) || '';
}

function getGalleryThumbnailRelativePath(albumName, photoFileName, resolvedThumbnailPath = '') {
  const normalizedAlbumName = String(albumName || '').trim();
  if (!normalizedAlbumName) {
    return '';
  }

  const resolvedName = path.basename(String(resolvedThumbnailPath || '').trim()) || getGalleryThumbnailFileName(photoFileName);
  return path.posix.join('photos', normalizedAlbumName, GALLERY_THUMBNAIL_DIR_NAME, resolvedName);
}

function ensureGalleryCacheSignalFile() {
  fs.mkdirSync(GALLERY_PHOTO_DIR, { recursive: true });
  if (!fs.existsSync(GALLERY_CACHE_SIGNAL_PATH)) {
    fs.writeFileSync(GALLERY_CACHE_SIGNAL_PATH, String(Date.now()));
  }
}

function getGalleryCacheVersion() {
  try {
    ensureGalleryCacheSignalFile();
    return Math.max(1, Math.floor(fs.statSync(GALLERY_CACHE_SIGNAL_PATH).mtimeMs));
  } catch (error) {
    return 0;
  }
}

function bumpGalleryCacheVersion() {
  try {
    ensureGalleryCacheSignalFile();
    const now = new Date();
    fs.utimesSync(GALLERY_CACHE_SIGNAL_PATH, now, now);
  } catch (error) {
    try {
      fs.writeFileSync(GALLERY_CACHE_SIGNAL_PATH, String(Date.now()));
    } catch (writeError) {
    }
  }

  clearGalleryAlbumsCache();
}

function refreshGalleryCacheState() {
  try {
    bumpGalleryCacheVersion();
  } catch (error) {
    console.warn('Failed to refresh gallery cache state:', error);
    clearGalleryAlbumsCache();
  }
}

function pauseSync(delayMs) {
  const safeDelayMs = Math.max(0, Number(delayMs) || 0);
  if (!safeDelayMs) {
    return;
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, safeDelayMs);
}

function clearReadOnlyFileMode(filePath) {
  try {
    fs.chmodSync(filePath, 0o666);
    return true;
  } catch (error) {
    return false;
  }
}

function removeFileIfPresent(absolutePath, options = {}) {
  const filePath = String(absolutePath || '').trim();
  if (!filePath) {
    return false;
  }

  const shouldThrow = options.throwOnError !== false;
  const maxRetries = Math.max(0, Number(options.maxRetries) || 0);
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs) || 0);

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const fileStats = fs.lstatSync(filePath);
      if (fileStats.isDirectory()) {
        fs.rmSync(filePath, {
          force: true,
          maxRetries,
          retryDelay: retryDelayMs,
        });
      } else {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (error) {
      lastError = error;
      const errorCode = String(error?.code || '').trim().toUpperCase();
      if (errorCode === 'EPERM' || errorCode === 'EACCES') {
        clearReadOnlyFileMode(filePath);
      }
      if (attempt < maxRetries && retryDelayMs > 0) {
        pauseSync(retryDelayMs);
      }
    }
  }

  if (shouldThrow && lastError) {
    throw lastError;
  }

  return false;
}

function getGalleryTrashDirectoryAbsolutePath(albumPath, albumName) {
  const normalizedAlbumPath = String(albumPath || '').trim();
  if (!normalizedAlbumPath) {
    return '';
  }

  const albumRootDir = path.dirname(normalizedAlbumPath);
  const safeAlbumName = sanitizeGalleryAlbumName(albumName) || 'album';
  return path.join(albumRootDir, GALLERY_TRASH_DIR_NAME, safeAlbumName);
}

function moveGalleryFileToTrashIfPresent(albumPath, albumName, absolutePath, options = {}) {
  const filePath = String(absolutePath || '').trim();
  if (!filePath || !fs.existsSync(filePath)) {
    return { moved: false, missing: true, targetPath: '' };
  }

  const trashDir = getGalleryTrashDirectoryAbsolutePath(albumPath, albumName);
  if (!trashDir) {
    return { moved: false, missing: false, targetPath: '', error: new Error('Trash path is unavailable.') };
  }

  const maxRetries = Math.max(0, Number(options.maxRetries) || 0);
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs) || 0);
  const sourceName = path.basename(filePath);
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      if (!fs.existsSync(filePath)) {
        return { moved: false, missing: true, targetPath: '' };
      }

      fs.mkdirSync(trashDir, { recursive: true });
      const trashName = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}-${sourceName}`;
      const targetPath = path.join(trashDir, trashName);
      fs.renameSync(filePath, targetPath);
      return { moved: true, missing: false, targetPath };
    } catch (error) {
      lastError = error;
      const errorCode = String(error?.code || '').trim().toUpperCase();
      if (errorCode === 'EPERM' || errorCode === 'EACCES') {
        clearReadOnlyFileMode(filePath);
      }
      if (attempt < maxRetries && retryDelayMs > 0) {
        pauseSync(retryDelayMs);
      }
    }
  }

  return {
    moved: false,
    missing: !fs.existsSync(filePath),
    targetPath: '',
    error: lastError,
  };
}

function buildGalleryPhotoRecord(albumName, albumPath, photoFileName) {
  const safePhotoName = path.basename(String(photoFileName || '').trim());
  if (!safePhotoName || !isGalleryMediaFile(safePhotoName)) {
    return null;
  }

  const absolutePhotoPath = path.join(albumPath, safePhotoName);
  let photoStats = null;
  try {
    if (!fs.existsSync(absolutePhotoPath)) {
      return null;
    }

    photoStats = fs.statSync(absolutePhotoPath);
    if (!photoStats.isFile()) {
      return null;
    }
  } catch (error) {
    return null;
  }

  const version = Math.max(1, Math.floor(photoStats.mtimeMs));
  const relativePath = path.posix.join('photos', albumName, safePhotoName);
  const mediaType = getGalleryMediaType(safePhotoName) || 'image';
  const mediaSettings = getGalleryMediaSettings(albumName, safePhotoName);
  const durationSeconds = mediaType === 'video' ? getGalleryVideoDurationSeconds(absolutePhotoPath) : 0;
  let thumbnailPath = '';
  let thumbnailVersion = version;

  try {
    const absoluteThumbnailPath = getExistingGalleryThumbnailAbsolutePath(albumPath, safePhotoName);
    if (absoluteThumbnailPath && fs.existsSync(absoluteThumbnailPath)) {
      const thumbnailStats = fs.statSync(absoluteThumbnailPath);
      if (thumbnailStats.isFile()) {
        thumbnailPath = getGalleryThumbnailRelativePath(albumName, safePhotoName, absoluteThumbnailPath);
        thumbnailVersion = Math.max(1, Math.floor(thumbnailStats.mtimeMs));
      }
    }
  } catch (error) {
  }

  return {
    name: safePhotoName,
    path: relativePath,
    mediaType,
    isVideo: mediaType === 'video',
    muted: mediaType === 'video' ? mediaSettings.muted : true,
    durationSeconds,
    thumbnailPath,
    modifiedAtMs: photoStats.mtimeMs,
    modifiedLabel: new Date(photoStats.mtimeMs).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    sizeLabel: `${Math.max(1, Math.round(photoStats.size / 1024))} KB`,
    version,
    thumbnailVersion,
  };
}

async function saveGalleryMediaCatalogRecord({ albumName, fileName, photo, mimeType, sizeBytes }) {
  if (!albumName || !fileName || !photo) {
    throw new Error('Gallery media record is incomplete.');
  }

  return GalleryMedia.findOneAndUpdate(
    { albumName, fileName },
    {
      $set: {
        path: photo.path,
        mediaType: photo.mediaType,
        mimeType: String(mimeType || '').trim().toLowerCase(),
        sizeBytes: Math.max(0, Number(sizeBytes) || 0),
        durationSeconds: Math.max(0, Number(photo.durationSeconds) || 0),
        thumbnailPath: photo.thumbnailPath || '',
        muted: photo.mediaType === 'video' ? photo.muted !== false : true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).exec();
}

function serializePublicGalleryAlbum(album) {
  const photos = Array.isArray(album?.photos)
    ? album.photos.map((photo) => ({
      name: photo.name,
      path: photo.path,
      mediaType: photo.mediaType || 'image',
      muted: photo.mediaType === 'video' ? photo.muted !== false : true,
      durationSeconds: Number(photo.durationSeconds) || 0,
      thumbnailPath: photo.thumbnailPath || '',
      version: photo.version,
      thumbnailVersion: photo.thumbnailVersion || photo.version,
    }))
    : [];

  return {
    name: album?.name || '',
    label: album?.label || '',
    anchor: album?.anchor || '',
    photoCount: Number(album?.photoCount) || photos.length,
    coverPath: album?.coverPath || photos[0]?.path || '',
    coverThumbnailPath: album?.coverThumbnailPath || photos[0]?.thumbnailPath || '',
    coverVersion: Number(album?.coverVersion) || Number(photos[0]?.version) || 1,
    coverThumbnailVersion:
      Number(album?.coverThumbnailVersion) ||
      Number(photos[0]?.thumbnailVersion) ||
      Number(photos[0]?.version) ||
      1,
    photos,
  };
}

function formatGalleryAlbumLabel(value) {
  const cleaned = String(value || 'Album')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getGalleryAlbumAnchor(albumName) {
  return `album-${slugifyAssetName(albumName, 'album')}`;
}

function buildGalleryAdminRedirect({ message = '', error = '', albumName = '' } = {}) {
  const params = new URLSearchParams();
  if (message) params.set('message', message);
  if (error) params.set('error', error);
  const query = params.toString();
  const hash = albumName ? `#${getGalleryAlbumAnchor(albumName)}` : '';
  return `${query ? `/admin/gallery?${query}` : '/admin/gallery'}${hash}`;
}

function getGalleryAlbumAbsolutePath(albumName) {
  return getGalleryAlbumAbsolutePathForRoot(GALLERY_PHOTO_DIR, albumName);
}

function getGalleryAlbumAbsolutePathForRoot(rootDir, albumName) {
  const trimmedName = String(albumName || '').trim();
  const sanitizedName = sanitizeGalleryAlbumName(trimmedName);
  const normalizedRootDir = String(rootDir || '').trim();
  if (!normalizedRootDir || !trimmedName || !sanitizedName || trimmedName !== sanitizedName || isIgnoredGalleryDir(sanitizedName)) {
    return '';
  }

  const absolutePath = path.resolve(normalizedRootDir, sanitizedName);
  const relativePath = path.relative(normalizedRootDir, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return '';
  }

  return absolutePath;
}

function getGalleryAlbumMutationAbsolutePaths(albumName, options = {}) {
  const createIfMissing = options.createIfMissing === true;

  return GALLERY_MUTATION_TARGET_DIRS
    .map((rootDir) => {
      const absolutePath = getGalleryAlbumAbsolutePathForRoot(rootDir, albumName);
      if (!absolutePath) {
        return '';
      }

      if (createIfMissing) {
        fs.mkdirSync(absolutePath, { recursive: true });
        return absolutePath;
      }

      try {
        return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory() ? absolutePath : '';
      } catch (error) {
        return '';
      }
    })
    .filter(Boolean);
}

function getExistingMutableGalleryAlbumAbsolutePath(albumName) {
  const absolutePath = getGalleryAlbumAbsolutePath(albumName);
  if (!absolutePath) {
    return '';
  }

  try {
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory() ? absolutePath : '';
  } catch (error) {
    return '';
  }
}

function getBuiltInGalleryAlbumAbsolutePath(albumName) {
  const absolutePath = getGalleryAlbumAbsolutePathForRoot(FRONTEND_PHOTO_DIR, albumName);
  if (!absolutePath) {
    return '';
  }

  try {
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory() ? absolutePath : '';
  } catch (error) {
    return '';
  }
}

function getExistingGalleryAlbumAbsolutePaths(albumName) {
  const trimmedName = String(albumName || '').trim();
  const sanitizedName = sanitizeGalleryAlbumName(trimmedName);
  if (!trimmedName || !sanitizedName || trimmedName !== sanitizedName || isIgnoredGalleryDir(sanitizedName)) {
    return [];
  }

  return GALLERY_PHOTO_SOURCE_DIRS
    .map((rootDir) => {
      const absolutePath = path.resolve(rootDir, sanitizedName);
      const relativePath = path.relative(rootDir, absolutePath);
      if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return '';
      }
      return absolutePath;
    })
    .filter(Boolean)
    .filter((absolutePath) => {
      try {
        return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
      } catch (error) {
        return false;
      }
    });
}

function clearGalleryAlbumsCache() {
  galleryAlbumsCache.clear();
}

function copyGalleryAlbumFilesIfMissing(sourceDir, targetDir, fileFilter) {
  if (!sourceDir || !targetDir || !fs.existsSync(sourceDir)) {
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && fileFilter(entry.name))
    .forEach((entry) => {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      if (!fs.existsSync(targetPath)) {
        fs.copyFileSync(sourcePath, targetPath);
      }
    });
}

function ensureMutableGalleryAlbumMirror(albumName, options = {}) {
  const mutableAlbumPath = getGalleryAlbumAbsolutePath(albumName);
  if (!mutableAlbumPath) {
    return '';
  }

  const createIfMissing = options.createIfMissing === true;
  const mutableAlbumPathExists = Boolean(getExistingMutableGalleryAlbumAbsolutePath(albumName));
  if (!HAS_SEPARATE_MUTABLE_GALLERY_STORAGE) {
    if (!mutableAlbumPathExists && createIfMissing) {
      fs.mkdirSync(mutableAlbumPath, { recursive: true });
    }
    return mutableAlbumPathExists || createIfMissing ? mutableAlbumPath : '';
  }

  const builtInAlbumPath = getBuiltInGalleryAlbumAbsolutePath(albumName);
  if (!builtInAlbumPath && !mutableAlbumPathExists && !createIfMissing) {
    return '';
  }

  fs.mkdirSync(mutableAlbumPath, { recursive: true });
  const mirrorMarkerPath = path.join(mutableAlbumPath, GALLERY_MIRROR_MARKER_FILE_NAME);
  if (!builtInAlbumPath) {
    return mutableAlbumPath;
  }

  if (fs.existsSync(mirrorMarkerPath)) {
    return mutableAlbumPath;
  }

  copyGalleryAlbumFilesIfMissing(builtInAlbumPath, mutableAlbumPath, isGalleryMediaFile);

  const builtInThumbnailDir = getGalleryThumbnailDirectoryAbsolutePath(builtInAlbumPath);
  const mutableThumbnailDir = getGalleryThumbnailDirectoryAbsolutePath(mutableAlbumPath);
  if (builtInThumbnailDir && mutableThumbnailDir) {
    copyGalleryAlbumFilesIfMissing(
      builtInThumbnailDir,
      mutableThumbnailDir,
      (fileName) => /\.(?:jpe?g|png|webp|gif)$/i.test(String(fileName || '').trim())
    );
  }

  fs.writeFileSync(mirrorMarkerPath, `${Date.now()}`, 'utf8');

  return mutableAlbumPath;
}

function getAuthoritativeGalleryAlbumAbsolutePaths(albumName) {
  const mutableAlbumPath = getExistingMutableGalleryAlbumAbsolutePath(albumName);
  if (HAS_SEPARATE_MUTABLE_GALLERY_STORAGE && mutableAlbumPath) {
    return [mutableAlbumPath];
  }

  return getExistingGalleryAlbumAbsolutePaths(albumName);
}

function listManagedGalleryAlbumNames() {
  const albumNames = new Map();

  try {
    fs.mkdirSync(GALLERY_PHOTO_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to prepare gallery storage directory:', error);
  }

  GALLERY_PHOTO_SOURCE_DIRS.forEach((rootDir) => {
    try {
      if (!fs.existsSync(rootDir)) {
        return;
      }
      fs.readdirSync(rootDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !isIgnoredGalleryDir(entry.name))
        .forEach((entry) => {
          const key = entry.name.toLowerCase();
          if (!albumNames.has(key)) {
            albumNames.set(key, entry.name);
          }
        });
    } catch (error) {
      console.error(`Failed to list gallery albums in "${rootDir}":`, error);
    }
  });

  return Array.from(albumNames.values()).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' })
  );
}

function listManagedGalleryAlbums({ includeEmpty = true } = {}) {
  const cacheKey = includeEmpty ? 'with-empty' : 'without-empty';
  const cacheVersion = getGalleryCacheVersion();
  const cached = galleryAlbumsCache.get(cacheKey);
  if (cached && cached.version === cacheVersion && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const hiddenGalleryPhotosState = loadGalleryHiddenPhotosState();
  const albums = listManagedGalleryAlbumNames()
    .map((albumName) => {
      const albumPaths = getAuthoritativeGalleryAlbumAbsolutePaths(albumName);
      let photos = [];
      const albumKey = normalizeGalleryAlbumKey(albumName);
      const hiddenPhotoKeys = new Set(
        Array.isArray(hiddenGalleryPhotosState?.albums?.[albumKey])
          ? hiddenGalleryPhotosState.albums[albumKey]
          : []
      );

      const seenPhotoPaths = new Set();
      albumPaths.forEach((albumPath) => {
        try {
          fs.readdirSync(albumPath, { withFileTypes: true })
            .filter((entry) => entry.isFile() && isGalleryMediaFile(entry.name))
            .forEach((entry) => {
              if (hiddenPhotoKeys.has(normalizeGalleryPhotoKey(entry.name))) {
                return;
              }

              const photoRecord = buildGalleryPhotoRecord(albumName, albumPath, entry.name);
              if (!photoRecord) {
                return;
              }

              const photoKey = photoRecord.path.toLowerCase();
              if (seenPhotoPaths.has(photoKey)) {
                return;
              }

              seenPhotoPaths.add(photoKey);
              photos.push(photoRecord);
            });
        } catch (error) {
          console.error(`Failed to read gallery album "${albumName}" from "${albumPath}":`, error);
        }
      });

      photos.sort((left, right) => right.modifiedAtMs - left.modifiedAtMs || left.name.localeCompare(right.name));

      if (!includeEmpty && !photos.length) {
        return null;
      }

      return {
        name: albumName,
        label: formatGalleryAlbumLabel(albumName),
        anchor: getGalleryAlbumAnchor(albumName),
        folderPath: path.posix.join('photos', albumName),
        photoCount: photos.length,
        coverPath: photos[0]?.path || '',
        coverThumbnailPath: photos[0]?.thumbnailPath || '',
        coverVersion: photos[0]?.version || 1,
        coverThumbnailVersion: photos[0]?.thumbnailVersion || photos[0]?.version || 1,
        photos,
      };
    })
    .filter(Boolean);

  galleryAlbumsCache.set(cacheKey, {
    value: albums,
    version: cacheVersion,
    expiresAt: Date.now() + GALLERY_ALBUM_CACHE_TTL_MS,
  });

  return albums;
}

function listManagedGalleryImagePaths() {
  return listManagedGalleryAlbums({ includeEmpty: false }).flatMap((album) =>
    album.photos.filter((photo) => photo.mediaType !== 'video').map((photo) => photo.path)
  );
}

function getPublicGalleryVersionPayload() {
  const version = getGalleryCacheVersion();
  return {
    version,
    updatedAt: version > 0 ? new Date(version).toISOString() : '',
  };
}

function getTeacherPhotoAbsolutePath(imagePath) {
  const normalizedPath = normalizeAssetPath(imagePath);
  if (!normalizedPath || !normalizedPath.toLowerCase().startsWith('photos/teacher/')) {
    return '';
  }

  const relativeTeacherPath = normalizedPath.slice('photos/'.length);
  for (const teacherPhotoDir of TEACHER_PHOTO_SOURCE_DIRS) {
    const absolutePath = path.resolve(teacherPhotoDir, relativeTeacherPath.replace(/^teacher\//i, '').split('/').join(path.sep));
    const relativeToTeacherDir = path.relative(teacherPhotoDir, absolutePath);
    if (!relativeToTeacherDir || relativeToTeacherDir.startsWith('..') || path.isAbsolute(relativeToTeacherDir)) {
      continue;
    }
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return '';
}

function getTeacherPhotoMutationAbsolutePaths(imagePath, options = {}) {
  const normalizedPath = normalizeAssetPath(imagePath);
  if (!normalizedPath || !normalizedPath.toLowerCase().startsWith('photos/teacher/')) {
    return [];
  }

  const fileName = path.basename(normalizedPath);
  const createIfMissing = options.createIfMissing === true;

  return TEACHER_PHOTO_MUTATION_TARGET_DIRS
    .map((teacherPhotoDir) => {
      const absolutePath = path.resolve(teacherPhotoDir, fileName);
      const relativeToTeacherDir = path.relative(teacherPhotoDir, absolutePath);
      if (!relativeToTeacherDir || relativeToTeacherDir.startsWith('..') || path.isAbsolute(relativeToTeacherDir)) {
        return '';
      }

      if (createIfMissing) {
        fs.mkdirSync(teacherPhotoDir, { recursive: true });
        return absolutePath;
      }

      try {
        return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile() ? absolutePath : '';
      } catch (error) {
        return '';
      }
    })
    .filter(Boolean);
}

function getTeacherPhotoCandidateFileNames(fileName) {
  const normalizedFileName = path.basename(String(fileName || '').trim());
  if (!normalizedFileName || normalizedFileName !== String(fileName || '').trim()) {
    return [];
  }

  const parsed = path.parse(normalizedFileName);
  const normalizedExtension = parsed.ext.toLowerCase();
  const fallbackCandidates = TEACHER_PHOTO_PUBLIC_FALLBACK_EXTENSIONS.map((extension) => `${parsed.name}${extension}`);
  return Array.from(new Set([normalizedFileName, ...fallbackCandidates].filter(Boolean)));
}

function getTeacherPhotoPublicFileRecord(fileName) {
  const candidateFileNames = getTeacherPhotoCandidateFileNames(fileName);
  if (!candidateFileNames.length) {
    return null;
  }

  for (const candidateFileName of candidateFileNames) {
    for (const teacherPhotoDir of TEACHER_PHOTO_PUBLIC_SOURCE_DIRS) {
      const absolutePath = path.resolve(teacherPhotoDir, candidateFileName);
      const relativeToTeacherDir = path.relative(teacherPhotoDir, absolutePath);
      if (!relativeToTeacherDir || relativeToTeacherDir.startsWith('..') || path.isAbsolute(relativeToTeacherDir)) {
        continue;
      }

      try {
        const stats = fs.statSync(absolutePath);
        if (stats.isFile() && stats.size > 0) {
          return {
            absolutePath,
            fileName: candidateFileName,
          };
        }
      } catch { }
    }
  }

  return null;
}

function getTeacherPhotoPublicAbsolutePath(fileName) {
  const fileRecord = getTeacherPhotoPublicFileRecord(fileName);
  return fileRecord ? fileRecord.absolutePath : '';
}

function resolveTeacherPhotoPublicPath(imagePath) {
  const normalizedPath = normalizeAssetPath(imagePath);
  if (!normalizedPath || !normalizedPath.toLowerCase().startsWith('photos/teacher/')) {
    return normalizedPath ? `/${normalizedPath}` : '';
  }

  const fileRecord = getTeacherPhotoPublicFileRecord(path.basename(normalizedPath));
  if (!fileRecord) {
    return '';
  }

  return `/photos/Teacher/${fileRecord.fileName}`;
}

function sanitizeTeacherForPublic(teacher) {
  if (!teacher || typeof teacher !== 'object') {
    return null;
  }

  const nextTeacher = { ...teacher };
  const normalizedImagePath = normalizeAssetPath(nextTeacher.img);
  const resolvedImagePath = resolveTeacherPhotoPublicPath(normalizedImagePath);
  if (resolvedImagePath) {
    nextTeacher.img = resolvedImagePath;
  } else if (normalizedImagePath.toLowerCase().startsWith('photos/teacher/')) {
    delete nextTeacher.img;
  }

  const normalizedSection = inferTeacherSection(nextTeacher);
  if (normalizedSection) {
    nextTeacher.section = normalizedSection;
  }

  return nextTeacher;
}

function collectProjectReferenceFiles(dirPath, files = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    return files;
  }

  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (PROJECT_REFERENCE_IGNORED_DIRS.has(entry.name)) {
        return;
      }
      collectProjectReferenceFiles(fullPath, files);
      return;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (PROJECT_REFERENCE_SOURCE_EXTENSIONS.has(extension)) {
      files.push(fullPath);
    }
  });

  return files;
}

function isTeacherPhotoReferencedElsewhere(imagePath) {
  const normalizedPath = normalizeAssetPath(imagePath);
  if (!normalizedPath) {
    return false;
  }

  const searchValues = [normalizedPath, `/${normalizedPath}`];
  const referenceFiles = collectProjectReferenceFiles(ROOT_DIR);

  return referenceFiles.some((filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return searchValues.some((value) => content.includes(value));
    } catch (error) {
      return false;
    }
  });
}

function deleteTeacherPhotoIfUnused(imagePath, remainingTeachers) {
  const normalizedPath = normalizeAssetPath(imagePath);
  if (!normalizedPath) {
    return { deleted: false, skippedReason: 'missing-path' };
  }

  const absolutePath = getTeacherPhotoAbsolutePath(normalizedPath);
  if (!absolutePath) {
    return { deleted: false, skippedReason: 'outside-teacher-folder' };
  }

  const stillUsedByTeacher = remainingTeachers.some(
    (teacher) => normalizeAssetPath(teacher?.img) === normalizedPath
  );
  if (stillUsedByTeacher) {
    return { deleted: false, skippedReason: 'used-by-other-teacher' };
  }

  if (isTeacherPhotoReferencedElsewhere(normalizedPath)) {
    return { deleted: false, skippedReason: 'used-elsewhere' };
  }

  const absolutePaths = uniqueResolvedPaths([
    absolutePath,
    ...getTeacherPhotoMutationAbsolutePaths(normalizedPath, { createIfMissing: false }),
  ]);
  const existingAbsolutePaths = absolutePaths.filter((candidatePath) => fs.existsSync(candidatePath));
  if (!existingAbsolutePaths.length) {
    return { deleted: false, skippedReason: 'file-not-found' };
  }

  try {
    existingAbsolutePaths.forEach((candidatePath) => {
      fs.unlinkSync(candidatePath);
    });
    return { deleted: true, skippedReason: '' };
  } catch (error) {
    return { deleted: false, skippedReason: 'delete-failed', error };
  }
}

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Admin = mongoose.model('Admin', AdminSchema);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');
app.set('trust proxy', IS_PRODUCTION ? 1 : false);

app.use(express.urlencoded({ extended: true, limit: '2mb', parameterLimit: 1000 }));
app.use(express.json({ limit: '5mb' }));

app.use(
  compression({
    threshold: 512,
    filter: (req, res) => {
      if (req.headers['x-no-compress']) return false;
      if (req.headers.range) return false;
      if (STATIC_VIDEO_EXT_PATTERN.test(req.path || '')) return false;
      return compression.filter(req, res);
    },
  })
);

const SESSION_STORE_URI = FALLBACK_MONGODB_URI || PRIMARY_MONGODB_URI;

const sessionStore = MongoStore.create({
  mongoUrl: SESSION_STORE_URI,
  dbName: MONGODB_DB_NAME,
  collectionName: 'sessions',
  ttl: SESSION_TTL_SECONDS,
  autoRemove: 'native',
  mongoOptions: {
    maxPoolSize: MONGO_MAX_POOL_SIZE,
    minPoolSize: MONGO_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: MONGO_SOCKET_TIMEOUT_MS,
  },
});

sessionStore.on('error', (error) => {
  console.error('Session store error:', error);
});

const staticAssetOptions = {
  maxAge: 0,
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    if (STATIC_SCRIPT_STYLE_PATTERN.test(filePath)) {
      res.setHeader('Cache-Control', STATIC_TEXT_ASSET_CACHE_CONTROL);
      return;
    }

    if (STATIC_IMAGE_EXT_PATTERN.test(filePath)) {
      res.setHeader('Cache-Control', STATIC_MEDIA_CACHE_CONTROL);
      return;
    }

    if (STATIC_VIDEO_EXT_PATTERN.test(filePath)) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', STATIC_MEDIA_CACHE_CONTROL);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Transfer-Encoding', 'binary');
    }
  },
};
app.use(express.static(path.join(__dirname, 'public'), staticAssetOptions));
app.get(/^\/photos\/Teacher\/([^/]+)$/i, (req, res, next) => {
  const requestedFileName = String(req.params[0] || '').trim();
  const absolutePath = getTeacherPhotoPublicAbsolutePath(requestedFileName);
  if (!absolutePath) {
    return next();
  }

  if (STATIC_IMAGE_EXT_PATTERN.test(absolutePath)) {
    res.setHeader('Cache-Control', STATIC_MEDIA_CACHE_CONTROL);
  }

  return res.sendFile(absolutePath, { lastModified: true }, (error) => {
    if (!error) {
      return;
    }

    if (res.headersSent) {
      return;
    }

    next(error);
  });
});
PHOTO_STATIC_DIRS.forEach((photoDir) => {
  app.use('/photos', express.static(photoDir, staticAssetOptions));
});
app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    unset: 'destroy',
    proxy: IS_PRODUCTION,
    rolling: true,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: IS_PRODUCTION,
      path: '/admin',
      priority: 'high',
      ...(ADMIN_PERSIST_SESSION_COOKIE ? { maxAge: SESSION_MAX_AGE_MS } : {}),
    },
  })
);

app.use((req, res, next) => {
  if (req.path.startsWith('/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    );
  }
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Origin-Agent-Cluster', '?1');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});

app.use((req, res, next) => {
  res.locals.currentAdmin = req.session?.adminUsername || null;
  res.locals.currentPath = req.path || '';
  res.locals.adminIdleTimeoutMs = Math.max(60 * 1000, ADMIN_SESSION_IDLE_TIMEOUT_MS);
  res.locals.adminSessionStatusUrl = '/admin/session-status';
  res.locals.adminLockUrl = '/admin/lock';
  next();
});

app.get('/health', (req, res) => {
  const mongoConnected = mongoose.connection.readyState === 1;
  res.status(mongoConnected ? 200 : 503).json({
    status: mongoConnected ? 'ok' : 'unavailable',
    database: mongoConnected ? 'connected' : 'disconnected',
  });
});

function getSafeRedirectTarget(value, fallback = '/') {
  const target = String(value || '').trim();
  if (!target || !target.startsWith('/')) {
    return fallback;
  }
  if (target.startsWith('//') || target.includes('\\')) {
    return fallback;
  }
  return target;
}

function createRandomToken(size = 32) {
  return crypto.randomBytes(size).toString('hex');
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeIpAddress(value) {
  const raw = String(value || '')
    .split(',')[0]
    .trim()
    .replace(/^\[|\]$/g, '');
  if (!raw) return 'unknown';
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

function getClientIp(req) {
  return normalizeIpAddress(req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown');
}

function getClientNetwork(req) {
  const ip = getClientIp(req);
  if (!ip || ip === 'unknown') return 'unknown';

  if (ip.includes('.')) {
    const octets = ip.split('.').filter(Boolean);
    return octets.length >= 3 ? `${octets[0]}.${octets[1]}.${octets[2]}` : ip;
  }

  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    return parts.length ? parts.slice(0, 4).join(':') : ip;
  }

  return ip;
}

function getAdminRequestUserAgent(req) {
  return String(req.get('user-agent') || '')
    .trim()
    .toLowerCase()
    .slice(0, 300);
}

function getAdminRequestLocale(req) {
  return String(req.get('accept-language') || '')
    .trim()
    .toLowerCase()
    .slice(0, 120);
}

function createSessionBindingHash(parts = []) {
  return crypto
    .createHash('sha256')
    .update([SESSION_SECRET, ...parts].join('|'))
    .digest('hex');
}

function buildAdminUserAgentBinding(req) {
  return createSessionBindingHash([getAdminRequestUserAgent(req), getAdminRequestLocale(req)]);
}

function buildAdminNetworkBinding(req) {
  if (!ADMIN_SESSION_NETWORK_BINDING_ENABLED) {
    return '';
  }
  return createSessionBindingHash([getClientNetwork(req), getAdminRequestUserAgent(req)]);
}

function isAdminSessionBindingValid(req) {
  if (!req.session || !req.session.adminId) {
    return false;
  }

  const expectedUserAgentBinding = String(req.session.adminUserAgentBinding || '').trim();
  if (!expectedUserAgentBinding) {
    return false;
  }

  if (!timingSafeEqualString(expectedUserAgentBinding, buildAdminUserAgentBinding(req))) {
    return false;
  }

  if (!ADMIN_SESSION_NETWORK_BINDING_ENABLED) {
    return true;
  }

  const expectedNetworkBinding = String(req.session.adminNetworkBinding || '').trim();
  if (!expectedNetworkBinding) {
    return false;
  }

  return timingSafeEqualString(expectedNetworkBinding, buildAdminNetworkBinding(req));
}

function getRateLimitState(store, key, windowMs) {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || now > existing.resetAt) {
    const state = { count: 0, resetAt: now + windowMs };
    store.set(key, state);
    return state;
  }
  return existing;
}

function isRateLimited(store, key, maxAttempts, windowMs) {
  const state = getRateLimitState(store, key, windowMs);
  return state.count >= maxAttempts && Date.now() <= state.resetAt;
}

function registerRateLimitedAttempt(store, key, windowMs) {
  const state = getRateLimitState(store, key, windowMs);
  state.count += 1;
  store.set(key, state);
  return state;
}

function getRateLimitSecondsRemaining(store, key, windowMs) {
  const state = getRateLimitState(store, key, windowMs);
  return Math.max(1, Math.ceil((state.resetAt - Date.now()) / 1000));
}

function sweepTransientState(store) {
  const now = Date.now();
  store.forEach((state, key) => {
    if (!state || typeof state.resetAt !== 'number' || now > state.resetAt) {
      store.delete(key);
    }
  });
}

function logAdminSecurityEvent(type, req, details = '') {
  const suffix = details ? ` ${details}` : '';
  console.warn(
    `[admin-security] type=${type} ip=${getClientIp(req)} network=${getClientNetwork(req)} path=${req.originalUrl || req.path || '/admin'
    }${suffix}`
  );
}

function ensureCsrfToken(req) {
  if (!req.session) {
    return '';
  }
  if (!req.session.csrfToken) {
    req.session.csrfToken = createRandomToken();
  }
  return req.session.csrfToken;
}

function rotateCsrfToken(req) {
  if (!req.session) {
    return '';
  }
  req.session.csrfToken = createRandomToken();
  return req.session.csrfToken;
}

function getExpectedOrigin(req) {
  const host = String(req.get('host') || '').trim();
  if (!host) {
    return '';
  }
  return `${req.protocol}://${host}`;
}

function isTrustedSameOriginRequest(req) {
  const expectedOrigin = getExpectedOrigin(req);
  if (!expectedOrigin) {
    return true;
  }

  const candidates = [req.get('origin'), req.get('referer')].filter(Boolean);
  if (!candidates.length) {
    return true;
  }

  return candidates.every((value) => {
    try {
      return new URL(value).origin === expectedOrigin;
    } catch (error) {
      return false;
    }
  });
}

function clearAdminSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PRODUCTION,
    path: '/admin',
  });
}

function destroyAdminSession(req, res) {
  return new Promise((resolve) => {
    if (!req.session) {
      clearAdminSessionCookie(res);
      return resolve();
    }

    req.session.destroy(() => {
      clearAdminSessionCookie(res);
      resolve();
    });
  });
}

function getSafeAdminNextTarget(value, fallback = '/admin/dashboard') {
  const safeTarget = getSafeRedirectTarget(value, fallback);
  return safeTarget.startsWith('/admin') ? safeTarget : fallback;
}

function getAdminLoginRedirectForReason(reason = 'login', nextTarget = '/admin/dashboard') {
  const safeTarget = getSafeAdminNextTarget(nextTarget, '/admin/dashboard');
  const params = new URLSearchParams();
  params.set('next', safeTarget);

  if (reason === 'security') {
    params.set('security', '1');
  } else if (reason === 'expired') {
    params.set('expired', '1');
  }

  return `/admin/login?${params.toString()}`;
}

function getAdminWriteAttemptKey(req) {
  const adminId = String(req.session?.adminId || '').trim();
  if (adminId) {
    return `admin:${adminId}`;
  }
  return `ip:${getClientIp(req)}`;
}

function getFreshAdminLoginRedirect(req, fallback = '/admin/dashboard') {
  const nextTarget = getSafeRedirectTarget(req.originalUrl || req.path, fallback);
  const safeTarget = nextTarget.startsWith('/admin') ? nextTarget : fallback;
  return `/admin/login?reauth=1&next=${encodeURIComponent(safeTarget)}`;
}

function getLoginAttemptKey(req, username) {
  return `credential:${getClientIp(req)}:${String(username || '').toLowerCase()}`;
}

function getLoginIpAttemptKey(req) {
  return `ip:${getClientIp(req)}`;
}

function getLoginAttemptState(key) {
  const now = Date.now();
  const existing = loginAttempts.get(key);
  if (!existing || now > existing.resetAt) {
    const resetAt = now + LOGIN_RATE_LIMIT_WINDOW_MS;
    const state = { count: 0, resetAt };
    loginAttempts.set(key, state);
    return state;
  }
  return existing;
}

function isLoginBlocked(key, maxAttempts = LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
  const state = getLoginAttemptState(key);
  return state.count >= maxAttempts && Date.now() <= state.resetAt;
}

function registerLoginFailure(key) {
  const state = getLoginAttemptState(key);
  state.count += 1;
  loginAttempts.set(key, state);
  return state;
}

function clearLoginFailures(key) {
  loginAttempts.delete(key);
}

function getLockSecondsRemaining(key) {
  const state = getLoginAttemptState(key);
  return Math.max(1, Math.ceil((state.resetAt - Date.now()) / 1000));
}

const securitySweepTimer = setInterval(() => {
  sweepTransientState(loginAttempts);
  sweepTransientState(adminWriteAttempts);
}, 60 * 1000);

if (typeof securitySweepTimer.unref === 'function') {
  securitySweepTimer.unref();
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session || typeof req.session.regenerate !== 'function') {
      return reject(new Error('Session unavailable'));
    }
    req.session.regenerate((error) => {
      if (error) return reject(error);
      return resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session || typeof req.session.save !== 'function') {
      return reject(new Error('Session unavailable'));
    }
    req.session.save((error) => {
      if (error) return reject(error);
      return resolve();
    });
  });
}

function getAdminSessionState(req, options = {}) {
  const touch = options.touch === true;

  if (!req.session || !req.session.adminId) {
    return {
      ok: false,
      reason: 'login',
    };
  }

  if (!isAdminSessionBindingValid(req)) {
    return {
      ok: false,
      reason: 'security',
    };
  }

  const now = Date.now();
  const idleTimeoutMs = Math.max(60 * 1000, ADMIN_SESSION_IDLE_TIMEOUT_MS);
  const absoluteTimeoutMs = Math.max(5 * 60 * 1000, ADMIN_SESSION_ABSOLUTE_TIMEOUT_MS);
  const authenticatedAt = Number(req.session.adminAuthenticatedAt || 0);
  const lastSeenAt = Number(req.session.adminLastSeenAt || authenticatedAt || 0);
  const expiredByIdle = !lastSeenAt || now - lastSeenAt > idleTimeoutMs;
  const expiredByAbsolute = !authenticatedAt || now - authenticatedAt > absoluteTimeoutMs;

  if (expiredByIdle || expiredByAbsolute) {
    return {
      ok: false,
      reason: 'expired',
      idleTimeoutMs,
      absoluteTimeoutMs,
    };
  }

  if (touch) {
    req.session.adminLastSeenAt = now;
  }

  return {
    ok: true,
    reason: '',
    idleTimeoutMs,
    absoluteTimeoutMs,
    expiresInMs: Math.max(0, idleTimeoutMs - (now - lastSeenAt)),
  };
}

function requireAdmin(req, res, next) {
  if (req.adminAccessVerified) {
    return next();
  }

  const sessionState = getAdminSessionState(req, { touch: true });
  if (!sessionState.ok) {
    if (sessionState.reason === 'security') {
      logAdminSecurityEvent('session-binding-mismatch', req);
    }

    const redirectTarget = getAdminLoginRedirectForReason(
      sessionState.reason,
      req.originalUrl || req.path || '/admin/dashboard'
    );

    if (!req.session?.adminId) {
      return res.redirect(redirectTarget);
    }

    return destroyAdminSession(req, res).then(() => res.redirect(redirectTarget));
  }

  req.adminAccessVerified = true;
  return next();
}

function enforceFreshAdminAuth(req, res, next, maxAgeMs, eventType = 'fresh-auth-required') {
  const authenticatedAt = Number(req.session?.adminAuthenticatedAt || 0);
  const safeMaxAgeMs = Math.max(60 * 1000, Number(maxAgeMs) || 60 * 1000);

  if (authenticatedAt && Date.now() - authenticatedAt <= safeMaxAgeMs) {
    return next();
  }

  logAdminSecurityEvent(eventType, req, `max_age_ms=${safeMaxAgeMs}`);
  const redirectTarget = getFreshAdminLoginRedirect(req);
  return destroyAdminSession(req, res).then(() => res.redirect(redirectTarget));
}

function requireFreshAdminAuth(req, res, next) {
  return enforceFreshAdminAuth(req, res, next, ADMIN_SENSITIVE_ACTION_WINDOW_MS);
}

function requireFreshAdminDashboardAuth(req, res, next) {
  return enforceFreshAdminAuth(
    req,
    res,
    next,
    ADMIN_DASHBOARD_FRESH_AUTH_WINDOW_MS,
    'dashboard-fresh-auth-required'
  );
}

function toFieldArray(value, fallback = '') {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'undefined') {
    return [fallback];
  }

  return [value];
}

function makeBlankSubjects(count = MIN_SUBJECTS) {
  return Array.from({ length: clampSubjectCount(count) }, () => ({
    name: '',
    credit: '4',
    mode: '75-25',
    th: '',
    pr: '0',
  }));
}

function buildFormData(body = {}) {
  const subjectName = toFieldArray(body.subjectName, '');
  const credit = toFieldArray(body.credit, '4');
  const subjectMode = toFieldArray(body.subjectMode, '75-25');
  const th = toFieldArray(body.th, '');
  const pr = toFieldArray(body.pr, '0');

  const requestedSubjectCount = clampSubjectCount(body.subjectCount);
  const maxLength = Math.max(subjectName.length, credit.length, subjectMode.length, th.length, pr.length, requestedSubjectCount);
  const subjectCount = clampSubjectCount(maxLength);
  const subjects = [];

  for (let index = 0; index < subjectCount; index += 1) {
    const rawPr = pr[index];
    const normalizedPr = rawPr === '' || typeof rawPr === 'undefined' || rawPr === null ? '0' : rawPr;
    subjects.push({
      name: String(subjectName[index] || ''),
      credit: String(credit[index] || '4'),
      mode: String(subjectMode[index] || '75-25') === '50-50' ? '50-50' : '75-25',
      th: String(th[index] || ''),
      pr: String(normalizedPr),
    });
  }

  return {
    symbolNumber: String(body.symbolNumber || ''),
    studentName: String(body.studentName || ''),
    class: String(body.class || ''),
    section: String(body.section || ''),
    examType: String(body.examType || 'First term'),
    dateOfBirth: String(body.dateOfBirth || ''),
    subjectCount,
    subjects: subjects.length ? subjects : makeBlankSubjects(MIN_SUBJECTS),
  };
}

async function ensureAdminExists() {
  if (!ADMIN_SEED_ENABLED) {
    console.log('Admin bootstrap is disabled (ADMIN_SEED_ENABLED=false).');
    return;
  }

  const username = String(ADMIN_USERNAME || '').trim().toLowerCase();
  const plainPassword = String(ADMIN_PASSWORD || '');

  if (!username || !plainPassword) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set to seed the admin user.');
  }

  try {
    const existingAdmin = await Admin.findOne({ username });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(plainPassword, ADMIN_PASSWORD_HASH_ROUNDS);
      await Admin.create({ username, passwordHash });
      console.log('Bootstrap admin account created.');
    }
  } catch (error) {
    // Multiple workers can race on first boot; duplicate-key means admin already exists.
    if (error && error.code === 11000) {
      return;
    }
    throw error;
  }
}

const DEFAULT_POPUP_SETTINGS = {
  resultPortal: {
    enabled: true,
    message: 'The result portal is temporarily unavailable. Please contact the school administration for updates.',
  },
  resultPublished: {
    enabled: true,
    title: 'Result Has Been Published',
    message: 'The result has been published. Please check your symbol number now.',
    image: '/photos/cls12.jpg',
  },
  entranceOpen: {
    enabled: true,
    title: 'Computer Engineering Entrance Exam Is Open',
    message: 'Computer Engineering entrance exam is open. Contact school administration for application details.',
    image: '/photos/571812628_1277087307556453_2291941728688117624_n.jpg',
  },
  latestUpdates: [
    {
      title: 'Entrance form open for class 9',
      message: 'Admission open for new session. Contact school for details.',
    },
    {
      title: 'School Notice',
      message: 'Important notice for students and parents is available in school office.',
    },
    {
      title: 'Co-curricular Activities',
      message: 'Regular sports, cultural, and skill programs are running.',
    },
  ],
  principalMessage: {
    title: 'Message From the Principal',
    body: `Dear students, parents, and well wishers, I warmly welcome you to Kankai Secondary School. Our school stands for disciplined learning, respect, and opportunity for every child. I believe education should build both knowledge and character. Together we create a place where students feel safe to learn and grow.

We emphasize strong academic foundations along with practical skills. Teachers plan lessons that encourage curiosity, critical thinking, and teamwork. Students are guided to set goals and develop good study habits. When learning is consistent and purposeful, students gain confidence and joy in progress.

Our Computer Engineering program for grades 9 to 12 is a key strength of the school. It prepares learners for modern careers and builds useful skills in technology, logic, and creativity. At the same time, we continue to value language, science, arts, and social studies so students remain balanced. A complete education supports the whole child.

I appreciate the partnership of parents and guardians who support learning at home and stay connected with the school. Regular communication, meetings, and shared responsibility help students succeed. We also encourage participation in sports, ECA, and community service to develop leadership and discipline. These experiences build strong values and a caring mindset.

Thank you for trusting us with your child's education. My promise is to keep improving the school, supporting teachers, and maintaining a safe environment. With unity and hard work, we can help every student shine. I look forward to a successful journey together.`,
  },
  principalHome: {
    title: 'Message From the Principal',
    greeting: 'Dear Students / Parents and Guardians,',
    body: `It is my great pleasure to introduce Shree Kankai Secondary School Mai Nagarpalika-4, Danabari, Sitali, Ilam as a well-recognized community school of Ilam. It was founded in 2017 B.S and has managed to stand out among a group of high-quality education providers in the country.\n\nThis school, which is always motivated by a noble vision, aspires to make a significant contribution to nation-building. This school has provided time-tested instruction to all of its pupils since the beginning of its existence. It provides a vast array of options, both within and outside of our taught curriculum. This is a proven school with a positive attitude and a belief that anything is possible.`,
  },
  principalPage: {
    eyebrow: 'Message from the Principal',
    headline: 'Leading with purpose, discipline, and care',
    greeting: 'Dear Students, Parents, and Guardians,',
    body: `It is my great pleasure to welcome you to Shree Kankai Secondary School. We are dedicated to creating a learning environment that blends academic excellence with strong character, life skills, and practical knowledge. Our teachers and staff work together to guide every learner with respect, support, and high expectations.\n\nWe believe education opens minds and builds confidence. Our mission is to prepare students for SEE, +2, and beyond, by nurturing curiosity, discipline, and leadership. Thank you for trusting us with your child's future. We promise to continue building a vibrant school community where every student can thrive.`,
    quote: 'Education is not just about marks. It is about creating a lifelong love for learning, a sense of responsibility, and the courage to lead with kindness.',
  },
};

function sanitizeText(value, fallback, maxLength = 220) {
  const cleaned = String(value || '').trim().slice(0, maxLength);
  return cleaned || fallback;
}

function sanitizeImagePath(value, fallback) {
  const cleaned = String(value || '').trim();
  if (!cleaned) {
    return fallback;
  }
  if (cleaned.startsWith('/')) {
    return cleaned;
  }
  return `/${cleaned.replace(/^\/+/, '')}`;
}

function normalizeLatestUpdates(rawUpdates) {
  const source = Array.isArray(rawUpdates) ? rawUpdates : [];
  return DEFAULT_POPUP_SETTINGS.latestUpdates.map((defaultItem, index) => {
    const item = source[index] || {};
    return {
      title: sanitizeText(item.title, defaultItem.title, 120),
      message: sanitizeText(item.message, defaultItem.message, 320),
    };
  });
}

function normalizePopupSettings(raw = {}) {
  const resultPortal = raw.resultPortal || {};
  const resultPublished = raw.resultPublished || {};
  const entranceOpen = raw.entranceOpen || {};
  const principalMessage = raw.principalMessage || {};
  const principalHome = raw.principalHome || {};
  const principalPage = raw.principalPage || {};

  return {
    resultPortal: {
      enabled: typeof resultPortal.enabled === 'boolean' ? resultPortal.enabled : true,
      message: sanitizeText(resultPortal.message, DEFAULT_POPUP_SETTINGS.resultPortal.message, 320),
    },
    resultPublished: {
      enabled: Boolean(resultPublished.enabled),
      title: sanitizeText(resultPublished.title, DEFAULT_POPUP_SETTINGS.resultPublished.title, 120),
      message: sanitizeText(resultPublished.message, DEFAULT_POPUP_SETTINGS.resultPublished.message, 320),
      image: sanitizeImagePath(resultPublished.image, DEFAULT_POPUP_SETTINGS.resultPublished.image),
    },
    entranceOpen: {
      enabled: Boolean(entranceOpen.enabled),
      title: sanitizeText(entranceOpen.title, DEFAULT_POPUP_SETTINGS.entranceOpen.title, 120),
      message: sanitizeText(entranceOpen.message, DEFAULT_POPUP_SETTINGS.entranceOpen.message, 320),
      image: sanitizeImagePath(entranceOpen.image, DEFAULT_POPUP_SETTINGS.entranceOpen.image),
    },
    latestUpdates: normalizeLatestUpdates(raw.latestUpdates),
    principalMessage: {
      title: sanitizeText(principalMessage.title, DEFAULT_POPUP_SETTINGS.principalMessage.title, 120),
      body: sanitizeText(principalMessage.body, DEFAULT_POPUP_SETTINGS.principalMessage.body, 5000),
    },
    principalHome: {
      title: sanitizeText(principalHome.title, DEFAULT_POPUP_SETTINGS.principalHome.title, 120),
      greeting: sanitizeText(principalHome.greeting, DEFAULT_POPUP_SETTINGS.principalHome.greeting, 300),
      body: sanitizeText(principalHome.body, DEFAULT_POPUP_SETTINGS.principalHome.body, 5000),
    },
    principalPage: {
      eyebrow: sanitizeText(principalPage.eyebrow, DEFAULT_POPUP_SETTINGS.principalPage.eyebrow, 120),
      headline: sanitizeText(principalPage.headline, DEFAULT_POPUP_SETTINGS.principalPage.headline, 220),
      greeting: sanitizeText(principalPage.greeting, DEFAULT_POPUP_SETTINGS.principalPage.greeting, 300),
      body: sanitizeText(principalPage.body, DEFAULT_POPUP_SETTINGS.principalPage.body, 5000),
      quote: sanitizeText(principalPage.quote, DEFAULT_POPUP_SETTINGS.principalPage.quote, 1000),
    },
    updatedAt: raw.updatedAt || null,
  };
}

async function getPopupSettings() {
  if (popupSettingsCache.value && Date.now() < popupSettingsCache.expiresAt) {
    return popupSettingsCache.value;
  }

  let doc = await PopupSettings.findOne({ key: 'main' }).lean();

  if (!doc) {
    doc = await PopupSettings.create({
      key: 'main',
      resultPortal: DEFAULT_POPUP_SETTINGS.resultPortal,
      resultPublished: DEFAULT_POPUP_SETTINGS.resultPublished,
      entranceOpen: DEFAULT_POPUP_SETTINGS.entranceOpen,
      latestUpdates: DEFAULT_POPUP_SETTINGS.latestUpdates,
      principalMessage: DEFAULT_POPUP_SETTINGS.principalMessage,
      principalHome: DEFAULT_POPUP_SETTINGS.principalHome,
      principalPage: DEFAULT_POPUP_SETTINGS.principalPage,
    });
    const normalizedFromNewDoc = normalizePopupSettings(doc.toObject());
    popupSettingsCache.value = normalizedFromNewDoc;
    popupSettingsCache.expiresAt = Date.now() + POPUP_SETTINGS_CACHE_TTL_MS;
    return normalizedFromNewDoc;
  }

  const normalized = normalizePopupSettings(doc);
  popupSettingsCache.value = normalized;
  popupSettingsCache.expiresAt = Date.now() + POPUP_SETTINGS_CACHE_TTL_MS;
  return normalized;
}

function buildLatestUpdatesFromBody(body = {}, existingLatestUpdates = DEFAULT_POPUP_SETTINGS.latestUpdates) {
  const normalizedExistingUpdates = normalizeLatestUpdates(existingLatestUpdates);
  return DEFAULT_POPUP_SETTINGS.latestUpdates.map((defaultItem, index) => {
    const existingItem = normalizedExistingUpdates[index] || defaultItem;
    const fieldNumber = index + 1;
    return {
      title: sanitizeText(body[`latestUpdateTitle${fieldNumber}`], existingItem.title, 120),
      message: sanitizeText(body[`latestUpdateMessage${fieldNumber}`], existingItem.message, 320),
    };
  });
}

function buildPopupSettingsFromBody(body = {}, existing = DEFAULT_POPUP_SETTINGS) {
  return {
    key: 'main',
    resultPortal: {
      enabled: existing.resultPortal.enabled,
      message: sanitizeText(existing.resultPortal.message, DEFAULT_POPUP_SETTINGS.resultPortal.message, 320),
    },
    resultPublished: {
      enabled: body.resultPublishedEnabled === 'on',
      title: sanitizeText(body.resultPublishedTitle, existing.resultPublished.title, 120),
      message: sanitizeText(body.resultPublishedMessage, existing.resultPublished.message, 320),
      image: sanitizeImagePath(body.resultPublishedImage, existing.resultPublished.image),
    },
    entranceOpen: {
      enabled: body.entranceOpenEnabled === 'on',
      title: sanitizeText(body.entranceOpenTitle, existing.entranceOpen.title, 120),
      message: sanitizeText(body.entranceOpenMessage, existing.entranceOpen.message, 320),
      image: sanitizeImagePath(body.entranceOpenImage, existing.entranceOpen.image),
    },
    latestUpdates: buildLatestUpdatesFromBody(body, existing.latestUpdates),
    principalMessage: existing.principalMessage || DEFAULT_POPUP_SETTINGS.principalMessage,
    principalHome: existing.principalHome || DEFAULT_POPUP_SETTINGS.principalHome,
    principalPage: existing.principalPage || DEFAULT_POPUP_SETTINGS.principalPage,
  };
}

function getTodayNoticeDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sanitizeNoticeDate(value, fallback = getTodayNoticeDate()) {
  const cleaned = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : fallback;
}

function sanitizeNoticeLinkUrl(value) {
  const cleaned = String(value || '').trim();
  if (!cleaned) {
    return '';
  }
  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }
  if (/^www\./i.test(cleaned)) {
    return `https://${cleaned}`;
  }
  if (/^[a-z]+:/i.test(cleaned)) {
    return '';
  }
  if (cleaned.startsWith('/')) {
    return cleaned;
  }
  return `/${cleaned.replace(/^\/+/, '')}`;
}

function buildNoticeAdminRedirect({ message = '', error = '', editId = '' } = {}) {
  const params = new URLSearchParams();
  if (message) params.set('message', message);
  if (error) params.set('error', error);
  if (editId) params.set('edit', editId);
  const query = params.toString();
  return query ? `/admin/notices?${query}` : '/admin/notices';
}

function mapNoticeForPublic(notice) {
  const linkUrl = sanitizeNoticeLinkUrl(notice?.linkUrl);
  return {
    id: String(notice?._id || '').trim(),
    title: sanitizeText(notice?.title, 'School Notice', 120),
    message: sanitizeText(notice?.message, '', 720),
    publishedOn: sanitizeNoticeDate(notice?.publishedOn, getTodayNoticeDate()),
    pinned: Boolean(notice?.pinned),
    linkLabel: linkUrl ? sanitizeText(notice?.linkLabel, 'Read Notice', 40) : '',
    linkUrl,
  };
}

async function getManagedNotices({ activeOnly = false, limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 250);
  const query = activeOnly ? { active: true } : {};
  return Notice.find(query)
    .sort({ pinned: -1, publishedOn: -1, updatedAt: -1 })
    .limit(safeLimit)
    .lean();
}

async function renderAdminLogin(res, error = '', statusCode = 200, options = {}) {
  const popupSettings = await getPopupSettings().catch(() => DEFAULT_POPUP_SETTINGS);
  return res.status(statusCode).render('admin/login', {
    title: 'Admin Login',
    error,
    resultPortalEnabled: popupSettings.resultPortal.enabled,
    nextTarget: getSafeRedirectTarget(options.nextTarget, '/admin/dashboard'),
    reauthRequired: Boolean(options.reauthRequired),
    singleTabConflict: Boolean(options.singleTabConflict),
  });
}

function getAdminLoginMessage(req) {
  if (req.query.singletab === '1') {
    return 'This admin account is already open in another tab. Sign in here to switch tabs.';
  }
  if (req.query.security === '1') {
    return 'Security verification failed. Please sign in again.';
  }
  if (req.query.expired === '1') {
    return 'Your admin session expired. Please sign in again.';
  }
  if (req.query.reauth === '1') {
    return 'Please sign in again before opening this sensitive admin action.';
  }
  return '';
}

app.use((req, res, next) => {
  const needsAdminCsrfToken = req.path === '/admin/login' || req.path.startsWith('/admin/');
  if (needsAdminCsrfToken && req.session) {
    res.locals.csrfToken = ensureCsrfToken(req);
  } else {
    res.locals.csrfToken = '';
  }
  next();
});

app.use((req, res, next) => {
  const isProtectedPost = req.method === 'POST' && (req.path === '/admin/login' || req.path.startsWith('/admin/'));
  if (!isProtectedPost) {
    return next();
  }

  if (!isTrustedSameOriginRequest(req)) {
    return destroyAdminSession(req, res).then(() => res.redirect('/admin/login?security=1'));
  }

  if (!req.session) {
    return destroyAdminSession(req, res).then(() => res.redirect('/admin/login?security=1'));
  }

  const expectedToken = ensureCsrfToken(req);
  const bodyToken =
    req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body._csrf : '';
  const submittedToken = String(bodyToken || req.get('x-csrf-token') || '').trim();

  if (!submittedToken || !timingSafeEqualString(submittedToken, expectedToken)) {
    return destroyAdminSession(req, res).then(() => res.redirect('/admin/login?security=1'));
  }

  return next();
});

app.use((req, res, next) => {
  const isAdminWrite =
    req.method === 'POST' && req.path.startsWith('/admin/') && req.path !== '/admin/login';
  if (!isAdminWrite) {
    return next();
  }

  const attemptKey = getAdminWriteAttemptKey(req);
  if (isRateLimited(adminWriteAttempts, attemptKey, ADMIN_WRITE_RATE_LIMIT_MAX_ATTEMPTS, ADMIN_WRITE_RATE_LIMIT_WINDOW_MS)) {
    const retryAfter = getRateLimitSecondsRemaining(
      adminWriteAttempts,
      attemptKey,
      ADMIN_WRITE_RATE_LIMIT_WINDOW_MS
    );
    const preferredType = req.accepts(['json', 'html']);
    res.setHeader('Retry-After', String(retryAfter));
    logAdminSecurityEvent('write-rate-limit', req, `retry_after=${retryAfter}s`);

    if (preferredType === 'html') {
      return res
        .status(429)
        .send(`Too many admin changes were submitted. Please wait ${retryAfter} seconds and try again.`);
    }

    return res.status(429).json({
      error: `Too many admin changes were submitted. Please wait ${retryAfter} seconds and try again.`,
    });
  }

  registerRateLimitedAttempt(adminWriteAttempts, attemptKey, ADMIN_WRITE_RATE_LIMIT_WINDOW_MS);
  return next();
});

app.use('/admin', (req, res, next) => {
  const normalizedAdminPath = String(req.path || '').replace(/\/+$/, '') || '/';
  if (normalizedAdminPath === '/login' || normalizedAdminPath === '/session-status' || normalizedAdminPath === '/lock') {
    return next();
  }

  if (!req.session?.adminId) {
    const nextTarget = getSafeRedirectTarget(req.originalUrl || '/admin/dashboard', '/admin/dashboard');
    return res.redirect(`/admin/login?next=${encodeURIComponent(nextTarget)}`);
  }

  return requireAdmin(req, res, next);
});

function escapeHtml(value) {
  if (value === null || typeof value === 'undefined') {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STATIC_PAGES = [
  { route: '/', file: 'index.html' },
  { route: '/about', file: 'about.html' },
  { route: '/who-we-are', file: 'who-we-are.html' },
  { route: '/our-history', file: 'our-history.html' },
  { route: '/mission-vision', file: 'mission-vision.html' },
  { route: '/principal-message', file: 'principal-message.html' },
  { route: '/management-committee', file: 'management-committee.html' },
  { route: '/administrative-staff', file: 'administrative-staff.html' },
  { route: '/faculty-members', file: 'faculty-members.html' },
  { route: '/facilities', file: 'facilities.html' },
  { route: '/cafeteria', file: 'cafeteria.html' },
  { route: '/library', file: 'library.html' },
  { route: '/labs', file: 'labs.html' },
  { route: '/first-aid', file: 'first-aid.html' },
  { route: '/sports-eca', file: 'sports-eca.html' },
  { route: '/admissions', file: 'admissions.html' },
  { route: '/gallery', file: 'gallery.html' },
  { route: '/notice-board', file: 'notice-board.html' },
  { route: '/contact', file: 'contact.html' },
  { route: '/teachers', file: 'teachers.html' },
];

STATIC_PAGES.forEach(({ route, file }) => {
  const htmlPath = `/${file}`;

  app.get(route, (req, res) => {
    res.setHeader('Cache-Control', STATIC_HTML_CACHE_CONTROL);
    res.sendFile(path.join(FRONTEND_DIR, file));
  });

  if (htmlPath !== route) {
    app.get(htmlPath, (req, res) => res.redirect(301, route));
  }

  // Also handle "/index" style visits gracefully.
  if (route !== '/' && !route.endsWith('/')) {
    app.get(`${route}.html`, (req, res) => res.redirect(301, route));
  }
});

app.get('/academics', (req, res) => res.redirect(301, '/facilities'));
app.get('/academics.html', (req, res) => res.redirect(301, '/facilities'));

app.get('/styles.css', (req, res) => {
  res.setHeader('Cache-Control', STATIC_TEXT_ASSET_CACHE_CONTROL);
  res.sendFile(path.join(FRONTEND_DIR, 'styles.css'));
});

app.get('/script.js', (req, res) => {
  res.setHeader('Cache-Control', STATIC_TEXT_ASSET_CACHE_CONTROL);
  res.sendFile(path.join(FRONTEND_DIR, 'script.js'));
});

app.get('/result', async (req, res) => {
  try {
    const popupSettings = await getPopupSettings();
    if (!popupSettings.resultPortal.enabled) {
      return res.redirect('/');
    }

    return res.render('home', {
      title: 'Kankai Secondary School - Result Portal',
      resultPortal: popupSettings.resultPortal,
    });
  } catch {
    return res.render('home', {
      title: 'Kankai Secondary School - Result Portal',
      resultPortal: DEFAULT_POPUP_SETTINGS.resultPortal,
    });
  }
});

app.post('/result', async (req, res) => {
  const popupSettings = await getPopupSettings();
  if (!popupSettings.resultPortal.enabled) {
    return res.redirect('/');
  }

  const principalName = loadPrincipalProfile()?.name || 'Principal';
  const symbolNumber = String(req.body.symbolNumber || '').trim().toUpperCase();

  if (!symbolNumber) {
    return res.render('result', {
      title: 'Result Search',
      result: null,
      notFound: true,
      symbolNumber: '',
      errorMessage: 'Please enter a symbol number.',
      resultPortal: popupSettings.resultPortal,
      principalName,
    });
  }

  const cachedResult = getCachedResult(symbolNumber);
  const result =
    typeof cachedResult !== 'undefined'
      ? cachedResult
      : await Result.findOne({ symbolNumber }).lean();
  if (typeof cachedResult === 'undefined') {
    setCachedResult(symbolNumber, result || null);
  }

  if (!result) {
    return res.render('result', {
      title: 'Result Search',
      result: null,
      notFound: true,
      symbolNumber,
      errorMessage: 'No result found for the provided symbol number.',
      resultPortal: popupSettings.resultPortal,
      principalName,
    });
  }

  return res.render('result', {
    title: 'Result Found',
    result,
    notFound: false,
    symbolNumber,
    errorMessage: null,
    resultPortal: popupSettings.resultPortal,
    principalName,
  });
});


app.get('/admin', (req, res) => {
  const sessionState = getAdminSessionState(req);
  if (sessionState.ok) {
    return res.redirect('/admin/dashboard');
  }
  if (req.session?.adminId) {
    return destroyAdminSession(req, res).then(() =>
      res.redirect(getAdminLoginRedirectForReason(sessionState.reason, '/admin/dashboard'))
    );
  }
  return res.redirect('/admin/login');
});

app.get('/admin.html', (req, res) => {
  const sessionState = getAdminSessionState(req);
  if (sessionState.ok) {
    return res.redirect('/admin/dashboard');
  }
  if (req.session?.adminId) {
    return destroyAdminSession(req, res).then(() =>
      res.redirect(getAdminLoginRedirectForReason(sessionState.reason, '/admin/dashboard'))
    );
  }
  return res.redirect('/admin/login');
});

app.get('/admin-login.html', (req, res) => {
  return res.redirect('/admin/login');
});
app.get(['/admin/login', '/admin/login/'], (req, res) => {
  const renderPage = () =>
    renderAdminLogin(res, getAdminLoginMessage(req), 200, {
      nextTarget: req.query.next,
      reauthRequired: req.query.reauth === '1',
      singleTabConflict: req.query.singletab === '1',
    });

  if (req.session?.adminId && req.query.cleared !== '1') {
    const params = new URLSearchParams();
    const nextTarget = getSafeRedirectTarget(req.query.next, '/admin/dashboard');
    if (nextTarget) {
      params.set('next', nextTarget);
    }
    ['reauth', 'singletab', 'security', 'expired'].forEach((key) => {
      if (req.query[key] === '1') {
        params.set(key, '1');
      }
    });
    params.set('cleared', '1');
    const loginUrl = `/admin/login?${params.toString()}`;
    return destroyAdminSession(req, res).then(() => res.redirect(loginUrl));
  }

  return renderPage();
});

app.post('/admin/login', async (req, res) => {
  if (!req.session) {
    return renderAdminLogin(res, 'Session is not ready yet. Please refresh and try again.', 503, {
      nextTarget: req.body?.next,
      reauthRequired: req.query.reauth === '1',
      singleTabConflict: req.body?.singletab === '1' || req.query.singletab === '1',
    });
  }

  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const nextTarget = getSafeRedirectTarget(req.body.next || req.query.next, '/admin/dashboard');
  const singleTabTakeoverRequested = req.body.singletab === '1' || req.query.singletab === '1';
  const loginAttemptKey = getLoginAttemptKey(req, username || 'unknown');
  const ipAttemptKey = getLoginIpAttemptKey(req);
  const credentialBlocked = isLoginBlocked(loginAttemptKey, LOGIN_RATE_LIMIT_MAX_ATTEMPTS);
  const ipBlocked = isLoginBlocked(ipAttemptKey, LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS);

  if (credentialBlocked || ipBlocked) {
    const waitSeconds = Math.max(
      credentialBlocked ? getLockSecondsRemaining(loginAttemptKey) : 0,
      ipBlocked ? getLockSecondsRemaining(ipAttemptKey) : 0
    );
    return renderAdminLogin(
      res,
      `Too many failed attempts. Please wait ${waitSeconds} seconds and try again.`,
      429,
      {
        nextTarget,
        reauthRequired: req.query.reauth === '1',
        singleTabConflict: singleTabTakeoverRequested,
      }
    );
  }

  if (!isApprovedAdminIdentity(username)) {
    registerLoginFailure(loginAttemptKey);
    registerLoginFailure(ipAttemptKey);
    logAdminSecurityEvent('login-denied-unapproved-identity', req, `username=${username || 'unknown'}`);
    return renderAdminLogin(res, 'Invalid username or password.', 401, {
      nextTarget,
      reauthRequired: req.query.reauth === '1',
      singleTabConflict: singleTabTakeoverRequested,
    });
  }

  const admin = await Admin.findOne({ username });
  const passwordMatches = await bcrypt.compare(
    password,
    admin?.passwordHash || ADMIN_PASSWORD_FALLBACK_HASH
  );

  if (!admin || !passwordMatches) {
    registerLoginFailure(loginAttemptKey);
    registerLoginFailure(ipAttemptKey);
    logAdminSecurityEvent('login-failed', req, `username=${username || 'unknown'}`);
    return renderAdminLogin(res, 'Invalid username or password.', 401, {
      nextTarget,
      reauthRequired: req.query.reauth === '1',
      singleTabConflict: singleTabTakeoverRequested,
    });
  }

  const currentHashRounds = bcrypt.getRounds(admin.passwordHash);
  if (currentHashRounds < ADMIN_PASSWORD_HASH_ROUNDS) {
    try {
      admin.passwordHash = await bcrypt.hash(password, ADMIN_PASSWORD_HASH_ROUNDS);
      await admin.save();
      logAdminSecurityEvent('password-hash-upgraded', req, `rounds=${ADMIN_PASSWORD_HASH_ROUNDS}`);
    } catch (error) {
      console.error('Admin password hash upgrade failed:', error);
      return renderAdminLogin(res, 'Could not complete secure sign-in. Please try again.', 503, {
        nextTarget,
        reauthRequired: req.query.reauth === '1',
        singleTabConflict: singleTabTakeoverRequested,
      });
    }
  }

  clearLoginFailures(loginAttemptKey);
  clearLoginFailures(ipAttemptKey);
  try {
    await regenerateSession(req);
    req.session.adminId = admin._id.toString();
    req.session.adminUsername = admin.username;
    req.session.adminAuthenticatedAt = Date.now();
    req.session.adminLastSeenAt = Date.now();
    req.session.adminUserAgentBinding = buildAdminUserAgentBinding(req);
    req.session.adminNetworkBinding = buildAdminNetworkBinding(req);
    rotateCsrfToken(req);
    await saveSession(req);
  } catch (error) {
    console.error('Admin login session error:', error);
    return renderAdminLogin(res, 'Could not start a secure session. Please try again.', 503, {
      nextTarget,
      reauthRequired: req.query.reauth === '1',
      singleTabConflict: singleTabTakeoverRequested,
    });
  }

  if (singleTabTakeoverRequested) {
    const redirectUrl = new URL(nextTarget, 'http://localhost');
    redirectUrl.searchParams.set('admintakeover', '1');
    return res.redirect(`${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`);
  }

  return res.redirect(nextTarget);
});

app.get('/admin/logout', requireAdmin, (req, res) => {
  return destroyAdminSession(req, res).then(() => res.redirect('/admin/login'));
});

app.post('/admin/logout', requireAdmin, (req, res) => {
  const nextTarget = getSafeRedirectTarget(req.body.next, '/');
  return destroyAdminSession(req, res).then(() => res.redirect(nextTarget));
});

app.get('/admin/session-status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  const nextTarget = getSafeAdminNextTarget(req.query.next || req.get('x-admin-next'), '/admin/dashboard');
  const sessionState = getAdminSessionState(req);

  if (sessionState.ok) {
    return res.json({
      authenticated: true,
      username: String(req.session?.adminUsername || ''),
      expiresInMs: sessionState.expiresInMs,
      idleTimeoutMs: sessionState.idleTimeoutMs,
    });
  }

  if (sessionState.reason === 'security') {
    logAdminSecurityEvent('session-binding-mismatch', req);
  }

  const payload = {
    authenticated: false,
    reason: sessionState.reason,
    redirect: getAdminLoginRedirectForReason(sessionState.reason, nextTarget),
  };

  if (!req.session?.adminId) {
    return res.status(401).json(payload);
  }

  return destroyAdminSession(req, res).then(() => res.status(401).json(payload));
});

app.post('/admin/lock', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  if (!isTrustedSameOriginRequest(req)) {
    return res.status(403).json({ ok: false });
  }

  await destroyAdminSession(req, res);
  return res.status(204).end();
});

app.get('/admin/dashboard', requireAdmin, requireFreshAdminDashboardAuth, async (req, res) => {
  const DEFAULT_LATEST_LIMIT = 4;
  const MAX_LATEST_LIMIT = 100;
  const latestLimitRaw = Number.parseInt(req.query.latest, 10);
  const latestLimit = Number.isFinite(latestLimitRaw)
    ? Math.min(Math.max(latestLimitRaw, DEFAULT_LATEST_LIMIT), MAX_LATEST_LIMIT)
    : DEFAULT_LATEST_LIMIT;
  const totalResults = await Result.countDocuments();
  const latestResults = await Result.find().sort({ createdAt: -1 }).limit(latestLimit).lean();
  const popupSettings = await getPopupSettings();

  res.render('admin/dashboard', {
    title: 'Admin Dashboard',
    totalResults,
    latestResults,
    latestLimit,
    popupSettings,
    message: String(req.query.message || ''),
  });
});

app.get('/admin/teachers', requireAdmin, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const teachers = loadTeachers();
  const editId = String(req.query.edit || '').trim();
  const editingTeacher = editId ? teachers.find((teacher) => teacher.id === editId) || null : null;
  const requestedError = String(req.query.error || '');
  const error =
    requestedError || (editId && !editingTeacher ? 'Teacher not found for editing.' : '');

  res.render('admin/teachers', {
    title: 'Teacher Management',
    teachers,
    editingTeacher,
    message: String(req.query.message || ''),
    error,
  });
});

app.get('/admin/gallery', requireAdmin, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const albums = listManagedGalleryAlbums({ includeEmpty: true });

  res.render('admin/gallery', {
    title: 'Gallery Management',
    albums,
    galleryVersion: getGalleryCacheVersion(),
    message: String(req.query.message || ''),
    error: String(req.query.error || ''),
  });
});

app.get('/admin/principal', requireAdmin, async (req, res) => {
  const popupSettings = await getPopupSettings();
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.render('admin/principal', {
    title: 'Principal Messages',
    popupSettings,
    message: String(req.query.message || ''),
    error: String(req.query.error || ''),
  });
});

app.get('/admin/notices', requireAdmin, async (req, res) => {
  const notices = await getManagedNotices({ activeOnly: false, limit: 250 });
  const popupSettings = await getPopupSettings();
  const editId = String(req.query.edit || '').trim();
  const editingNotice =
    editId && mongoose.Types.ObjectId.isValid(editId)
      ? notices.find((notice) => String(notice._id) === editId) || null
      : null;
  const requestedError = String(req.query.error || '').trim();
  const error =
    requestedError || (editId && !editingNotice ? 'Notice not found for editing.' : '');

  res.render('admin/notices', {
    title: 'Notice Management',
    notices,
    popupSettings,
    editingNotice,
    message: String(req.query.message || ''),
    error,
    todayNoticeDate: getTodayNoticeDate(),
  });
});

app.post('/admin/dashboard/popup-settings', requireAdmin, async (req, res) => {
  const current = await getPopupSettings();
  const nextSettings = buildPopupSettingsFromBody(req.body, current);

  await PopupSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: nextSettings },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  popupSettingsCache.value = null;
  popupSettingsCache.expiresAt = 0;

  return res.redirect('/admin/dashboard?message=Popup%20settings%20updated%20successfully.');
});

app.post('/admin/dashboard/principal-message', requireAdmin, async (req, res) => {
  const current = await getPopupSettings();
  const principalMessage = {
    title: sanitizeText(req.body.principalMessageTitle, current.principalMessage.title, 120),
    body: sanitizeText(req.body.principalMessageBody, current.principalMessage.body, 5000),
  };

  await PopupSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: { principalMessage } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  popupSettingsCache.value = null;
  popupSettingsCache.expiresAt = 0;

  return res.redirect('/admin/dashboard?message=Principal%20message%20updated%20successfully.');
});

app.post('/admin/principal', requireAdmin, async (req, res) => {
  const current = await getPopupSettings();
  const principalHome = {
    title: sanitizeText(req.body.principalHomeTitle, current.principalHome.title, 120),
    greeting: sanitizeText(req.body.principalHomeGreeting, current.principalHome.greeting, 300),
    body: sanitizeText(req.body.principalHomeBody, current.principalHome.body, 5000),
  };
  const principalPage = {
    eyebrow: sanitizeText(req.body.principalPageEyebrow, current.principalPage.eyebrow, 120),
    headline: sanitizeText(req.body.principalPageHeadline, current.principalPage.headline, 220),
    greeting: sanitizeText(req.body.principalPageGreeting, current.principalPage.greeting, 300),
    body: sanitizeText(req.body.principalPageBody, current.principalPage.body, 5000),
    quote: sanitizeText(req.body.principalPageQuote, current.principalPage.quote, 1000),
  };
  const principalMessage = {
    title: sanitizeText(req.body.principalMessageTitle, current.principalMessage.title, 120),
    body: sanitizeText(req.body.principalMessageBody, current.principalMessage.body, 5000),
  };

  await PopupSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: { principalHome, principalPage, principalMessage } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  popupSettingsCache.value = null;
  popupSettingsCache.expiresAt = 0;

  return res.redirect('/admin/principal?message=Principal%20messages%20updated%20successfully.');
});

app.post('/admin/dashboard/result-portal', requireAdmin, async (req, res) => {
  const current = await getPopupSettings();
  const nextSettings = {
    ...current,
    resultPortal: {
      enabled: req.body.resultPortalEnabled === 'on',
      message: sanitizeText(req.body.resultPortalMessage, current.resultPortal.message, 320),
    },
  };

  await PopupSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: { resultPortal: nextSettings.resultPortal } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  popupSettingsCache.value = null;
  popupSettingsCache.expiresAt = 0;

  return res.redirect('/admin/dashboard?message=Result%20portal%20visibility%20updated%20successfully.');
});

app.get('/api/index-popup-settings', async (req, res) => {
  res.setHeader('Cache-Control', PUBLIC_API_CACHE_CONTROL);
  const popupSettings = await getPopupSettings();
  res.json(popupSettings);
});

app.get('/api/notices', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20;
  const notices = await getManagedNotices({ activeOnly: true, limit });
  res.json(notices.map(mapNoticeForPublic));
});

app.get('/api/teachers', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const teachers = loadTeachers()
    .map((teacher) => sanitizeTeacherForPublic(teacher))
    .filter(Boolean);
  res.json(teachers);
});

app.get('/api/principal-profile', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const principalProfile = loadPrincipalProfile();
  res.json(principalProfile);
});

app.get('/api/gallery-version', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getPublicGalleryVersionPayload());
});

app.get('/api/gallery-albums', (req, res) => {
  const galleryVersion = getGalleryCacheVersion();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Gallery-Version', String(galleryVersion));
  res.json(listManagedGalleryAlbums({ includeEmpty: false }).map(serializePublicGalleryAlbum));
});

app.get('/api/gallery-images', (req, res) => {
  const galleryVersion = getGalleryCacheVersion();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Gallery-Version', String(galleryVersion));
  res.json(listManagedGalleryImagePaths());
});

app.post('/api/admission-request', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  try {
    await runAdmissionUpload(req, res);
  } catch (error) {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Each file must be 8 MB or smaller.' });
      }

      return res.status(400).json({ error: 'Please upload only the latest grade sheet and student photo.' });
    }

    const uploadMessage = error instanceof Error ? error.message : 'Unable to read the uploaded files.';
    return res.status(400).json({ error: uploadMessage });
  }

  const studentName = sanitizeText(req.body.studentName, '', 140);
  const applyingGrade = sanitizeText(req.body.applyingGrade, '', 60);
  const dateOfBirth = sanitizeText(req.body.dateOfBirth, '', 40);
  const previousSchool = sanitizeText(req.body.previousSchool, '', 160);
  const parentName = sanitizeText(req.body.parentName, '', 140);
  const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
  const email = normalizeEmailAddress(req.body.email);
  const address = sanitizeText(req.body.address, '', 240);
  const additionalNotes = sanitizeText(req.body.additionalNotes, '', 1200);
  const latestGradeSheet = getUploadedAdmissionFile(req.files, 'latestGradeSheet');
  const studentPhoto = getUploadedAdmissionFile(req.files, 'studentPhoto');

  if (!studentName || !applyingGrade || !dateOfBirth || !parentName || !phoneNumber || !email || !address) {
    return res.status(400).json({ error: 'Please fill in all required admission details.' });
  }

  if (!latestGradeSheet || !studentPhoto) {
    return res.status(400).json({ error: 'Please attach both the latest grade sheet and the student photo.' });
  }

  const submission = {
    studentName,
    applyingGrade,
    dateOfBirth,
    previousSchool,
    parentName,
    phoneNumber,
    email,
    address,
    additionalNotes,
    latestGradeSheet,
    studentPhoto,
    submittedAt: new Date(),
  };

  let savedRequest = null;
  try {
    savedRequest = saveAdmissionRequest(submission);
  } catch (error) {
    console.error('Failed to save admission request:', error);
    return res.status(500).json({
      error: 'Unable to save the admission request right now. Please contact the school office directly.',
    });
  }

  const { subject, text, html } = buildAdmissionMailPayload(submission);

  if (!isAdmissionMailerConfigured() || (!isGmailSmtpHost(SMTP_HOST) && admissionMailerAuthFailed)) {
    return res.status(503).json({
      error: 'Admission request was saved, but Gmail is not configured correctly yet.',
      requestId: savedRequest.id,
    });
  }

  const delivery = enqueueOutboundMail(
    {
      from: ADMISSION_EMAIL_FROM,
      to: ADMISSION_EMAIL_TO,
      replyTo: email,
      subject,
      text,
      html,
      attachments: [
        {
          filename: path.basename(latestGradeSheet.originalname || 'latest-grade-sheet'),
          content: latestGradeSheet.buffer,
          contentType: latestGradeSheet.mimetype,
        },
        {
          filename: path.basename(studentPhoto.originalname || 'student-photo'),
          content: studentPhoto.buffer,
          contentType: studentPhoto.mimetype,
        },
      ],
    },
    'admission request email'
  );

  if (!delivery) {
    return res.status(503).json({
      error: 'Admission request was saved, but the Gmail queue is busy. Please try again in a moment.',
      requestId: savedRequest.id,
    });
  }

  const delivered = await delivery;
  if (!delivered) {
    return res.status(502).json({
      error: 'Admission request was saved, but Gmail delivery failed. Please check the server console.',
      requestId: savedRequest.id,
    });
  }

  return res.json({
    message: 'Admission request received and emailed successfully.',
    requestId: savedRequest.id,
  });
});

app.post('/api/contact-request', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!isAdmissionMailerConfigured()) {
    return res.status(503).json({
      error: 'Contact email is not configured on the server yet. Please call the school office directly.',
    });
  }

  const fullName = sanitizeText(req.body.fullName, '', 140);
  const email = normalizeEmailAddress(req.body.email);
  const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
  const subjectInput = sanitizeText(req.body.subject, '', 180);
  const messageInput = sanitizeText(req.body.message, '', 3000);

  if (!fullName || !email || !phoneNumber || !subjectInput || !messageInput) {
    return res.status(400).json({ error: 'Please fill in all required contact details.' });
  }

  const submission = {
    fullName,
    email,
    phoneNumber,
    subject: subjectInput,
    message: messageInput,
    submittedAt: new Date(),
  };

  const { subject, text, html } = buildContactMailPayload(submission);
  const delivery = enqueueOutboundMail(
    {
      from: ADMISSION_EMAIL_FROM,
      to: ADMISSION_EMAIL_TO,
      replyTo: email,
      subject,
      text,
      html,
    },
    'contact inquiry email'
  );

  if (!delivery) {
    return res.status(503).json({
      error: 'Contact requests are busy right now. Please try again in a moment.',
    });
  }

  const delivered = await delivery;
  if (!delivered) {
    return res.status(502).json({
      error: 'Contact email could not be delivered right now. Please call the school office directly.',
    });
  }

  return res.json({
    message: 'Message received successfully. We will contact you soon.',
  });
});

app.post(
  '/admin/teachers/upload-photo',
  requireAdmin,
  express.raw({
    limit: MAX_TEACHER_PHOTO_UPLOAD_BYTES,
    type(req) {
      const contentType = String(req.headers['content-type'] || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      return contentType.startsWith('image/') || contentType === 'application/octet-stream';
    },
  }),
  async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    const photoBuffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!photoBuffer || !photoBuffer.length) {
      return res.status(400).json({ error: 'Select an image file to upload.' });
    }

    if (photoBuffer.length > MAX_TEACHER_PHOTO_UPLOAD_BYTES) {
      return res.status(400).json({ error: 'Image is too large. Use a file smaller than 8 MB.' });
    }

    const originalFileName = String(req.query.fileName || '').trim();
    const teacherName = String(req.query.teacherName || '').trim();
    const extension = getTeacherPhotoExtension(req.get('content-type'), originalFileName);
    if (!extension) {
      return res.status(400).json({ error: 'Use JPG, PNG, WEBP, or GIF image files only.' });
    }

    const originalBaseName = path.basename(originalFileName, path.extname(originalFileName));
    const safeBaseName = slugifyTeacherName(teacherName || originalBaseName, 'teacher-photo');
    const uniqueSuffix = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const fileName = `${safeBaseName}-${uniqueSuffix}${extension}`;
    const relativePath = `photos/Teacher/${fileName}`;
    const absolutePaths = uniqueResolvedPaths([
      path.join(TEACHER_PHOTO_DIR, fileName),
      ...getTeacherPhotoMutationAbsolutePaths(relativePath, { createIfMissing: true }),
    ]);

    try {
      absolutePaths.forEach((absolutePath) => {
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, photoBuffer);
      });
      return res.json({
        message: 'Photo uploaded successfully.',
        path: relativePath,
      });
    } catch (error) {
      console.error('Failed to save teacher photo:', error);
      return res.status(500).json({ error: 'Unable to save the teacher photo right now.' });
    }
  }
);

app.post('/admin/gallery/albums', requireAdmin, (req, res) => {
  const requestedName = String(req.body.albumName || '').trim();
  const albumName = sanitizeGalleryAlbumName(requestedName);

  if (!albumName) {
    return res.redirect(buildGalleryAdminRedirect({ error: 'Album name is required.' }));
  }

  if (isIgnoredGalleryDir(albumName)) {
    return res.redirect(buildGalleryAdminRedirect({ error: 'That album name is reserved. Choose a different one.' }));
  }

  const existingAlbum = listManagedGalleryAlbumNames().find(
    (name) => name.toLowerCase() === albumName.toLowerCase()
  );
  if (existingAlbum) {
    return res.redirect(
      buildGalleryAdminRedirect({
        error: 'Album already exists.',
        albumName: existingAlbum,
      })
    );
  }

  const albumPath = getGalleryAlbumAbsolutePath(albumName);
  if (!albumPath) {
    return res.redirect(buildGalleryAdminRedirect({ error: 'Use a valid album name.' }));
  }

  try {
    const createdAlbumPaths = getGalleryAlbumMutationAbsolutePaths(albumName, { createIfMissing: true });
    if (!createdAlbumPaths.length) {
      throw new Error('No writable gallery storage targets are available.');
    }
    refreshGalleryCacheState();
    return res.redirect(
      buildGalleryAdminRedirect({
        message: 'Album created successfully.',
        albumName,
      })
    );
  } catch (error) {
    console.error('Failed to create gallery album:', error);
    return res.redirect(buildGalleryAdminRedirect({ error: 'Unable to create album right now.' }));
  }
});

app.post(
  '/admin/gallery/upload-photo',
  requireAdmin,
  (req, res, next) => {
    galleryUpload.fields([
      { name: 'photo', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ])(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File is too large. Use images under 12 MB or videos under 15 MB.' });
        }

        return res.status(400).json({ error: 'Use only one gallery file and one thumbnail image per upload.' });
      }

      if (error) {
        return res.status(400).json({ error: error.message || 'Unable to read the uploaded gallery file.' });
      }

      return next();
    });
  },
  async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    const requestedAlbumName = String(req.query.albumName || '').trim();
    const albumName =
      listManagedGalleryAlbumNames().find((name) => name.toLowerCase() === requestedAlbumName.toLowerCase()) || '';
    if (!albumName) {
      return res.status(400).json({ error: 'Select a valid album before uploading photos.' });
    }

    const uploadedFiles = req.files && typeof req.files === 'object' ? req.files : {};
    const photoUpload = Array.isArray(uploadedFiles.photo) ? uploadedFiles.photo[0] : null;
    const thumbnailUpload = Array.isArray(uploadedFiles.thumbnail) ? uploadedFiles.thumbnail[0] : null;
    const photoBuffer = photoUpload?.buffer || null;
    if (!photoBuffer || !photoBuffer.length) {
      return res.status(400).json({ error: 'Select an image or small video file to upload.' });
    }

    const originalFileName = String(photoUpload?.originalname || '').trim();
    const declaredExtension = getGalleryMediaExtension(photoUpload?.mimetype, originalFileName);
    const declaredIsVideo =
      GALLERY_VIDEO_ALLOWED_EXTENSIONS.has(declaredExtension) ||
      String(photoUpload?.mimetype || '').toLowerCase().startsWith('video/');
    const detectedVideoExtension = detectGalleryVideoExtension(photoBuffer);
    if (declaredIsVideo && !detectedVideoExtension) {
      return res.status(400).json({ error: 'The selected video is not a valid MP4 or WEBM file.' });
    }

    const extension = detectedVideoExtension || declaredExtension;
    const isVideoUpload = Boolean(detectedVideoExtension);
    const videoMuted = String(req.body?.videoMuted || '1').trim() !== '0';
    const maxUploadBytes = isVideoUpload ? MAX_GALLERY_VIDEO_UPLOAD_BYTES : MAX_GALLERY_PHOTO_UPLOAD_BYTES;

    if (photoBuffer.length > maxUploadBytes) {
      return res.status(400).json({
        error: isVideoUpload
          ? 'Video is too large. Keep gallery videos smaller than 15 MB.'
          : 'Image is too large. Use a file smaller than 12 MB.',
      });
    }

    if (isVideoUpload && photoBuffer.length < MIN_GALLERY_VIDEO_UPLOAD_BYTES) {
      return res.status(400).json({ error: 'This video file is incomplete. Please select the original MP4 or WEBM file again.' });
    }

    if (thumbnailUpload?.buffer?.length > MAX_GALLERY_THUMB_UPLOAD_BYTES) {
      return res.status(400).json({ error: 'Thumbnail image is too large. Keep it smaller than 1 MB.' });
    }

    if (!extension) {
      return res.status(400).json({ error: 'Use JPG, PNG, WEBP, GIF, MP4, or WEBM files only.' });
    }

    const originalBaseName = path.basename(originalFileName, path.extname(originalFileName));
    const safeBaseName = slugifyAssetName(originalBaseName, 'gallery-photo');
    const uniqueSuffix = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const fileName = `${safeBaseName}-${uniqueSuffix}${extension}`;

    try {
      const albumPath = ensureMutableGalleryAlbumMirror(albumName, { createIfMissing: true });
      if (!albumPath) {
        return res.status(400).json({ error: 'Select a valid album before uploading photos.' });
      }

      const albumWritePaths = uniqueResolvedPaths([
        albumPath,
        ...getGalleryAlbumMutationAbsolutePaths(albumName, { createIfMissing: true }),
      ]);
      const absolutePhotoPath = path.join(albumPath, fileName);
      const relativePhotoPath = path.posix.join('photos', albumName, fileName);
      albumWritePaths.forEach((writeAlbumPath) => {
        fs.mkdirSync(writeAlbumPath, { recursive: true });
        const destinationPath = path.join(writeAlbumPath, fileName);
        fs.writeFileSync(destinationPath, photoBuffer);
        const savedSize = fs.statSync(destinationPath).size;
        if (savedSize !== photoBuffer.length) {
          throw new Error('Gallery media file was not saved completely.');
        }
        if (thumbnailUpload?.buffer?.length) {
          const thumbnailPath = getGalleryThumbnailAbsolutePath(writeAlbumPath, fileName);
          const thumbnailDir = getGalleryThumbnailDirectoryAbsolutePath(writeAlbumPath);
          if (thumbnailPath && thumbnailDir) {
            fs.mkdirSync(thumbnailDir, { recursive: true });
            fs.writeFileSync(thumbnailPath, thumbnailUpload.buffer);
          }
        }
      });
      setGalleryPhotoHiddenState(albumName, fileName, false);
      if (isVideoUpload) {
        setGalleryMediaSettings(albumName, fileName, { muted: videoMuted });
      }
      refreshGalleryCacheState();
      const galleryVersion = getGalleryCacheVersion();
      const savedPhoto = buildGalleryPhotoRecord(albumName, albumPath, fileName);
      if (!savedPhoto) {
        throw new Error('The uploaded media file could not be read after saving.');
      }
      await saveGalleryMediaCatalogRecord({
        albumName,
        fileName,
        photo: savedPhoto,
        mimeType: isVideoUpload
          ? (extension === '.webm' ? 'video/webm' : 'video/mp4')
          : photoUpload.mimetype,
        sizeBytes: photoBuffer.length,
      });
      return res.json({
        message: isVideoUpload ? 'Video uploaded successfully.' : 'Photo uploaded successfully.',
        path: relativePhotoPath,
        fileName,
        albumName,
        anchor: getGalleryAlbumAnchor(albumName),
        galleryVersion,
        photo: savedPhoto,
      });
    } catch (error) {
      console.error('Failed to save gallery media:', error);
      const message = error && /gallery media record/i.test(String(error.message || ''))
        ? 'Video file was saved, but its MongoDB record could not be created. Please try again.'
        : 'Unable to save the gallery media right now.';
      return res.status(500).json({ error: message });
    }
  }
);

app.post('/admin/gallery/photos/delete', requireAdmin, async (req, res) => {
  const albumName = String(req.body.albumName || '').trim();
  const photoName = path.basename(String(req.body.photoName || '').trim());
  let albumPaths = [];

  try {
    const mirroredAlbumPath = ensureMutableGalleryAlbumMirror(albumName, { createIfMissing: false });
    albumPaths = uniqueResolvedPaths([
      ...(mirroredAlbumPath ? [mirroredAlbumPath] : []),
      ...getGalleryAlbumMutationAbsolutePaths(albumName, { createIfMissing: false }),
      ...getAuthoritativeGalleryAlbumAbsolutePaths(albumName),
    ]);
  } catch (error) {
    console.error('Failed to prepare gallery album for delete:', error);
    if (setGalleryPhotoHiddenState(albumName, photoName, true)) {
      removeGalleryMediaSettings(albumName, photoName);
      refreshGalleryCacheState();
      return res.redirect(
        buildGalleryAdminRedirect({
          message: 'Photo removed successfully.',
          albumName,
        })
      );
    }

    return res.redirect(
      buildGalleryAdminRedirect({
        error: 'Unable to remove the photo right now.',
        albumName,
      })
    );
  }

  if (!albumPaths.length) {
    return res.redirect(buildGalleryAdminRedirect({ error: 'Gallery album not found.' }));
  }

  if (!photoName || !isGalleryMediaFile(photoName)) {
    return res.redirect(
      buildGalleryAdminRedirect({
        error: 'Photo not found.',
        albumName,
      })
    );
  }

  let resolvedPhoto = null;
  albumPaths.some((albumPath) => {
    const candidatePath = path.resolve(albumPath, photoName);
    const relativePhotoPath = path.relative(albumPath, candidatePath);
    if (!relativePhotoPath || relativePhotoPath.startsWith('..') || path.isAbsolute(relativePhotoPath)) {
      return false;
    }
    if (!fs.existsSync(candidatePath)) {
      return false;
    }

    resolvedPhoto = {
      albumPath,
      absolutePhotoPath: candidatePath,
    };
    return true;
  });

  if (!resolvedPhoto) {
    if (isGalleryPhotoHidden(albumName, photoName) || setGalleryPhotoHiddenState(albumName, photoName, true)) {
      removeGalleryMediaSettings(albumName, photoName);
      refreshGalleryCacheState();
      return res.redirect(
        buildGalleryAdminRedirect({
          message: 'Photo removed successfully.',
          albumName,
        })
      );
    }

    return res.redirect(
      buildGalleryAdminRedirect({
        error: 'Photo does not exist anymore.',
        albumName,
      })
    );
  }

  try {
    let removedPrimaryPhoto = false;
    let primaryDeleteError = null;

    try {
      removedPrimaryPhoto = removeFileIfPresent(resolvedPhoto.absolutePhotoPath, {
        maxRetries: 4,
        retryDelayMs: 120,
        throwOnError: true,
      });
    } catch (error) {
      primaryDeleteError = error;
    }

    if (!removedPrimaryPhoto && fs.existsSync(resolvedPhoto.absolutePhotoPath)) {
      const trashResult = moveGalleryFileToTrashIfPresent(
        resolvedPhoto.albumPath,
        albumName,
        resolvedPhoto.absolutePhotoPath,
        {
          maxRetries: 3,
          retryDelayMs: 120,
        }
      );

      if (!trashResult.moved && !trashResult.missing) {
        const deleteFailure =
          primaryDeleteError || trashResult.error || new Error('Primary gallery photo could not be removed.');
        if (!setGalleryPhotoHiddenState(albumName, photoName, true)) {
          throw deleteFailure;
        }
      }
    }

    albumPaths.forEach((albumPath) => {
      const absolutePhotoPath = path.resolve(albumPath, photoName);
      const relativePhotoPath = path.relative(albumPath, absolutePhotoPath);
      if (!relativePhotoPath || relativePhotoPath.startsWith('..') || path.isAbsolute(relativePhotoPath)) {
        return;
      }

      if (albumPath !== resolvedPhoto.albumPath) {
        try {
          const removedPhoto = removeFileIfPresent(absolutePhotoPath, {
            maxRetries: 2,
            retryDelayMs: 80,
            throwOnError: false,
          });
          if (!removedPhoto && fs.existsSync(absolutePhotoPath)) {
            const trashPhotoResult = moveGalleryFileToTrashIfPresent(albumPath, albumName, absolutePhotoPath, {
              maxRetries: 2,
              retryDelayMs: 80,
            });

            if (!trashPhotoResult.moved && !trashPhotoResult.missing) {
              console.warn(`Failed to remove mirrored gallery photo "${absolutePhotoPath}":`, trashPhotoResult.error);
            }
          }
        } catch (photoError) {
          console.warn(`Failed to remove mirrored gallery photo "${absolutePhotoPath}":`, photoError);
        }
      }

      getGalleryThumbnailAbsolutePaths(albumPath, photoName).forEach((thumbnailPath) => {
        try {
          const removedThumbnail = removeFileIfPresent(thumbnailPath, {
            maxRetries: 2,
            retryDelayMs: 80,
            throwOnError: false,
          });
          if (!removedThumbnail && fs.existsSync(thumbnailPath)) {
            const trashThumbnailResult = moveGalleryFileToTrashIfPresent(
              albumPath,
              albumName,
              thumbnailPath,
              {
                maxRetries: 2,
                retryDelayMs: 80,
              }
            );

            if (!trashThumbnailResult.moved && !trashThumbnailResult.missing) {
              console.warn(`Failed to remove gallery thumbnail "${thumbnailPath}":`, trashThumbnailResult.error);
            }
          }
        } catch (thumbnailError) {
          console.warn(`Failed to remove gallery thumbnail "${thumbnailPath}":`, thumbnailError);
        }
      });
    });

    removeGalleryMediaSettings(albumName, photoName);
    await GalleryMedia.deleteOne({ albumName, fileName: photoName }).exec();
    refreshGalleryCacheState();
    return res.redirect(
      buildGalleryAdminRedirect({
        message: 'Photo removed successfully.',
        albumName,
      })
    );
  } catch (error) {
    console.error('Failed to delete gallery photo:', error);
    if (setGalleryPhotoHiddenState(albumName, photoName, true)) {
      removeGalleryMediaSettings(albumName, photoName);
      refreshGalleryCacheState();
      return res.redirect(
        buildGalleryAdminRedirect({
          message: 'Photo removed successfully.',
          albumName,
        })
      );
    }

    return res.redirect(
      buildGalleryAdminRedirect({
        error: 'Unable to remove the photo right now.',
        albumName,
      })
    );
  }
});

app.post('/admin/gallery/photos/audio', requireAdmin, async (req, res) => {
  const albumName = String(req.body.albumName || '').trim();
  const photoName = path.basename(String(req.body.photoName || '').trim());

  if (!albumName || !photoName || !isGalleryVideoFile(photoName)) {
    return res.redirect(
      buildGalleryAdminRedirect({
        error: 'Select a valid video before changing audio settings.',
        albumName,
      })
    );
  }

  const albumPaths = getExistingGalleryAlbumAbsolutePaths(albumName);
  const videoExists = albumPaths.some((albumPath) => {
    const absolutePhotoPath = path.resolve(albumPath, photoName);
    const relativePhotoPath = path.relative(albumPath, absolutePhotoPath);
    return (
      relativePhotoPath &&
      !relativePhotoPath.startsWith('..') &&
      !path.isAbsolute(relativePhotoPath) &&
      fs.existsSync(absolutePhotoPath)
    );
  });

  if (!videoExists) {
    return res.redirect(
      buildGalleryAdminRedirect({
        error: 'Video does not exist anymore.',
        albumName,
      })
    );
  }

  const muted = Boolean(req.body.muted);
  if (!setGalleryMediaSettings(albumName, photoName, { muted })) {
    return res.redirect(
      buildGalleryAdminRedirect({
        error: 'Unable to update video audio setting right now.',
        albumName,
      })
    );
  }

  await GalleryMedia.updateOne(
    { albumName, fileName: photoName, mediaType: 'video' },
    { $set: { muted } }
  ).exec();

  refreshGalleryCacheState();
  return res.redirect(
    buildGalleryAdminRedirect({
      message: muted ? 'Video muted successfully.' : 'Video unmuted successfully.',
      albumName,
    })
  );
});

app.post('/admin/gallery/albums/delete', requireAdmin, async (req, res) => {
  const albumName = String(req.body.albumName || '').trim();
  const mutableAlbumPath = getExistingMutableGalleryAlbumAbsolutePath(albumName);
  const albumPaths = uniqueResolvedPaths([
    ...getGalleryAlbumMutationAbsolutePaths(albumName, { createIfMissing: false }),
    ...getExistingGalleryAlbumAbsolutePaths(albumName),
  ]);

  if (!albumPaths.length) {
    return res.redirect(buildGalleryAdminRedirect({ error: 'Gallery album not found.' }));
  }

  const deleteErrors = [];
  let deletedCount = 0;

  albumPaths.forEach((albumPath) => {
    try {
      fs.rmSync(albumPath, { recursive: true, force: true, maxRetries: 2, retryDelay: 80 });
      deletedCount += 1;
    } catch (error) {
      deleteErrors.push({ albumPath, error });
    }
  });

  if (!deletedCount) {
    deleteErrors.forEach(({ albumPath, error }) => {
      console.error(`Failed to delete gallery album "${albumName}" at "${albumPath}":`, error);
    });
    return res.redirect(buildGalleryAdminRedirect({ error: 'Unable to remove the album right now.' }));
  }

  await GalleryMedia.deleteMany({ albumName }).exec();

  refreshGalleryCacheState();
  const remainingAlbumPaths = getExistingGalleryAlbumAbsolutePaths(albumName);
  const message =
    mutableAlbumPath && remainingAlbumPaths.length
      ? 'Uploaded album removed from storage. Built-in album files still exist.'
      : 'Album removed successfully.';

  return res.redirect(buildGalleryAdminRedirect({ message }));
});

app.post('/admin/teachers', requireAdmin, (req, res) => {
  const editId = String(req.body.id || '').trim();
  const name = String(req.body.name || '').trim();
  const role = String(req.body.role || '').trim();
  const qualification = String(req.body.qualification || '').trim();
  const experience = String(req.body.experience || '').trim().slice(0, 80);
  const email = String(req.body.email || '').trim().slice(0, 120);
  const imagePath = String(req.body.img || '').trim();
  const department = normalizeTeacherDepartmentValue(req.body.department);
  const requestedSection = normalizeTeacherSectionValue(req.body.section);
  const section = getTeacherExclusiveRoleKeyFromRole(role) === 'principal'
    ? 'administrative'
    : requestedSection;
  const placementInput = String(req.body.departmentPosition || '').trim();
  const departmentPosition = placementInput ? Number(placementInput) : null;
  const isManagementSection = section === 'management';
  const managementCommitteeRoles = ['Chairperson', 'Member', 'Member Secretary'];
  const isManagementRole = managementCommitteeRoles.includes(role);

  if (isManagementSection !== isManagementRole) {
    return res.redirect(
      buildTeacherAdminRedirect({
        error: isManagementSection
          ? 'Choose Chairperson, Member, or Member Secretary for a Management Committee profile.'
          : 'Committee roles can only be used in the Management Committee section.',
        editId,
      })
    );
  }

  if (isManagementSection && !departmentPosition) {
    return res.redirect(
      buildTeacherAdminRedirect({
        error: 'Choose a numbered position for the Management Committee card.',
        editId,
      })
    );
  }

  if (isManagementSection && !imagePath) {
    return res.redirect(
      buildTeacherAdminRedirect({
        error: 'Add a photo for the Management Committee card.',
        editId,
      })
    );
  }

  if (placementInput && (!Number.isInteger(departmentPosition) || departmentPosition < 1)) {
    return res.redirect(
      buildTeacherAdminRedirect({
        error: 'Section position must be a whole number starting from 1.',
        editId,
      })
    );
  }
  if (!name || !role || (!isManagementSection && (!experience || !department || !email))) {
    return res.redirect(
      buildTeacherAdminRedirect({
        error: isManagementSection
          ? 'Name and role are required.'
          : 'Name, role, department, experience, and email are required.',
        editId,
      })
    );
  }

  const teachers = loadTeachers();
  const normalizedName = name.toLowerCase();
  const normalizedRole = role.toLowerCase();
  const normalizedQualification = qualification.toLowerCase();
  const duplicate = teachers.find((teacher) => {
    if (editId && teacher?.id === editId) {
      return false;
    }
    const currentName = String(teacher?.name || '').trim().toLowerCase();
    const currentRole = String(teacher?.role || teacher?.position || '').trim().toLowerCase();
    const currentQualification = String(teacher?.qualification || '').trim().toLowerCase();
    return (
      currentName === normalizedName &&
      currentRole === normalizedRole &&
      currentQualification === normalizedQualification
    );
  });

  if (duplicate) {
    return res.redirect(
      buildTeacherAdminRedirect({
        error: 'Teacher already exists.',
        editId,
      })
    );
  }

  const exclusiveRoleKey = getTeacherExclusiveRoleKeyFromRole(role);
  if (exclusiveRoleKey) {
    const conflictingTeacher = teachers.find((teacher) => {
      if (editId && teacher?.id === editId) {
        return false;
      }
      return getTeacherExclusiveRoleKey(teacher) === exclusiveRoleKey;
    });

    if (conflictingTeacher) {
      return res.redirect(
        buildTeacherAdminRedirect({
          error: `Only one ${getTeacherExclusiveRoleLabel(exclusiveRoleKey)} can be shown in the teacher section.`,
          editId,
        })
      );
    }
  }

  if (editId) {
    const teacherIndex = teachers.findIndex((teacher) => teacher.id === editId);
    if (teacherIndex === -1) {
      return res.redirect(buildTeacherAdminRedirect({ error: 'Teacher not found.' }));
    }

    const existingTeacher = teachers[teacherIndex];
    const previousImagePath = String(existingTeacher?.img || '').trim();
    const nextTeacher = {
      ...existingTeacher,
      id: editId,
      name,
      role,
      section: section || inferTeacherSection(existingTeacher),
      qualification,
      experience,
      email,
      department,
      img: imagePath,
      alt: name,
    };

    delete nextTeacher.position;
    delete nextTeacher.phone;

    Object.keys(nextTeacher).forEach((key) => {
      if (!nextTeacher[key]) delete nextTeacher[key];
    });

    teachers[teacherIndex] = nextTeacher;
    if (departmentPosition) {
      applyTeacherSectionPlacement(teachers, nextTeacher, departmentPosition);
    }
    saveTeachers(teachers);

    const imageChanged = normalizeAssetPath(previousImagePath) !== normalizeAssetPath(nextTeacher.img);
    let message = 'Teacher updated successfully.';
    if (imageChanged) {
      const photoDeleteResult = deleteTeacherPhotoIfUnused(previousImagePath, teachers);
      if (photoDeleteResult.deleted) {
        message = 'Teacher updated and old photo removed successfully.';
      } else if (photoDeleteResult.error) {
        console.error('Failed to delete replaced teacher photo:', photoDeleteResult.error);
        message = 'Teacher updated, but the old photo could not be deleted.';
      }
    }

    return res.redirect(buildTeacherAdminRedirect({ message }));
  }

  const id = `${slugifyTeacherName(name)}-${Date.now().toString(36)}`;

  const teacher = {
    id,
    name,
    role,
    section: section || 'faculty',
    qualification,
    experience,
    email,
    department,
    img: imagePath,
    alt: name,
  };

  Object.keys(teacher).forEach((key) => {
    if (!teacher[key]) delete teacher[key];
  });

  applyTeacherSectionPlacement(teachers, teacher, departmentPosition);

  let insertIndex = -1;
  teachers.forEach((existingTeacher, index) => {
    if (inferTeacherSection(existingTeacher) === teacher.section) {
      insertIndex = index + 1;
    }
  });

  if (insertIndex === -1) {
    teachers.push(teacher);
  } else {
    teachers.splice(insertIndex, 0, teacher);
  }
  saveTeachers(teachers);
  return res.redirect(buildTeacherAdminRedirect({ message: 'Teacher added successfully.' }));
});

app.post('/admin/teachers/delete', requireAdmin, (req, res) => {
  const id = String(req.body.id || '').trim();
  if (!id) {
    return res.redirect('/admin/teachers?error=Teacher%20id%20is%20missing.');
  }

  const teachers = loadTeachers();
  const removedTeacher = teachers.find((teacher) => teacher.id === id);
  const next = teachers.filter((teacher) => teacher.id !== id);
  if (next.length === teachers.length) {
    return res.redirect('/admin/teachers?error=Teacher%20not%20found.');
  }

  saveTeachers(next);

  const photoDeleteResult = deleteTeacherPhotoIfUnused(removedTeacher?.img, next);
  if (photoDeleteResult.error) {
    console.error('Failed to delete removed teacher photo:', photoDeleteResult.error);
  }

  let message = 'Teacher removed successfully.';
  if (photoDeleteResult.deleted) {
    message = 'Teacher and photo removed successfully.';
  } else if (photoDeleteResult.error) {
    message = 'Teacher removed, but the photo could not be deleted.';
  } else if (removedTeacher?.img && photoDeleteResult.skippedReason === 'used-elsewhere') {
    message = 'Teacher removed. Photo was kept because it is still used elsewhere.';
  }

  return res.redirect(`/admin/teachers?message=${encodeURIComponent(message)}`);
});

app.post('/admin/notices', requireAdmin, async (req, res) => {
  const noticeId = String(req.body.id || '').trim();
  const title = String(req.body.title || '').trim().slice(0, 120);
  const message = String(req.body.message || '').trim().slice(0, 720);
  const publishedOn = sanitizeNoticeDate(req.body.publishedOn, getTodayNoticeDate());
  const linkUrl = sanitizeNoticeLinkUrl(req.body.linkUrl);
  const linkLabel = linkUrl ? sanitizeText(req.body.linkLabel, 'Read Notice', 40) : '';
  const payload = {
    title,
    message,
    publishedOn,
    pinned: req.body.pinned === 'on',
    active: req.body.active === 'on',
    linkLabel,
    linkUrl,
  };

  if (!title) {
    return res.redirect(
      buildNoticeAdminRedirect({ error: 'Notice title is required.', editId: noticeId })
    );
  }

  if (!message) {
    return res.redirect(
      buildNoticeAdminRedirect({ error: 'Notice message is required.', editId: noticeId })
    );
  }

  if (noticeId) {
    if (!mongoose.Types.ObjectId.isValid(noticeId)) {
      return res.redirect(
        buildNoticeAdminRedirect({ error: 'Notice not found.', editId: noticeId })
      );
    }

    const existingNotice = await Notice.findById(noticeId).select('_id').lean();
    if (!existingNotice) {
      return res.redirect(
        buildNoticeAdminRedirect({ error: 'Notice not found.', editId: noticeId })
      );
    }

    await Notice.findByIdAndUpdate(noticeId, { $set: payload });
    return res.redirect(buildNoticeAdminRedirect({ message: 'Notice updated successfully.' }));
  }

  await Notice.create(payload);
  return res.redirect(buildNoticeAdminRedirect({ message: 'Notice added successfully.' }));
});

app.post('/admin/notices/latest-updates', requireAdmin, async (req, res) => {
  const current = await getPopupSettings();
  const latestUpdates = buildLatestUpdatesFromBody(req.body, current.latestUpdates);

  await PopupSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: { latestUpdates } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  popupSettingsCache.value = null;
  popupSettingsCache.expiresAt = 0;

  return res.redirect('/admin/notices?message=Latest%20updates%20saved%20successfully.');
});

app.post('/admin/notices/delete', requireAdmin, async (req, res) => {
  const noticeId = String(req.body.id || '').trim();
  if (!noticeId || !mongoose.Types.ObjectId.isValid(noticeId)) {
    return res.redirect('/admin/notices?error=Notice%20not%20found.');
  }

  const deletedNotice = await Notice.findByIdAndDelete(noticeId);
  if (!deletedNotice) {
    return res.redirect('/admin/notices?error=Notice%20not%20found.');
  }

  return res.redirect('/admin/notices?message=Notice%20deleted%20successfully.');
});

app.get('/admin/add-result', requireAdmin, (req, res) => {
  res.render('admin/add-result', {
    title: 'Add Result',
    error: '',
    success: '',
    formData: buildFormData({ subjectCount: MIN_SUBJECTS }),
  });
});

async function saveResultHandler(req, res) {
  const formData = buildFormData(req.body);
  const subjectCount = clampSubjectCount(formData.subjectCount);

  const symbolNumber = formData.symbolNumber.trim().toUpperCase();
  const studentName = formData.studentName.trim();
  const className = formData.class.trim();
  const section = formData.section.trim().toUpperCase().replace(/^SECTION\s*/i, '');
  const examType = formData.examType.trim() || 'First term';
  const dateOfBirth = formData.dateOfBirth.trim();

  if (!symbolNumber || !studentName || !className) {
    return res.status(400).render('admin/add-result', {
      title: 'Add Result',
      error: 'Symbol number, student name, and class are required.',
      success: '',
      formData,
    });
  }

  const duplicate = await Result.findOne({ symbolNumber });
  if (duplicate) {
    return res.status(409).render('admin/add-result', {
      title: 'Add Result',
      error: 'Duplicate symbol number. Please use a unique symbol number.',
      success: '',
      formData,
    });
  }

  const subjectInputs = parseSubjectInputs(req.body);

  if (
    subjectInputs.length < MIN_SUBJECTS ||
    subjectInputs.length > MAX_SUBJECTS ||
    subjectInputs.length !== subjectCount
  ) {
    return res.status(400).render('admin/add-result', {
      title: 'Add Result',
      error: `Please provide complete details for ${subjectCount} subjects (minimum ${MIN_SUBJECTS}, maximum ${MAX_SUBJECTS}).`,
      success: '',
      formData,
    });
  }

  const calculated = calculateResult(subjectInputs);

  await Result.create({
    symbolNumber,
    studentName,
    class: className,
    section,
    examType,
    dateOfBirth,
    subjects: calculated.subjects,
    totalObtained: calculated.totalObtained,
    totalMax: calculated.totalMax,
    percentage: calculated.percentage,
    overallGrade: calculated.overallGrade,
    overallGPA: calculated.overallGPA,
  });
  setCachedResult(symbolNumber, {
    symbolNumber,
    studentName,
    class: className,
    section,
    examType,
    dateOfBirth,
    subjects: calculated.subjects,
    totalObtained: calculated.totalObtained,
    totalMax: calculated.totalMax,
    percentage: calculated.percentage,
    overallGrade: calculated.overallGrade,
    overallGPA: calculated.overallGPA,
  });

  return res.render('admin/add-result', {
    title: 'Add Result',
    error: '',
    success: 'Result saved successfully.',
    formData: buildFormData({ subjectCount: MIN_SUBJECTS }),
  });
}

app.post('/admin/save-result', requireAdmin, saveResultHandler);
app.post('/admin/add-result', requireAdmin, saveResultHandler);

app.get('/admin/view-results', requireAdmin, async (req, res) => {
  const results = await Result.find().sort({ createdAt: -1 }).lean();

  res.render('admin/view-results', {
    title: 'View Results',
    results,
    message: String(req.query.message || ''),
  });
});

app.get('/admin/export-results', requireAdmin, requireFreshAdminAuth, async (req, res) => {
  const results = await Result.find().sort({ createdAt: -1 }).lean();
  if (!results.length) {
    return res.redirect('/admin/dashboard?message=No%20data%20available%20to%20export.');
  }

  const toNumericMark = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const toTotalMark = (subject) => {
    const th = toNumericMark(subject?.th);
    const pr = toNumericMark(subject?.pr);

    if (th !== null && pr !== null) return th + pr;
    if (th !== null) return th;
    if (pr !== null) return pr;
    return '';
  };

  const escapeExcelValue = (value) => escapeHtml(value === null || typeof value === 'undefined' ? '' : value);

  const getResultStatus = (item) => {
    const failingGradeValues = new Set(['F', 'NG']);
    const hasFailingSubject = Array.isArray(item?.subjects)
      && item.subjects.some((subject) => failingGradeValues.has(String(subject?.finalGrade || subject?.grade || '').trim().toUpperCase()));
    const overallGradeValue = String(item?.overallGrade || '').trim().toUpperCase();
    return overallGradeValue === 'NG' || overallGradeValue === 'F' || hasFailingSubject
      ? 'Fail'
      : 'Pass';
  };

  const getOverallGpaDisplay = (item) => {
    if (getResultStatus(item) === 'Fail') return 'NG';

    const overallGpaValue = Number(item?.overallGPA);
    return Number.isFinite(overallGpaValue)
      ? overallGpaValue.toFixed(3)
      : (String(item?.overallGPA || '').trim() || '-');
  };

  const extractClassRank = (className) => {
    const normalized = String(className || '').toLowerCase();
    const numberMatch = normalized.match(/\d{1,2}/);
    if (numberMatch) {
      const gradeNumber = Number(numberMatch[0]);
      if (gradeNumber >= 9 && gradeNumber <= 12) return gradeNumber;
      return 100 + gradeNumber;
    }

    if (/\bix\b/.test(normalized)) return 9;
    if (/\bxii\b/.test(normalized)) return 12;
    if (/\bxi\b/.test(normalized)) return 11;
    if (/\bx\b/.test(normalized)) return 10;
    return 999;
  };

  const parseClassSectionFromResult = (item) => {
    const rawClass = String(item.class || '').trim();
    let className = rawClass || 'Unclassified';
    let sectionName = String(item.section || '')
      .trim()
      .toUpperCase()
      .replace(/^SECTION\s*/i, '');

    if (!sectionName && rawClass) {
      const sectionWordMatch = rawClass.match(/^(.*?)(?:\s*[-/]?\s*section\s*([A-Z]))$/i);
      if (sectionWordMatch) {
        className = String(sectionWordMatch[1] || '').trim() || 'Unclassified';
        sectionName = String(sectionWordMatch[2] || '')
          .trim()
          .toUpperCase();
      } else {
        const trailingSectionMatch = rawClass.match(/^(.*?(?:\d|ix|x|xi|xii))\s*([A-Z])$/i);
        if (trailingSectionMatch) {
          className = String(trailingSectionMatch[1] || '').trim() || 'Unclassified';
          sectionName = String(trailingSectionMatch[2] || '')
            .trim()
            .toUpperCase();
        }
      }
    }

    if (sectionName && !/^[A-Z0-9-]{1,6}$/.test(sectionName)) {
      sectionName = '';
    }

    return { className, sectionName };
  };

  const extractSectionRank = (sectionName) => {
    const normalized = String(sectionName || '')
      .trim()
      .toUpperCase();
    if (!normalized) return 999;
    if (/^[A-Z]$/.test(normalized)) return normalized.charCodeAt(0) - 64;
    return 500;
  };

  const groupedByClassSection = new Map();
  results.forEach((item) => {
    const parsed = parseClassSectionFromResult(item);
    const groupKey = `${parsed.className}|||${parsed.sectionName}`;

    if (!groupedByClassSection.has(groupKey)) {
      groupedByClassSection.set(groupKey, {
        className: parsed.className,
        sectionName: parsed.sectionName,
        records: [],
      });
    }

    groupedByClassSection.get(groupKey).records.push(item);
  });

  const sortedGroups = Array.from(groupedByClassSection.values()).sort((a, b) => {
    const rankA = extractClassRank(a.className);
    const rankB = extractClassRank(b.className);
    if (rankA !== rankB) return rankA - rankB;

    const classNameOrder = a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: 'base' });
    if (classNameOrder !== 0) return classNameOrder;

    const sectionRankA = extractSectionRank(a.sectionName);
    const sectionRankB = extractSectionRank(b.sectionName);
    if (sectionRankA !== sectionRankB) return sectionRankA - sectionRankB;

    return String(a.sectionName || '').localeCompare(String(b.sectionName || ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  const classTablesHtml = sortedGroups
    .map((group) => {
      const classResults = group.records
        .slice()
        .sort((a, b) =>
          String(a.symbolNumber || '').localeCompare(String(b.symbolNumber || ''), undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        );

      const subjectNameMap = new Map();
      classResults.forEach((item) => {
        const subjects = Array.isArray(item.subjects) ? item.subjects : [];
        subjects.forEach((subject) => {
          const subjectName = String(subject?.name || '').trim();
          const key = subjectName.toLowerCase();
          if (subjectName && !subjectNameMap.has(key)) {
            subjectNameMap.set(key, subjectName);
          }
        });
      });

      const subjectHeaders = Array.from(subjectNameMap.values());
      const fallbackMaxCount = classResults.reduce((maxCount, item) => {
        const count = Array.isArray(item.subjects) ? item.subjects.length : 0;
        return Math.max(maxCount, count);
      }, 0);
      const fallbackHeaders = Array.from({ length: fallbackMaxCount }, (_, index) => `Subject ${index + 1}`);
      const headers = subjectHeaders.length > 0 ? subjectHeaders : fallbackHeaders;
      const topHeaderHtml = [
        '<th rowspan="2">Symbol Number</th>',
        '<th rowspan="2">Student Name</th>',
        ...headers.map((columnName) => `<th colspan="2">${escapeHtml(columnName)}</th>`),
        '<th colspan="2">Summary</th>',
      ].join('');
      const subHeaderHtml = [
        ...headers.flatMap(() => ['<th>TH</th>', '<th>INR</th>']),
        '<th>GPA</th>',
        '<th>Result</th>',
      ].join('');

      const rowHtml = classResults
        .map((item) => {
          const subjects = Array.isArray(item.subjects) ? item.subjects : [];
          const subjectDataByName = new Map();

          subjects.forEach((subject, index) => {
            const subjectName = String(subject?.name || '').trim();
            const subjectKey = subjectName.toLowerCase();
            const thMark = toNumericMark(subject?.th);
            const inrMark = toNumericMark(subject?.pr);
            const totalMark = toTotalMark(subject);

            if (subjectName && subjectKey) {
              subjectDataByName.set(subjectKey, {
                th: thMark,
                inr: inrMark,
                total: totalMark,
              });
            } else if (!subjectHeaders.length) {
              subjectDataByName.set(`subject ${index + 1}`.toLowerCase(), {
                th: thMark,
                inr: inrMark,
                total: totalMark,
              });
            }
          });

          const markCells = headers
            .map((subjectName) => {
              const subjectData = subjectDataByName.get(String(subjectName).toLowerCase()) || {};
              return [
                `<td>${escapeExcelValue(subjectData.th)}</td>`,
                `<td>${escapeExcelValue(subjectData.inr)}</td>`,
              ].join('');
            })
            .join('');
          const symbolNumberForExcel = escapeHtml(String(item.symbolNumber || ''));
          const overallGpaForExcel = escapeHtml(getOverallGpaDisplay(item));
          const resultStatusForExcel = escapeHtml(getResultStatus(item));

          return `<tr>
<td class="symbol-text">${symbolNumberForExcel}</td>
<td>${escapeHtml(item.studentName)}</td>
${markCells}
<td>${overallGpaForExcel}</td>
<td>${resultStatusForExcel}</td>
</tr>`;
        })
        .join('');

      const groupTitle = group.sectionName
        ? `${group.className} - Section ${group.sectionName}`
        : `${group.className} - No Section`;

      return `<section class="class-block">
<h2>${escapeHtml(groupTitle)}</h2>
<table>
<thead>
<tr>${topHeaderHtml}</tr>
<tr>${subHeaderHtml}</tr>
</thead>
<tbody>${rowHtml}</tbody>
</table>
</section>`;
    })
    .join('');

  const excelHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Calibri, Arial, sans-serif; color: #1f2937; background: #f8fbff; }
    h1 { font-size: 24px; margin: 0 0 8px 0; color: #0f3d75; }
    .meta { margin: 0 0 18px 0; color: #4b5563; font-size: 12px; }
    .class-block { margin-bottom: 30px; }
    h2 { font-size: 16px; margin: 0 0 10px 0; color: #1f4e78; }
    table { border-collapse: collapse; min-width: 980px; background: #ffffff; }
    th, td { border: 1px solid #2f2f2f; padding: 7px 10px; text-align: center; }
    thead tr:first-child th { background: #bfdbfe; color: #12315d; font-weight: 700; }
    thead tr:nth-child(2) th { background: #e0f2fe; color: #17436c; font-weight: 700; }
    tbody tr:nth-child(even) td { background: #f8fbff; }
    .symbol-text { mso-number-format: "\\@"; }
  </style>
</head>
<body>
  <h1>Kankai Result Export</h1>
  <p class="meta">Generated: ${escapeHtml(new Date().toLocaleString())} | Subject columns show TH and INR.</p>
  ${classTablesHtml || '<p>No records found.</p>'}
</body>
</html>`;

  const timestamp = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="kankai-results-${timestamp}.xls"`);
  return res.send(`\uFEFF${excelHtml}`);
});

app.get('/admin/clear-db', requireAdmin, requireFreshAdminAuth, (req, res) => {
  res.render('admin/clear-db', {
    title: 'Clear Database',
    error: '',
    success: '',
  });
});

app.post('/admin/clear-db', requireAdmin, requireFreshAdminAuth, async (req, res) => {
  const confirmExport = req.body.confirmExport === 'on';
  const confirmDelete = req.body.confirmDelete === 'on';
  const adminPassword = String(req.body.adminPassword || '');

  if (!confirmExport) {
    return res.status(400).render('admin/clear-db', {
      title: 'Clear Database',
      error: 'Please export all data to Excel first and confirm the backup checkbox.',
      success: '',
    });
  }

  if (!confirmDelete) {
    return res.status(400).render('admin/clear-db', {
      title: 'Clear Database',
      error: 'You must check the confirmation checkbox.',
      success: '',
    });
  }

  if (!timingSafeEqualString(adminPassword, CLEAR_DB_SECRET)) {
    return res.status(401).render('admin/clear-db', {
      title: 'Clear Database',
      error: 'Invalid clear database password.',
      success: '',
    });
  }

  await Result.deleteMany({});
  clearResultCache();

  return res.render('admin/clear-db', {
    title: 'Clear Database',
    error: '',
    success: 'All result records have been permanently deleted.',
  });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }

  const looksLikeAssetRequest = /\.(?!html?$)[a-z0-9]{1,8}$/i.test(req.path);
  const preferredType = req.accepts(['html', 'json', 'text']);
  if (looksLikeAssetRequest || preferredType !== 'html') {
    return res.status(404).type('text/plain').send('Not found.');
  }

  res.status(404);
  res.setHeader('Cache-Control', STATIC_HTML_CACHE_CONTROL);
  return res.sendFile(path.join(FRONTEND_DIR, '404.html'));
});

async function connectMongoWithFallback() {
  const mongoConnectOptions = {
    maxPoolSize: MONGO_MAX_POOL_SIZE,
    minPoolSize: MONGO_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: MONGO_SOCKET_TIMEOUT_MS,
  };
  const candidates = getMongoConnectionCandidates();
  let lastError = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const nextCandidate = candidates[index + 1];

    try {
      await mongoose.connect(candidate.uri, mongoConnectOptions);
      console.log(`MongoDB connected successfully (${candidate.label}).`);
      return;
    } catch (error) {
      lastError = error;

      if (!nextCandidate) {
        break;
      }

      const failurePrefix = isMongoSrvLookupFailure(error)
        ? `MongoDB SRV lookup failed (${error.message}).`
        : `MongoDB connection via ${candidate.label} failed (${error.message}).`;
      console.warn(`${failurePrefix} Trying ${nextCandidate.label}...`);

      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.disconnect();
        } catch { }
      }
    }
  }

  throw lastError;
}

connectMongoWithFallback()
  .then(async () => {
    await ensureAdminExists();
    warmAdmissionMailer();
    const server = app.listen(PORT, HOST);
    server.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the existing server or set a different PORT.`);
      } else {
        console.error('Server failed to start:', error);
      }
      process.exit(1);
    });
    server.once('listening', () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });
