const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  phone: {
    type: String,
    // unique: true
  },
  countryCode: {
    type: String,
    // default: "+971"
  },

  role: {
    type: String,
    enum: ['superadmin', 'admin'],
    default: 'admin'
  },

  branches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreBranch'
  }],
  selectedBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreBranch'
  },

  otp: {
    otp: {
      type: Number
    },
    expiresAt: {
      type: Date
    },
    chances: {
      type: Number,
      default: 3,
      min: 0,
      max: 3
    }
  },

  isActive: {
    type: Boolean,
    default: true
  },

  lastLogin: {
    type: Date
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Admin', adminSchema);
