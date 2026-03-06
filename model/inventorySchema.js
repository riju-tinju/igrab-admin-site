const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },

  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StoreBranch",
    required: true
  },

  stock: {
    type: Number,
    required: true,
    min: 0
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate (productId + branchId)
inventorySchema.index({ productId: 1, branchId: 1 }, { unique: true });

module.exports = mongoose.model("Inventory", inventorySchema);
