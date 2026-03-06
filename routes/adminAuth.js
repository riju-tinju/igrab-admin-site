var express = require('express');
var mongoose = require("mongoose");
var router = express.Router();
const adminHelper = require("../helper/adminHelper")
const asyncHandler = require('../helper/asyncHandler');

// Setup route - DISABLED for security after initial admin creation
// To re-enable, uncomment ONLY during initial setup and comment it back immediately
/*
router.get('/create-admin/:name/:countryCode/:phone/', async (req, res, next) => {
  console.log("Creating admin with params:", req.params);
  const { name, countryCode, phone } = req.params;
  // Basic validations
  if (!name || !countryCode || !phone) return res.status(400).send({ error: "Name, countryCode and phone are required" });
  await adminHelper.createSuperAdmin(req, res)
})
*/
/* GET users listing. */
router.get('/login', function (req, res, next) {
  res.render("pages/admin-Auth/auth")
});
router.post('/api/auth/signup', asyncHandler(async function (req, res, next) {
  await adminHelper.checkAndGenerateOTPUser(req, res)
}));
router.post('/api/auth/verify-otp', asyncHandler(async function (req, res, next) {
  await adminHelper.verifyOTPUser(req, res)
}));

router.get('/send-msg', asyncHandler(async function (req, res, next) {
  await adminHelper.sendOTP(req, res)
  res.render("pages/user-Auth/auth")
}));
module.exports = router;
