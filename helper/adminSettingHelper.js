const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const Product = require("../model/productSchema");
const Category = require("../model/categorySchema");
const Brand = require("../model/brandSchema");
const User = require("../model/userSchema");
const Reviews = require("../model/reviewSchema");
const Inventory = require("../model/inventorySchema");
const Charges = require("../model/chargingSchema");
const Store = require("../model/storeBranchSchema");
const Order = require("../model/orderSchema");
const Admin = require("../model/adminSchema");
const DeliveryExecutive = require("../model/deliveryExecutiveSchema");

const settingFun = {
  getAdminUsers: async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const roleFilter = { role: "admin" };

      // Query admins with role === 'admin'
      const [admins, totalAdmins, activeAdmins, inactiveAdmins] = await Promise.all([
        Admin.find(roleFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("branches", "name address")
          .lean(),
        Admin.countDocuments(roleFilter),
        Admin.countDocuments({ ...roleFilter, isActive: true }),
        Admin.countDocuments({ ...roleFilter, isActive: false }),
      ]);

      const formattedAdmins = admins.map(admin => ({
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone || "NA",
        role: admin.role,
        isActive: admin.isActive,
        assignedBranches: (admin.branches || []).map(branch => ({
          _id: branch._id,
          name: branch.name,
          address: branch.address,
        })),
        lastLogin: admin.lastLogin || null,
        createdAt: admin.createdAt,
      }));

      const totalPages = Math.ceil(totalAdmins / limit);

      return res.status(200).json({
        success: true,
        data: {
          admins: formattedAdmins,
          pagination: {
            currentPage: page,
            totalPages,
            totalAdmins,
            limit,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          stats: {
            totalAdmins,
            activeAdmins,
            inactiveAdmins,
          },
        },
      });
    } catch (err) {
      console.error("Error in getAdminUsers:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR",
      });
    }
  },
  getAvailableBranches: async (req, res, next) => {
    try {
      const branches = await Store.find({ isActive: true }).select(
        "_id name address contactNumber isActive"
      );

      return res.status(200).json({
        success: true,
        data: {
          branches,
        },
      });
    } catch (err) {
      console.error("Error in getAvailableBranches:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR",
      });
    }
  },
  createAdminBySuperAdmin: async (req, res) => {
    try {
      const { name, email, countryCode, phone, assignedBranches = [], isActive = true } = req.body;

      // Check if email already exists
      const existingAdmin = await Admin.findOne({ email });
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
          code: "EMAIL_EXISTS",
        });
      }

      // Create new admin
      const newAdmin = new Admin({
        name,
        email,
        phone: phone.replace(/\s/g, ''),
        countryCode,
        role: "admin",
        branches: assignedBranches,
        isActive,
      });

      await newAdmin.save();

      // Populate assignedBranches for response
      const populatedBranches = await Store.find({ _id: { $in: assignedBranches } }).select("name");

      return res.status(201).json({
        success: true,
        data: {
          admin: {
            _id: newAdmin._id,
            name: newAdmin.name,
            email: newAdmin.email,
            phone: newAdmin.phone,
            role: newAdmin.role,
            isActive: newAdmin.isActive,
            assignedBranches: populatedBranches.map(branch => ({
              _id: branch._id,
              name: branch.name,
            })),
            createdAt: newAdmin.createdAt,
          },
        },
        message: "Admin user created successfully",
      });

    } catch (err) {
      console.error("Error in createAdminBySuperAdmin:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR",
      });
    }
  },
  updateAdminBySuperAdmin: async (req, res) => {
    try {
      const { adminId } = req.params;
      const { name, countryCode, phone, assignedBranches = [], isActive } = req.body;

      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
          code: "ADMIN_NOT_FOUND",
        });
      }

      // Update fields
      admin.name = name ?? admin.name;
      admin.phone = phone ? phone.replace(/\s/g, '') : admin.phone;
      admin.countryCode = countryCode ?? admin.countryCode;
      admin.branches = assignedBranches ?? admin.branches;
      if (typeof isActive === "boolean") {
        admin.isActive = isActive;
      }
      admin.updatedAt = new Date();

      await admin.save();

      // Populate updated branches
      const populatedBranches = await Store.find({ _id: { $in: admin.branches } }).select("name");

      return res.status(200).json({
        success: true,
        data: {
          admin: {
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            phone: admin.phone,
            role: admin.role,
            isActive: admin.isActive,
            assignedBranches: populatedBranches.map(branch => ({
              _id: branch._id,
              name: branch.name,
            })),
            updatedAt: admin.updatedAt,
            createdAt: admin.createdAt,
          }
        },
        message: "Admin user updated successfully"
      });

    } catch (err) {
      console.error("Error in updateAdminBySuperAdmin:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR",
      });
    }
  },
  changeAdminStatusBySuperAdmin: async (req, res) => {
    try {
      const { adminId } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Invalid status value. 'isActive' must be true or false.",
          code: "INVALID_INPUT"
        });
      }

      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
          code: "ADMIN_NOT_FOUND"
        });
      }

      admin.isActive = isActive;
      admin.updatedAt = new Date();
      await admin.save();

      return res.status(200).json({
        success: true,
        data: {
          admin: {
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            phone: admin.phone,
            role: admin.role,
            isActive: admin.isActive,
            updatedAt: admin.updatedAt
          }
        },
        message: "Admin status updated successfully"
      });

    } catch (err) {
      console.error("Error in changeAdminStatusBySuperAdmin:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR"
      });
    }
  },
  deleteAdminBySuperAdmin: async (req, res) => {
    try {
      const { adminId } = req.params;

      if (!adminId || !mongoose.Types.ObjectId.isValid(adminId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid admin ID",
          code: "INVALID_ID"
        });
      }

      const deletedAdmin = await Admin.findByIdAndDelete(adminId);

      if (!deletedAdmin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
          code: "ADMIN_NOT_FOUND"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Admin user deleted successfully"
      });

    } catch (err) {
      console.error("Error in deleteAdminBySuperAdmin:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR"
      });
    }
  },
  checkEmailAvailability: async (req, res) => {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
          code: "EMAIL_REQUIRED"
        });
      }

      const existingAdmin = await Admin.findOne({ email: email.toLowerCase().trim() });

      if (existingAdmin) {
        return res.status(200).json({
          success: true,
          data: {
            isAvailable: false,
            message: "Email already exists"
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          isAvailable: true,
          message: "Email is available"
        }
      });

    } catch (err) {
      console.error("Error in checkEmailAvailability:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR"
      });
    }
  },
  getDeliveryExecutives: async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Fetch delivery executives (using correct model)
      const deliveryExecutives = await DeliveryExecutive.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("branches", "name address")
        .lean();

      // Count total/active/inactive executives (using DeliveryExecutive model)
      const totalDeliveryExecutives = await DeliveryExecutive.countDocuments();
      const activeExecutives = await DeliveryExecutive.countDocuments({ isActive: true });
      const inactiveExecutives = totalDeliveryExecutives - activeExecutives;

      // Format response
      const formattedExecutives = deliveryExecutives.map(exec => ({
        _id: exec._id,
        name: exec.name,
        email: exec.email,
        phone: exec.phone || "NA",
        isActive: exec.isActive,
        assignedBranches: (exec.branches || []).map(branch => ({
          _id: branch._id,
          name: branch.name,
          address: branch.address,
        })),
        lastLogin: exec.lastLogin || null,
        createdAt: exec.createdAt,
      }));

      const totalPages = Math.ceil(totalDeliveryExecutives / limit);

      return res.status(200).json({
        success: true,
        data: {
          deliveryExecutives: formattedExecutives,
          pagination: {
            currentPage: page,
            totalPages,
            totalExecutives: totalDeliveryExecutives, // Renamed to match your desired output
            limit,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          stats: { // Added stats section
            totalExecutives: totalDeliveryExecutives,
            activeExecutives,
            inactiveExecutives,
          },
        },
      });
    } catch (err) {
      console.error("Error in getDeliveryExecutives:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR",
      });
    }
  },
  createDeliveryExecutive: async (req, res, next) => {
    try {
      const { name, email, phone, assignedBranches = [], isActive = true } = req.body;

      // Input validation
      if (!name || !email) {
        return res.status(400).json({
          success: false,
          message: "Name and email are required fields",
          code: "VALIDATION_ERROR"
        });
      }

      // Check if email already exists
      const existingExecutive = await DeliveryExecutive.findOne({ email });
      if (existingExecutive) {
        return res.status(409).json({
          success: false,
          message: "Email already registered",
          code: "DUPLICATE_EMAIL"
        });
      }

      // Create new delivery executive
      const newExecutive = new DeliveryExecutive({
        name,
        email,
        phone,
        branches: assignedBranches,
        isActive
      });

      await newExecutive.save();

      // console.log("New delivery executive created:\n", newExecutive);

      // Populate branches in response
      const populatedExecutive = await DeliveryExecutive.findById(newExecutive._id)
        .populate("branches", "name address")
        .lean();

      // Format response
      const responseData = {
        _id: populatedExecutive._id,
        name: populatedExecutive.name,
        email: populatedExecutive.email,
        phone: populatedExecutive.phone || "NA",
        isActive: populatedExecutive.isActive,
        assignedBranches: (populatedExecutive.branches || []).map(branch => ({
          _id: branch._id,
          name: branch.name,
          address: branch.address
        })),
        createdAt: populatedExecutive.createdAt
      };

      return res.status(201).json({
        success: true,
        message: "Delivery executive created successfully",
        data: {
          deliveryExecutive: responseData
        }
      });

    } catch (err) {
      console.error("Error in createDeliveryExecutive:", err);

      // Handle Mongoose validation errors
      if (err.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: Object.values(err.errors).map(e => e.message).join(', '),
          code: "VALIDATION_ERROR"
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR"
      });
    }
  },
  updateDeliveryExecutive: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, email, phone, assignedBranches, isActive } = req.body;

      // Validate ObjectID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid executive ID format",
          code: "INVALID_ID"
        });
      }

      // Find existing executive
      const existingExecutive = await DeliveryExecutive.findById(id);
      if (!existingExecutive) {
        return res.status(404).json({
          success: false,
          message: "Delivery executive not found",
          code: "NOT_FOUND"
        });
      }

      // Email uniqueness check (if email is being updated)
      if (email && email !== existingExecutive.email) {
        const emailExists = await DeliveryExecutive.findOne({ email });
        if (emailExists) {
          return res.status(409).json({
            success: false,
            message: "Email already registered to another executive",
            code: "DUPLICATE_EMAIL"
          });
        }
      }

      // Prepare update object
      const updateData = {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(assignedBranches !== undefined && { branches: assignedBranches }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date()
      };

      // Perform update
      const updatedExecutive = await DeliveryExecutive.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).populate("branches", "name address");

      // Format response
      const responseData = {
        _id: updatedExecutive._id,
        name: updatedExecutive.name,
        email: updatedExecutive.email,
        phone: updatedExecutive.phone || "NA",
        isActive: updatedExecutive.isActive,
        assignedBranches: (updatedExecutive.branches || []).map(branch => ({
          _id: branch._id,
          name: branch.name,
          address: branch.address
        })),
        createdAt: updatedExecutive.createdAt,
        updatedAt: updatedExecutive.updatedAt
      };

      return res.status(200).json({
        success: true,
        message: "Delivery executive updated successfully",
        data: {
          deliveryExecutive: responseData
        }
      });

    } catch (err) {
      console.error("Error in updateDeliveryExecutive:", err);

      if (err.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: Object.values(err.errors).map(e => e.message).join(', '),
          code: "VALIDATION_ERROR"
        });
      }

      if (err.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: "Invalid ID format",
          code: "INVALID_ID"
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR"
      });
    }
  },
  updateDeliveryExecutiveStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      // Validate ObjectID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid executive ID format",
          code: "INVALID_ID"
        });
      }

      // Validate request body
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: "isActive must be a boolean value",
          code: "VALIDATION_ERROR"
        });
      }

      // Find and update
      const updatedExecutive = await DeliveryExecutive.findByIdAndUpdate(
        id,
        {
          isActive,
          updatedAt: new Date()
        },
        {
          new: true,
          runValidators: true
        }
      ).populate("branches", "name address");

      if (!updatedExecutive) {
        return res.status(404).json({
          success: false,
          message: "Delivery executive not found",
          code: "NOT_FOUND"
        });
      }

      // Format response
      const responseData = {
        _id: updatedExecutive._id,
        name: updatedExecutive.name,
        email: updatedExecutive.email,
        phone: updatedExecutive.phone || "NA",
        isActive: updatedExecutive.isActive,
        assignedBranches: (updatedExecutive.branches || []).map(branch => ({
          _id: branch._id,
          name: branch.name,
          address: branch.address
        })),
        updatedAt: updatedExecutive.updatedAt
      };

      return res.status(200).json({
        success: true,
        message: `Delivery executive ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: {
          deliveryExecutive: responseData
        }
      });

    } catch (err) {
      console.error("Error in updateDeliveryExecutiveStatus:", err);

      if (err.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: "Invalid ID format",
          code: "INVALID_ID"
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR"
      });
    }
  },
  deleteDeliveryExecutive: async (req, res, next) => {
    try {
      const { id } = req.params;

      // Validate ObjectID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid executive ID format",
          code: "INVALID_ID"
        });
      }

      // Check if executive exists
      const executive = await DeliveryExecutive.findById(id);
      if (!executive) {
        return res.status(404).json({
          success: false,
          message: "Delivery executive not found",
          code: "NOT_FOUND"
        });
      }


      await DeliveryExecutive.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: "Delivery executive deleted successfully"
      });

    } catch (err) {
      console.error("Error in deleteDeliveryExecutive:", err);

      if (err.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: "Invalid ID format",
          code: "INVALID_ID"
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR"
      });
    }
  },
}

module.exports = settingFun