const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
    token: { 
        type: String, 
        required: true, 
        unique: true 
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null 
    },
    platform: { 
        type: String, 
        enum: ['ios', 'android', 'web', 'unknown'],
        default: 'unknown'
    },
    lastUsed: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });

// Index for performance is already handled by unique: true
// deviceTokenSchema.index({ token: 1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
