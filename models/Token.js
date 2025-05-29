const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    required: true
  },
  instagramAccount: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
});

const tokenSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  facebookId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  accounts: [accountSchema],
  connectedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Token', tokenSchema);
