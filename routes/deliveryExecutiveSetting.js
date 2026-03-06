var express = require('express');
var router = express.Router();
const Admin = require("../model/adminSchema");
const settingHelper = require("../helper/adminSettingHelper");
const asyncHandler = require('../helper/asyncHandler');

/* GET home page. */
router.get('/delivery-executive', function (req, res, next) {
  res.render('pages/delivery-Executive/deliveryExecutive',);
});

router.get('/api/delivery-executives', asyncHandler(async function (req, res, next) {
  await settingHelper.getDeliveryExecutives(req, res, next);
}));

router.get('/api/branches/available', asyncHandler(async function (req, res, next) {
  await settingHelper.getAvailableBranches(req, res, next);
}));

router.post('/api/delivery-executives', asyncHandler(async function (req, res, next) {
  await settingHelper.createDeliveryExecutive(req, res, next);
}));

router.put('/api/delivery-executives/:id', asyncHandler(async function (req, res, next) {
  await settingHelper.updateDeliveryExecutive(req, res, next);
}));

router.patch('/api/delivery-executives/:id/status', asyncHandler(async function (req, res, next) {
  await settingHelper.updateDeliveryExecutiveStatus(req, res);
}));

router.delete('/api/delivery-executives/:id', asyncHandler(async function (req, res, next) {
  await settingHelper.deleteDeliveryExecutive(req, res);
}));

// router.get('/api/admin-users/check-email',async function(req, res, next) {
//   await settingHelper.checkEmailAvailability(req, res, next);
// });



module.exports = router;
