var express = require('express');
var router = express.Router();
const Admin = require("../model/adminSchema");
const settingHelper = require("../helper/adminSettingHelper");
const asyncHandler = require('../helper/asyncHandler');

/* GET home page. */
router.get('/setting/admin-user', function (req, res, next) {
  res.render('pages/admin-user/admin-user',);
});

router.get('/api/admin-users', asyncHandler(async function (req, res, next) {
  await settingHelper.getAdminUsers(req, res, next);
}));

router.get('/api/branches/available', asyncHandler(async function (req, res, next) {
  await settingHelper.getAvailableBranches(req, res, next);
}));

router.post('/api/admin-users', asyncHandler(async function (req, res, next) {
  await settingHelper.createAdminBySuperAdmin(req, res, next);
}));

router.put('/api/admin-users/:adminId', asyncHandler(async function (req, res, next) {
  await settingHelper.updateAdminBySuperAdmin(req, res, next);
}));

router.patch('/api/admin-users/:adminId/status', asyncHandler(async function (req, res, next) {
  await settingHelper.changeAdminStatusBySuperAdmin(req, res);
}));

router.delete('/api/admin-users/:adminId', asyncHandler(async function (req, res, next) {
  await settingHelper.deleteAdminBySuperAdmin(req, res);
}));

router.get('/api/admin-users/check-email', asyncHandler(async function (req, res, next) {
  await settingHelper.checkEmailAvailability(req, res, next);
}));

module.exports = router;
