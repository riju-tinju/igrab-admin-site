const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    phone: {
        type: String,
        trim: true,
        default: null
    },
    storeBranch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StoreBranch',
        required: false,
        default: null
    },
    inquiryType: {
        type: String,
        required: [true, 'Inquiry type is required'],
        enum: ['general', 'order', 'return', 'business'],
        default: 'general'
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    status: {
        type: String,
        enum: ['new', 'read', 'archived'],
        default: 'new'
    },
    ipAddress: {
        type: String,
        default: null
    },
    submittedAt: {
        type: Date,
        default: Date.now
    },
    readAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Index for efficient querying
contactSchema.index({ status: 1, submittedAt: -1 });
contactSchema.index({ email: 1 });

module.exports = mongoose.model('Contact', contactSchema);
