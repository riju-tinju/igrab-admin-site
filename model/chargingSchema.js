const mongoose = require("mongoose");

const chargingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    name: {
      type: String,
      enum: ["percentage", "number"],
      required: true
    },
    value: {
      type: Number,
      required: true
    }
  }
});

module.exports = mongoose.model("Charging", chargingSchema);
