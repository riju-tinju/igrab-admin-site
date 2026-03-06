const mongoose = require("mongoose");
const User = require("../model/userSchema");
const Admin = require("../model/adminSchema");

const verifyAdmin = async (req, res, next) => {
  try {
    // For testing purposes, automatically log in if enabled in .env
    if (process.env.ADMIN_AUTO_LOGIN === 'true' && !req.session.admin) {
      const findAdmin = await Admin.findOne({ role: 'superadmin' }) || await Admin.findOne({});
      if (findAdmin) {
        req.session.admin = {
          id: findAdmin._id,
          role: findAdmin.role,
          name: findAdmin.name,
          selectedBranch: findAdmin.branch ? findAdmin.branch.toString() : null
        };
        console.log(`[TEST] Auto-logged in as ${findAdmin.role}: ${findAdmin.email || findAdmin.phone} (Branch: ${req.session.admin.selectedBranch})`);
      }
    }

    if (req.session.admin && req.session.admin.id) {
      return next(); // Authenticated user
    }

    // Either not logged in or guest
    return res.redirect("/login");

  } catch (error) {
    console.error("Error in verifyAdmin middleware:", error);
    return res.status(500).send("Internal Server Error");
  }
};

module.exports = verifyAdmin;
