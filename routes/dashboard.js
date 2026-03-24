var express = require('express');
var router = express.Router();
const Admin = require("../model/adminSchema");
const dashboardHelper = require("../helper/dashboardHelper");
const asyncHandler = require('../helper/asyncHandler');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer configuration for notifications
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dest = path.join(__dirname, '../../storage/public/notification');
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        cb(null, dest);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'notification-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

/* GET home page. */
router.get('/api/admin/dashboard/overview', asyncHandler(async function (req, res, next) {
    await dashboardHelper.getDashboardOverview(req, res,);
}));

router.get('/api/admin/dashboard/revenue', asyncHandler(async function (req, res, next) {
    await dashboardHelper.fetchRevenue(req, res);
}));

router.get('/api/admin/dashboard/orders/analytics', asyncHandler(async function (req, res, next) {
    await dashboardHelper.getOrderAnalytics(req, res);
}));

router.get('/api/admin/dashboard/products/top', asyncHandler(async function (req, res, next) {
    await dashboardHelper.getTopProducts(req, res);
}));

router.get('/api/admin/dashboard/branches/performance', asyncHandler(async function (req, res, next) {
    await dashboardHelper.getBranchPerformance(req, res);
}));

router.post('/api/logout', asyncHandler(async function (req, res, next) {
    // Clear session or token
    await req.session.destroy();
    return res.status(200).json({ success: true, message: "Logged out successfully" });
}));

const notificationService = require('../helper/notificationService');

router.post('/api/admin/notifications/broadcast', upload.single('image'), asyncHandler(async function (req, res, next) {
    try {
        const { title, body } = req.body;
        if (!title || !body) {
            return res.status(400).json({ success: false, message: 'Title and body are required' });
        }

        let imageUrl = null;
        if (req.file) {
            // Using absolute URL for universal access (native + web)
            // Replace with your actual domain for production
            const protocol = req.protocol;
            const host = req.get('host');
            imageUrl = `${protocol}://${host}/uploads/notification/${req.file.filename}`;
        }

        const result = await notificationService.sendBroadcastNotification(title, body, imageUrl);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Broadcast error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}));

module.exports = router;
