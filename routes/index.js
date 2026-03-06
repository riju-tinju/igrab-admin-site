var express = require('express');
var router = express.Router();
const Admin = require("../model/adminSchema");
const asyncHandler = require('../helper/asyncHandler');

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/change-branch/:branchId', asyncHandler(async function (req, res, next) {

  const { branchId } = req.params;
  if (!branchId)
    return res.status(400).json({ success: false, message: "Branch ID is required" });
  let admin = await Admin.findById(req.session.admin.id)
  if (!admin) {
    return res.status(401).send("Unauthorized attempt");
  }
  admin.selectedBranch = branchId;
  await admin.save();
  return res.status(200).json({
    success: true,
    message: "Branch changed successfully",
    data: {
      selectedBranch: admin.selectedBranch
    }
  });

}));

module.exports = router;
