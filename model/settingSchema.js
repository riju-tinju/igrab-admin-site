const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  street: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100
  },
  city: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  country: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  zipCode: {
    type: String,
    // required: true,
    trim: true,
    minlength: 3,
    maxlength: 10
  }
}, { _id: false }); // _id: false prevents Mongoose from creating an _id for subdocuments

const settingSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100
  },
  logo: {
    type: String,
    required: false, // Logo can be optional
    trim: true,
    validate: {
      validator: function(v) {
        // Basic URL validation
        return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/.test(v);
      },
      message: props => `${props.value} is not a valid URL for the logo!`
    }
  },
  aboutUs: {
    type: String,
    required: false, // About Us can be optional
    trim: true,
    maxlength: 500 // Limit the length of aboutUs
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    // Basic regex for international phone numbers, adjust as needed
    validate: {
      validator: function(v) {
        return /^\+?[1-9]\d{1,14}$/.test(v); // E.164 format (up to 15 digits, optional +)
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true, // Assuming email should be unique for settings
    validate: {
      validator: function(v) {
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v); // Standard email regex
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  currency: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    enum: ['AED', 'USD', 'EUR', 'GBP', 'INR'], // Example currencies, extend as needed
    minlength: 3,
    maxlength: 3
  },
  address: {
    type: addressSchema,
    required: true
  }
}, { timestamps: true }); // Adds createdAt and updatedAt timestamps automatically

// Create the Mongoose model
const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting;