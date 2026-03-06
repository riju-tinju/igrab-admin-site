const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  branchIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StoreBranch'
    }
  ],
  
  description: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },

  pricing: {
    price: { type: Number, required: true },
    costPerItem: { type: Number, required: true },
    currency: { type: String, default: 'AED' }
  },

  images: {
    type: [String],
    default: []
  },

  inStock: {
    type: Number,
    required: false,
    min: 0
  },

  meta: {
    slug: { type: String, required: true, unique: true },
    keywords: { type: [String], default: [] }
  },

  sales: {
    totalUnitsSold: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    lastSoldAt: { type: Date, default: null },
    totalReviews: {
      type: Number,
      default: 0
    },
    starRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
  },

  status: {
    isPublished: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    isNew: { type: Boolean, default: false },
    isPopular: { type: Boolean, default: false } // You can also compute this from sales if needed
  },

  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },

  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    default: null
  },

  createdAt: {
    type: Date,
    default: () => Date.now()
  },

  updatedAt: {
    type: Date,
    default: () => Date.now()
  }
});

// Automatically update `updatedAt` on document update
productSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
