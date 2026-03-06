var express = require('express');
var router = express.Router();
const Admin = require("../model/adminSchema");
const dashboardHelper = require("../helper/dashboardHelper");
const asyncHandler = require('../helper/asyncHandler');

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

module.exports = router;
