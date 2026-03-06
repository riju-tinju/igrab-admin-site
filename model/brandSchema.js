const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  logo:{type:String, required:false},
  name: {
    en: { type: String, required: true },
    ar: { type: String, required: true }
  },
  tagline: { 
     en: { type: String},
     ar: { type: String, }
   },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Brand', brandSchema);
