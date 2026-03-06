const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  image:{type:String, required:false},
  name: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Category', categorySchema);
