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
const Setting = require("../model/settingSchema");
const PaymentConfiguration = require("../model/paymentSchema")
const Seo = require("../model/metaSchema")
const DeliveryCharge = require("../model/deliveryChargeSchema");

const settingHelper = {
    getBusinessInfo: async (req, res) => {
        try {
            const setting = await Setting.findOne();

            if (!setting) {
                return res.status(200).json({
                    success: true,
                    data: null,
                    message: "No business settings found, please configure them.",
                });
            }

            const {
                businessName,
                logo,
                aboutUs,
                phone,
                email,
                currency,
                address,
            } = setting;

            return res.status(200).json({
                success: true,
                data: {
                    businessName,
                    logo,
                    aboutUs,
                    phone,
                    email,
                    currency,
                    address,
                },
            });
        } catch (err) {
            console.error("Error in getBusinessInfo:", err);
            return res.status(500).json({
                success: false,
                message: "An error occurred while retrieving business info",
            });
        }
    },
    putBusinessInfo: async (req, res) => {
        try {
            const {
                businessName,
                aboutUs,
                phone,
                email,
                address,
            } = req.body;

            // Validate essential fields
            if (!businessName || !phone || !email || !address) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required business information fields",
                });
            }

            if (!address.street || !address.city || !address.country) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required address fields (street, city, or country)",
                });
            }

            // Find the first (and only) settings document
            let setting = await Setting.findOne();

            if (!setting) {
                // If no settings document exists, create one
                setting = new Setting({
                    businessName,
                    aboutUs,
                    phone,
                    email,
                    address,
                    currency: "AED", // Default value; change if needed
                });
            } else {
                // Update the existing document
                setting.businessName = businessName;
                setting.aboutUs = aboutUs;
                setting.phone = phone;
                setting.email = email;
                setting.address = address;
            }

            // Save the updated or newly created settings
            const saved = await setting.save();

            res.status(200).json({
                success: true,
                data: {
                    setting: saved,
                },
                message: "Business info updated successfully",
            });
        } catch (err) {
            console.error("Error in putBusinessInfo:", err);
            res.status(500).json({
                success: false,
                message: "Internal server error",
                code: "SERVER_ERROR",
            });
        }
    },
    getBranches: async (req, res) => {
        try {
            const adminId = req.session.admin.id;
            const admin = await Admin.findById(adminId);
            if (!admin) return res.status(401).json({ success: false, message: "Unauthorized" });

            let branches;
            if (admin.role === "superadmin") {
                branches = await Store.find({});
            } else {
                branches = await Store.find({
                    _id: { $in: admin.branches || [] },
                });
            }

            const formattedBranches = branches.map(branch => ({
                _id: branch._id,
                name: branch.name,
                address: branch.address,
                phone: branch.contactNumber || "",
                email: branch.email || "",
                openingHours: branch.openingHours || "",
                instagramLink: branch.instagramLink || "",
                googleMapSrc: branch.googleMapSrc || "",
                isActive: branch.isActive,
                location: branch.location,
                createdAt: branch.createdAt
            }));

            return res.status(200).json({
                success: true,
                data: {
                    branches: formattedBranches,
                    total: formattedBranches.length
                }
            });
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "An error occurred while fetching branches."
            });
        }
    },
    createBranch: async (req, res) => {
        try {
            const { name, email, address, contactNumber, latitude, longitude, openingHours, instagramLink, googleMapSrc } = req.body;

            // Basic validation
            if (!name || !address) {
                return res.status(400).json({
                    success: false,
                    message: "Name and address are required fields."
                });
            }

            const newBranch = new Store({
                name,
                email: email || "",
                address,
                contactNumber: contactNumber || "",
                location: (latitude && longitude) ? {
                    type: "Point",
                    coordinates: [parseFloat(longitude), parseFloat(latitude)]
                } : undefined,
                openingHours: openingHours || "",
                instagramLink: instagramLink || "",
                googleMapSrc: googleMapSrc || "",
                isActive: true
            });

            const savedBranch = await newBranch.save();

            return res.status(201).json({
                success: true,
                message: 'store creted succesfully..',
                data: {
                    _id: savedBranch._id,
                    name: savedBranch.name,
                    address: savedBranch.address,
                    phone: savedBranch.contactNumber || "",
                    email: savedBranch.email || "",
                    openingHours: savedBranch.openingHours || "",
                    instagramLink: savedBranch.instagramLink || "",
                    googleMapSrc: savedBranch.googleMapSrc || "",
                    isActive: savedBranch.isActive,
                    location: savedBranch.location,
                    createdAt: savedBranch.createdAt
                }
            });

        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "An error occurred while creating the branch."
            });
        }
    },
    editBranch: async (req, res) => {
        try {
            const branchId = req.params.id;
            const { name, email, address, contactNumber, isActive, latitude, longitude, openingHours, instagramLink, googleMapSrc } = req.body;

            const updatedData = {};

            if (name !== undefined) updatedData.name = name;
            if (email !== undefined) updatedData.email = email;
            if (address !== undefined) updatedData.address = address;
            if (contactNumber !== undefined) updatedData.contactNumber = contactNumber;
            if (openingHours !== undefined) updatedData.openingHours = openingHours;
            if (instagramLink !== undefined) updatedData.instagramLink = instagramLink;
            if (googleMapSrc !== undefined) updatedData.googleMapSrc = googleMapSrc;
            if (isActive !== undefined) updatedData.isActive = isActive;

            if (latitude !== undefined && longitude !== undefined) {
                updatedData.location = {
                    type: "Point",
                    coordinates: [parseFloat(longitude), parseFloat(latitude)]
                };
            }

            const updatedBranch = await Store.findByIdAndUpdate(
                branchId,
                { $set: updatedData },
                { new: true }
            );

            if (!updatedBranch) {
                return res.status(404).json({
                    success: false,
                    message: "Branch not found"
                });
            }

            return res.status(200).json({
                success: true,
                message: 'branch updated succesfully..',
                data: {
                    _id: updatedBranch._id,
                    name: updatedBranch.name,
                    address: updatedBranch.address,
                    phone: updatedBranch.contactNumber || "",
                    email: updatedBranch.email || "",
                    isActive: updatedBranch.isActive,
                    location: updatedBranch.location,
                    createdAt: updatedBranch.createdAt
                }
            });

        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "An error occurred while updating the branch."
            });
        }
    },
    deleteBranch: async (req, res) => {
        try {
            const branchId = req.params.id;

            const deletedBranch = await Store.findByIdAndDelete(branchId);

            if (!deletedBranch) {
                return res.status(404).json({
                    success: false,
                    message: "Branch not found"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Branch deleted successfully",
                data: {
                    _id: deletedBranch._id,
                    name: deletedBranch.name,
                    address: deletedBranch.address
                }
            });

        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "An error occurred while deleting the branch."
            });
        }
    },
    getPayment: async (req, res) => {
        try {
            const { branchId } = req.query;
            if (!branchId) {
                return res.status(400).json({ success: false, message: "Branch ID is required" });
            }

            const branch = await Store.findById(branchId);
            if (!branch) {
                return res.status(404).json({ success: false, message: "Branch not found" });
            }

            return res.status(200).json({
                success: true,
                data: {
                    ...(branch.paymentConfig ? branch.paymentConfig.toObject() : {
                        stripe: { publishableKey: '', secretKey: '', webhookSecret: '', isEnabled: false },
                        wallet: { isEnabled: false },
                        cod: { isEnabled: false }
                    }),
                    isPickupOnlineEnabled: branch.isPickupOnlineEnabled ?? true,
                    isPickupOfflineEnabled: branch.isPickupOfflineEnabled ?? true
                }
            });
        } catch (err) {
            console.error('--- getPayment Error ---');
            console.error(err);
            return res.status(500).json({
                success: false,
                message: "An error occurred while fetching payment configuration"
            });
        }
    },
    editPayment: async (req, res) => {
        try {
            console.log('--- editPayment Diagnostic START ---');
            console.log('Database:', mongoose.connection.db?.databaseName);
            console.log('Request Body:', JSON.stringify(req.body, null, 2));

            const { branchId, stripe, cod, wallet } = req.body;

            if (!branchId) {
                return res.status(400).json({ success: false, message: "Branch ID is required" });
            }

            // Stripe key validation if enabling Stripe
            if (stripe?.isEnabled) {
                if (!stripe.publishableKey?.trim() || !stripe.secretKey?.trim()) {
                    return res.status(400).json({
                        success: false,
                        message: "Stripe keys are required when Stripe is enabled."
                    });
                }
            }

            const branch = await Store.findById(branchId);
            if (!branch) {
                return res.status(404).json({ success: false, message: "Branch not found" });
            }

            const updateData = {
                $set: {
                    paymentConfig: {
                        stripe: {
                            publishableKey: stripe.publishableKey || "",
                            secretKey: stripe.secretKey || "",
                            webhookSecret: stripe.webhookSecret || "",
                            isEnabled: stripe.isEnabled
                        },
                        cod: { isEnabled: cod?.isEnabled ?? false },
                        wallet: { isEnabled: wallet?.isEnabled ?? branch.paymentConfig?.wallet?.isEnabled ?? false }
                    }
                }
            };

            if (req.body.isPickupOnlineEnabled !== undefined) {
                updateData.$set.isPickupOnlineEnabled = req.body.isPickupOnlineEnabled === true || req.body.isPickupOnlineEnabled === 'true';
            }
            if (req.body.isPickupOfflineEnabled !== undefined) {
                updateData.$set.isPickupOfflineEnabled = req.body.isPickupOfflineEnabled === true || req.body.isPickupOfflineEnabled === 'true';
            }

            console.log('--- updateData for findByIdAndUpdate ---');
            console.log(JSON.stringify(updateData, null, 2));

            const updatedBranch = await Store.findByIdAndUpdate(
                branchId,
                updateData,
                { new: true, runValidators: true, strict: false } // strict: false is key for dynamic fields
            );

            console.log('--- Database Update Result ---');
            if (updatedBranch) {
                console.log('Update Result - isPickupOnlineEnabled:', updatedBranch.isPickupOnlineEnabled);
                console.log('Update Result - isPickupOfflineEnabled:', updatedBranch.isPickupOfflineEnabled);
                console.log('Update Result - paymentConfig.cod.isEnabled:', updatedBranch.paymentConfig?.cod?.isEnabled);
            } else {
                console.log('Update Result: FAILED (Branch not found)');
            }

            // More explicit response construction
            const responseData = {
                stripe: updatedBranch.paymentConfig.stripe,
                cod: updatedBranch.paymentConfig.cod,
                wallet: updatedBranch.paymentConfig.wallet,
                isPickupOnlineEnabled: updatedBranch.isPickupOnlineEnabled,
                isPickupOfflineEnabled: updatedBranch.isPickupOfflineEnabled
            };

            return res.status(200).json({
                success: true,
                message: "Payment configuration updated successfully",
                data: responseData
            });

        } catch (err) {
            console.error('--- editPayment Error ---');
            console.error(err);
            return res.status(500).json({
                success: false,
                message: "An error occurred while updating payment configuration: " + err.message
            });
        }
    },
    getSeo: async (req, res) => {
        try {
            let seoData = await Seo.findOne({})
            if (!seoData) {
                seoData = {
                    homeTitle: {
                        en: "",
                        ar: ""
                    },
                    metaDescription: {
                        en: "",
                        ar: ""
                    },
                    metaKeywords: {
                        en: "",
                        ar: ""
                    },
                    favicon: null,
                    ogImage: null
                }
            }
            res.status(200).json({
                success: true,
                data: seoData
            })
        } catch (err) {
            res.status(500).json({
                success: false,
                message: 'An error occured while getting the data..'
            })
        }
    },
    editSeo: async (req, res) => {
        try {
            const { homeTitle, metaDescription, metaKeywords } = req.body;

            // Find existing SEO document
            let seoData = await Seo.findOne();

            if (!seoData) {
                // Create a new document if not exists
                seoData = new Seo({
                    homeTitle,
                    metaDescription,
                    metaKeywords
                });
            } else {
                // Update the existing fields
                seoData.homeTitle = homeTitle;
                seoData.metaDescription = metaDescription;
                seoData.metaKeywords = metaKeywords;
            }

            // Save the changes (create or update)
            await seoData.save();

            return res.status(200).json({
                success: true,
                message: "SEO data updated successfully"
            });
        } catch (err) {
            console.error("Error in editSeo:", err);
            return res.status(500).json({
                success: false,
                message: "An error occurred while updating SEO data"
            });
        }
    },
    getCharges: async (req, res) => {
        try {
            const { branchId } = req.query;
            if (!branchId) {
                return res.status(400).json({ success: false, message: "Branch ID is required" });
            }

            const branch = await Store.findById(branchId);
            if (!branch) {
                return res.status(404).json({ success: false, message: "Branch not found" });
            }

            res.status(200).json({
                success: true,
                data: { charges: branch.extraCharges || [] },
            });
        } catch (err) {
            console.error("Error in getCharges:", err);
            res.status(500).json({
                success: false,
                message: "An error occurred while fetching charges",
            });
        }
    },
    createCharge: async (req, res) => {
        try {
            const { branchId, name, type } = req.body;

            if (!branchId || !name || !type?.name || type.value === undefined || isNaN(type.value)) {
                return res.status(400).json({
                    success: false,
                    message: "Missing or invalid required fields: branchId, name, type.name, or type.value",
                });
            }

            const branch = await Store.findById(branchId);
            if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

            if (!Array.isArray(branch.extraCharges)) {
                branch.extraCharges = [];
            }

            const newCharge = {
                name,
                chargeConfig: {
                    chargeMethod: type.name,
                    value: parseFloat(type.value)
                },
                isActive: true
            };
            branch.extraCharges.push(newCharge);
            await branch.save();

            res.status(201).json({
                success: true,
                data: branch.extraCharges[branch.extraCharges.length - 1],
                message: "Charge created successfully",
            });
        } catch (err) {
            console.error("Error in createCharge:", err);
            res.status(500).json({
                success: false,
                message: "An error occurred while creating the charge",
                error: err.message
            });
        }
    },
    editCharge: async (req, res) => {
        try {
            const { branchId, name, type, isActive } = req.body;
            const chargeId = req.params.id;

            if (!branchId) return res.status(400).json({ success: false, message: "Branch ID is required" });

            const branch = await Store.findById(branchId);
            if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

            const charge = branch.extraCharges.id(chargeId);
            if (!charge) return res.status(404).json({ success: false, message: "Charge not found" });

            if (name) charge.name = name;
            if (type) {
                charge.chargeConfig = {
                    chargeMethod: type.name || charge.chargeConfig.chargeMethod,
                    value: type.value !== undefined ? parseFloat(type.value) : charge.chargeConfig.value
                };
            }
            if (isActive !== undefined) charge.isActive = isActive;

            await branch.save();

            res.status(200).json({
                success: true,
                data: charge,
                message: "Charge updated successfully",
            });
        } catch (err) {
            console.error("Error in editCharge:", err);
            res.status(500).json({
                success: false,
                message: "An error occurred while updating the charge",
                error: err.message
            });
        }
    },
    deleteCharge: async (req, res) => {
        try {
            const chargeId = req.params.id;
            const { branchId } = req.query;

            if (!branchId) return res.status(400).json({ success: false, message: "Branch ID is required" });

            const branch = await Store.findById(branchId);
            if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

            branch.extraCharges.pull(chargeId);
            await branch.save();

            res.status(200).json({
                success: true,
                message: "Charge deleted successfully",
            });
        } catch (err) {
            console.error("Error in deleteCharge:", err);
            res.status(500).json({
                success: false,
                message: "An error occurred while deleting the charge",
            });
        }
    },

    getDeliveryCharges: async (req, res) => {
        try {
            const { branchId } = req.query;
            if (!branchId) return res.status(400).json({ success: false, message: "Branch ID is required" });

            const branch = await Store.findById(branchId);
            if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

            return res.status(200).json({
                success: true,
                data: { charges: branch.deliveryCharges || [] }
            });
        } catch (err) {
            console.error("Error in getDeliveryCharges:", err);
            return res.status(500).json({
                success: false,
                message: "An error occurred while fetching delivery charges"
            });
        }
    },

    createDeliveryCharge: async (req, res) => {
        try {
            const { branchId, emirate, chargeType, fixedCharge, distanceCharge } = req.body;

            if (!branchId || !emirate || !chargeType) {
                return res.status(400).json({ success: false, message: "branchId, emirate and chargeType are required." });
            }

            const branch = await Store.findById(branchId);
            if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

            // Check if already exists for this emirate in this branch
            const existing = branch.deliveryCharges.find(c => c.emirate === emirate);
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: `Delivery charge configuration already exists for ${emirate} in this branch.`
                });
            }

            const newCharge = {
                emirate,
                chargeType,
                fixedCharge: chargeType === 'fixed' ? fixedCharge : 0,
                distanceCharge: chargeType === 'distance' ? distanceCharge : { baseDistance: 10, baseCost: 0, extraCostPerKm: 0 },
                isActive: true
            };

            branch.deliveryCharges.push(newCharge);
            await branch.save();

            return res.status(201).json({
                success: true,
                message: "Delivery charge created successfully",
                data: branch.deliveryCharges[branch.deliveryCharges.length - 1]
            });

        } catch (err) {
            console.error("Error in createDeliveryCharge:", err);
            return res.status(500).json({
                success: false,
                message: "An error occurred while creating delivery charge"
            });
        }
    },

    editDeliveryCharge: async (req, res) => {
        try {
            const chargeId = req.params.id;
            const { branchId, emirate, chargeType, fixedCharge, distanceCharge, isActive } = req.body;

            if (!branchId) return res.status(400).json({ success: false, message: "Branch ID is required" });

            const branch = await Store.findById(branchId);
            if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

            const charge = branch.deliveryCharges.id(chargeId);
            if (!charge) return res.status(404).json({ success: false, message: "Delivery charge not found" });

            if (emirate) charge.emirate = emirate;
            if (chargeType) charge.chargeType = chargeType;
            if (isActive !== undefined) charge.isActive = isActive;

            if (chargeType === 'fixed') {
                charge.fixedCharge = fixedCharge;
            } else if (chargeType === 'distance') {
                charge.distanceCharge = distanceCharge;
            }

            await branch.save();

            return res.status(200).json({
                success: true,
                message: "Delivery charge updated successfully",
                data: charge
            });

        } catch (err) {
            console.error("Error in editDeliveryCharge:", err);
            return res.status(500).json({
                success: false,
                message: "An error occurred while updating delivery charge"
            });
        }
    },

    deleteDeliveryCharge: async (req, res) => {
        try {
            const chargeId = req.params.id;
            const { branchId } = req.query;

            if (!branchId) return res.status(400).json({ success: false, message: "Branch ID is required" });

            const branch = await Store.findById(branchId);
            if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

            branch.deliveryCharges.pull(chargeId);
            await branch.save();

            return res.status(200).json({
                success: true,
                message: "Delivery charge deleted successfully"
            });

        } catch (err) {
            console.error("Error in deleteDeliveryCharge:", err);
            return res.status(500).json({
                success: false,
                message: "An error occurred while deleting delivery charge"
            });
        }
    }
}

module.exports = settingHelper