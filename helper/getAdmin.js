const mongoose = require("mongoose");
const Admin = require("../model/adminSchema");
const Store = require("../model/storeBranchSchema");

const getAdmin = async (req, res, next) => {
  try {
   
    if (!req.session.admin || !req.session.admin.id) {
      return res.status(401).send("Unauthorized attempt");
    }

    const admin = await Admin.findById(req.session.admin.id);
    if (!admin) {
      return res.status(401).send("Unauthorized attempt");
    }

    let adminData = {
      id: admin._id,
      role: admin.role,
      allBranches: [],
      selectedBranch: admin.selectedBranch || null,
      branchName: "NA",
      
    };

    // Get all branches based on role
    if (admin.role === "superadmin") {
      adminData.allBranches = await Store.find({});
    } else {
      adminData.allBranches = await Store.find({
        _id: { $in: admin.branches || [] },
      });
    }

    // Set selectedBranch if not set yet
    if (!adminData.selectedBranch) {
      const firstStore = adminData.allBranches?.[0] || await Store.findOne({});
      if (firstStore) {
        adminData.selectedBranch = firstStore._id;
        admin.selectedBranch = firstStore._id;
        await admin.save();
        adminData.branchName = firstStore.name;
      } else {
        adminData.branchName = "No Branch Available";
      }
    } else {
      // Set branch name from selectedBranch
      const matchedBranch = adminData.allBranches.find(
        b => b._id.toString() === adminData.selectedBranch.toString()
      );
      if (matchedBranch) {
        adminData.branchName = matchedBranch.name;
      }
    }

    // Save into session + res.locals
    res.locals.admin = adminData;
    req.session.admin = {
      id: adminData.id,
      role: adminData.role,
      selectedBranch: adminData.selectedBranch,
    };

    // console.log("Admin data:", adminData);
    next();

  } catch (err) {
    console.error("Error in getAdmin middleware:", err);
    return res.status(500).send("Server error");
  }
};

module.exports = getAdmin;



// const mongoose = require("mongoose");
// const User = require("../model/userSchema");
// const Admin = require("../model/adminSchema");
// const Store = require("../model/storeBranchSchema");

// const getAdmin = async (req, res, next) => {
//   let adminData = {
//     id: req.session.admin.id || null,
//     allBranches: [],
//     selectedBranch: null,
//   };
//   let admin = await Admin.findById(req.session.admin.id)
//   if (!admin) {
//     return res.status(401).send("Unauthorized attept");
//   }
//   if (admin.role === "superadmin") {
//     adminData.role = "superadmin";
//     adminData.allBranches = await Store.find({});


//   } else {
//     adminData.allBranches = await Store.find({ _id: { $in: admin.branches } }) || [];
//   }
//   adminData.selectedBranch = admin.selectedBranch; // Assign the ID directly

//   // Convert admin.selectedBranch to a string for comparison, but only if it exists.
//   const selectedBranchIdString = admin.selectedBranch ? admin.selectedBranch.toString() : null;

//   adminData.branchName = "NA"; // Default to "NA" first

//   if (selectedBranchIdString && Array.isArray(adminData.allBranches)) {
//     const foundBranch = adminData.allBranches.find(branch =>
//       branch._id && branch._id.toString() === selectedBranchIdString
//     );
//     if (foundBranch) {
//       adminData.branchName = foundBranch.name;
//     }
//   }
//   if (!adminData.selectedBranch) {
//     const firstStore = await Store.findOne({}); // Finds the first document it encounters

//     adminData.selectedBranch = firstStore._id;
//     adminData.branchName = firstStore.name;
//     admin.selectedBranch = firstStore._id;
//     await admin.save();

//   }
 
//   res.locals.admin = adminData;
//   req.session.admin = adminData;
//   console.log("Admin data:", adminData);
//   next();

// };

// module.exports = getAdmin;
