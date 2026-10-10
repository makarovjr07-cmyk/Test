const mongoose = require('mongoose');

const PopupItemSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    image: { type: String, default: '' },
  },
  { _id: false }
);

const LatestUpdateSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    message: { type: String, default: '' },
  },
  { _id: false }
);

const PrincipalMessageSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Message From the Principal' },
    body: { type: String, default: '' },
  },
  { _id: false }
);

const PrincipalHomeSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Message From the Principal' },
    greeting: { type: String, default: 'Dear Students / Parents and Guardians,' },
    body: { type: String, default: '' },
  },
  { _id: false }
);

const PrincipalPageSchema = new mongoose.Schema(
  {
    eyebrow: { type: String, default: 'Message from the Principal' },
    headline: { type: String, default: 'Leading with purpose, discipline, and care' },
    greeting: { type: String, default: 'Dear Students, Parents, and Guardians,' },
    body: { type: String, default: '' },
    quote: { type: String, default: '' },
  },
  { _id: false }
);

const PopupSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'main' },
    resultPortal: {
      enabled: { type: Boolean, default: true },
      message: {
        type: String,
        default: 'The result portal is temporarily unavailable. Please contact the school administration for updates.',
      },
    },
    resultPublished: {
      type: PopupItemSchema,
      default: () => ({
        enabled: true,
        title: 'Result Has Been Published',
        message: 'The result has been published. Please check your symbol number now.',
        image: '/photos/cls12.jpg',
      }),
    },
    entranceOpen: {
      type: PopupItemSchema,
      default: () => ({
        enabled: true,
        title: 'Computer Engineering Entrance Open',
        message: 'Computer Engineering entrance exam is open. Apply from school administration office.',
        image: '/photos/571812628_1277087307556453_2291941728688117624_n.jpg',
      }),
    },
    latestUpdates: {
      type: [LatestUpdateSchema],
      default: () => ([
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
      ]),
    },
    principalMessage: {
      type: PrincipalMessageSchema,
      default: () => ({ title: 'Message From the Principal', body: '' }),
    },
    principalHome: {
      type: PrincipalHomeSchema,
      default: () => ({
        title: 'Message From the Principal',
        greeting: 'Dear Students / Parents and Guardians,',
        body: '',
      }),
    },
    principalPage: {
      type: PrincipalPageSchema,
      default: () => ({
        eyebrow: 'Message from the Principal',
        headline: 'Leading with purpose, discipline, and care',
        greeting: 'Dear Students, Parents, and Guardians,',
        body: '',
        quote: '',
      }),
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PopupSettings', PopupSettingsSchema);
