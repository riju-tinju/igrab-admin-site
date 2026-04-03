const mongoose = require("mongoose");

const storeBranchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
  },
  address: {
    type: String,
    required: true
  },

  location: {
    type: {
      type: String,
      enum: ["Point"],

    },
    coordinates: {
      type: [Number], // Format: [longitude, latitude]

    }
  },

  contactNumber: {
    type: String,
    required: false
  },

  isActive: {
    type: Boolean,
    default: true
  },
  isPickupOnlineEnabled: {
    type: Boolean,
    default: true
  },
  isPickupOfflineEnabled: {
    type: Boolean,
    default: true
  },

  // Per-Branch Settings
  paymentConfig: {
    stripe: {
      publishableKey: { type: String, default: "" },
      secretKey: { type: String, default: "" },
      webhookSecret: { type: String, default: "" },
      isEnabled: { type: Boolean, default: false }
    },
    cod: { isEnabled: { type: Boolean, default: false } },
    wallet: { isEnabled: { type: Boolean, default: false } }
  },

  deliveryCharges: [{
    emirate: {
      type: String,
      enum: ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah']
    },
    chargeType: { type: String, enum: ['fixed', 'distance'] },
    fixedCharge: { type: Number, default: 0 },
    distanceCharge: {
      baseDistance: { type: Number, default: 10 },
      baseCost: { type: Number, default: 0 },
      extraCostPerKm: { type: Number, default: 0 }
    },
    isActive: { type: Boolean, default: true }
  }],

  extraCharges: [{
    name: String,
    chargeConfig: {
      chargeMethod: { type: String, enum: ["percentage", "number"] },
      value: Number
    },
    isActive: { type: Boolean, default: true }
  }],

  // Dynamic Contact Info
  openingHours: { type: String, default: "" },
  instagramLink: { type: String, default: "" },
  googleMapSrc: { type: String, default: "" },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Enable geo queries (e.g. find nearest branch)
storeBranchSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("StoreBranch", storeBranchSchema);
