const mongoose = require('mongoose');

const deliveryExecutiveSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  avatar:{
    type: String,
  },
  admin_saved:{
    type: Boolean,
    default: false,
    required: true
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
  status:{
    type: String,
    enum: ['available', 'busy', 'driving'],
    default: 'busy',
    required: true
  },

//   role: {
//     type: String,
//     enum: ['driver',],
//     default: 'admin'
//   },

  branches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreBranch'
  }],
  // selectedBranch: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'StoreBranch'
  // },
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

module.exports = mongoose.model('DeliveryExecutive', deliveryExecutiveSchema);
