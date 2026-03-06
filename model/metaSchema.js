const mongoose = require('mongoose');
const { Schema } = mongoose;

const siteContentSchema = new Schema({
  homeTitle: {
    en: {
      type: String,
      trim: true
    },
    ar: {
      type: String,
      trim: true
    }
  },
  metaDescription: {
    en: {
      type: String,
      trim: true,
      
    },
    ar: {
      type: String,
      trim: true,
      
    }
  },
  metaKeywords: {
    en: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    ar: [{
      type: String,
      trim: true
    }]
  },
  favicon: {
    type: String,
    default: null
  },
  ogImage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

const SiteContent = mongoose.model('SiteContent', siteContentSchema);

module.exports = SiteContent;