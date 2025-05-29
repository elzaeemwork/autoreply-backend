const mongoose = require('mongoose');

const activationCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['temp', 'full'],
    required: true
  },
  duration: {
    type: Number,
    required: true // Duration in days
  },
  used: {
    type: Boolean,
    default: false
  },
  usedBy: {
    type: String,
    default: null
  },
  usedAt: {
    type: Date,
    default: null
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for efficient queries
activationCodeSchema.index({ used: 1 });
activationCodeSchema.index({ code: 1, used: 1 });

module.exports = mongoose.model('ActivationCode', activationCodeSchema);
