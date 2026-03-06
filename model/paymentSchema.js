const mongoose = require('mongoose');
const { Schema } = mongoose;

const paymentConfigurationSchema = new Schema({
  stripe: {
    publishableKey: {
      type: String,
      required: true,
      default: ""
    },
    secretKey: {
      type: String,
      required: true,
      default: ""
    },
    webhookSecret: {
      type: String,
      required: true,
      default: ""
    },
    isEnabled: {
      type: Boolean,
      required: true,
      default: false
    }
  },
  cod: {
    isEnabled: {
      type: Boolean,
      required: true,
      default: false
    }
  },
  wallet: {
    isEnabled: {
      type: Boolean,
      required: true,
      default: false
    }
  }
}, {
  timestamps: true // optional: adds createdAt and updatedAt fields
});

const PaymentConfiguration = mongoose.model('PaymentConfiguration', paymentConfigurationSchema);

module.exports = PaymentConfiguration;