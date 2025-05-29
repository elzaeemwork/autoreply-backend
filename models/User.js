const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  messageCount: {
    type: Number,
    default: 0
  },
  freeMessagesRemaining: {
    type: Number,
    default: 50
  },
  activationCode: {
    type: String,
    default: null
  },
  activationExpiry: {
    type: Date,
    default: null
  },
  activationType: {
    type: String,
    enum: ['temp', 'full'],
    default: 'temp'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
