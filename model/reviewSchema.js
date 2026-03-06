// models/ProductReview.js

const mongoose = require('mongoose');

const productReviewSchema = new mongoose.Schema({
  user_Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // optional: reference to a User model
    required: true
  },
  product_Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product', // optional: reference to a Product model
    required: true
  },
  hidden: {
    type: Boolean,
    default: false
  },
  profileImage:{
    type: String,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  profession: {
    type: String,
    trim: true
  },
  review: {
    type: String,
    required: true,
    trim: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ProductReview = mongoose.model('Reviews', productReviewSchema);

module.exports = ProductReview;
