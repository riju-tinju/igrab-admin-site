const express = require('express');
const router = express.Router();
const Setting = require("../model/settingSchema");
const StoreBranch = require("../model/storeBranchSchema");
const Admin = require("../model/adminSchema");
const asyncHandler = require('../helper/asyncHandler');

// GET Setup Page
router.get('/setup', asyncHandler(async (req, res) => {
    // Check if setup is already complete
    const settings = await Setting.findOne();
    if (settings && settings.isSetupComplete) {
        return res.redirect('/');
    }

    res.render('pages/setup/setup', {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
        admin: req.session.admin
    });
}));

// POST Setup Data
router.post('/api/setup', asyncHandler(async (req, res) => {
    const { shopName, logo, address, adminName, adminPhone, countryCode } = req.body;

    // 1. Update/Create Settings
    let settings = await Setting.findOne();
    if (!settings) {
        settings = new Setting({
            businessName: shopName,
            logo: logo || "",
            phone: adminPhone,
            email: "admin@igrab.com", // Fallback email
            currency: "AED",
            address: {
                street: address.street || "Main St",
                city: address.city || "Dubai",
                country: address.country || "UAE"
            }
        });
    } else {
        settings.businessName = shopName;
        settings.logo = logo || settings.logo;
        settings.isSetupComplete = true;
    }
    settings.isSetupComplete = true;
    await settings.save();

    // 2. Update/Create Primary Branch
    let branch = await StoreBranch.findOne({ name: "Main Branch" });
    if (!branch) {
        branch = new StoreBranch({
            name: "Main Branch",
            address: address.fullAddress || "Dubai, UAE",
            email: "main@igrab.com",
            contactNumber: adminPhone,
            location: {
                type: "Point",
                coordinates: [req.body.longitude || 55.2708, req.body.latitude || 25.2048]
            }
        });
    } else {
        branch.address = address.fullAddress || branch.address;
        branch.contactNumber = adminPhone;
    }
    await branch.save();

    // 3. Update Admin Profile
    if (req.session.admin && req.session.admin.id) {
        await Admin.findByIdAndUpdate(req.session.admin.id, {
            name: adminName,
            phone: adminPhone.replace(/\s/g, ''),
            countryCode: countryCode,
            selectedBranch: branch._id,
            branches: [branch._id]
        });

        // Update session
        req.session.admin.name = adminName;
        req.session.admin.selectedBranch = branch._id.toString();
    }

    req.session.isSetupComplete = true;

    res.status(200).json({
        success: true,
        message: "Setup completed successfully!"
    });
}));

module.exports = router;
