const mongoose = require("mongoose");
const User = require("../model/userSchema");
const verifySuperAdmin = async (req, res, next) => {
  try {
    if (req.session.admin && req.session.admin.role === 'superadmin') {
      return next(); // Authenticated user
    }

    // Either not logged in or guest
    return res.send("Unauthorized access.");

  } catch (error) {
    console.error("Error in verifyCustomer middleware:", error);
    return res.status(500).send("Internal Server Error");
  }
};

module.exports = verifySuperAdmin;
