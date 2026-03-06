const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  profile_image: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
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
      max: 3,
      min: 0,
      default: 3
    }
  },
  language: {
    enum: ["en", "ar",],
    default: "en",
    type: String,
    required: true,
  },
  dateOfBirth: {
    type: Date,
  },
  status: {
    enum: ["active", "deactive"],
    type: String,
    required: true,
    default: "deactive",
  },
  addresses: [
    {
      street: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      zipCode: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
      isDefault: {
        type: Boolean,
        default: false,
      },
    },
  ],
  orderHistory: [
    {
      orderId: {
        type: Schema.Types.ObjectId,
        ref: "Order",
      },
    },
  ],
  wishlist: [{
    type: Schema.Types.ObjectId,
    ref: "Product",
  }],
  cart: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: "Product", // Reference to the Product model
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      addedDate: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to update `updatedAt` on document update
UserSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

UserSchema.pre("findOneAndUpdate", function (next) {
  this._update.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("User", UserSchema);
