const mongoose = require("mongoose");

const storeBranchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email:{
    type:String,
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

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Enable geo queries (e.g. find nearest branch)
storeBranchSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("StoreBranch", storeBranchSchema);
