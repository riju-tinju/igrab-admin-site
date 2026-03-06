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
            const branches = await Store.find({});

            const formattedBranches = branches.map(branch => ({
                _id: branch._id,
                name: branch.name,
                address: branch.address,
                phone: branch.contactNumber || "",
                email: branch.email || "",
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
            const { name, email, address, contactNumber, latitude, longitude } = req.body;

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
            const { name, email, address, contactNumber, isActive, latitude, longitude } = req.body;

            const updatedData = {};

            if (name !== undefined) updatedData.name = name;
            if (email !== undefined) updatedData.email = email;
            if (address !== undefined) updatedData.address = address;
            if (contactNumber !== undefined) updatedData.contactNumber = contactNumber;
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
            const config = await PaymentConfiguration.findOne();
            // console.log('payment configure:\n\n', config)
            //   if (!config) {
            //     return res.status(404).json({
            //       success: false,
            //       message: "Payment configuration not found"
            //     });
            //   }

            return res.status(200).json({
                success: true,
                data: config || {
                    stripe: {
                        publishableKey: '',
                        secretKey: '',
                        webhookSecret: '',
                        isEnabled: false
                    },
                    wallet: {
                        isEnabled: false
                    },
                    cod: {
                        isEnabled: false
                    }


                }
            });
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "An error occurred while fetching payment configuration"
            });
        }
    },
    editPayment: async (req, res) => {
        try {
            const { stripe, cod, wallet } = req.body;

            // Stripe key validation if enabling Stripe
            if (stripe?.isEnabled) {
                if (!stripe.publishableKey?.trim() || !stripe.secretKey?.trim()) {
                    return res.status(400).json({
                        success: false,
                        message: "Stripe keys are required when Stripe is enabled."
                    });
                }
            }

            const updateData = {
                stripe: {
                    publishableKey: stripe.publishableKey || "",
                    secretKey: stripe.secretKey || "",
                    webhookSecret: stripe.webhookSecret || "",
                    isEnabled: stripe.isEnabled
                },
                cod: {
                    isEnabled: cod?.isEnabled ?? false
                },
                wallet: {
                    isEnabled: wallet?.isEnabled ?? false
                }
            };

            // Update the first found config or create new if none exists
            const updatedConfig = await PaymentConfiguration.findOneAndUpdate(
                {},
                { $set: updateData },
                { new: true, upsert: true }
            );

            return res.status(200).json({
                success: true,
                message: "Payment configuration updated successfully",
                data: updatedConfig
            });

        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "An error occurred while updating payment configuration"
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
            const charges = await Charges.find({});
            // console.log(charges)
            res.status(200).json({
                success: true,
                data: {
                    charges
                },
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
            const { name, type } = req.body;

            if (!name || !type?.name || type.value === undefined) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: name, type.name, or type.value",
                });
            }

            if (!["percentage", "number"].includes(type.name)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid type name. Allowed values: 'percentage' or 'number'",
                });
            }

            const newCharge = new Charges({ name, type });
            const savedCharge = await newCharge.save();

            res.status(201).json({
                success: true,
                data: savedCharge,
                message: "Charge created successfully",
            });
        } catch (err) {
            console.error("Error in createCharge:", err);
            res.status(500).json({
                success: false,
                message: "An error occurred while creating the charge",
            });
        }
    },
    editCharge: async (req, res) => {
        try {
            const chargeId = req.params.id;
            const { name, type } = req.body;

            if (!name || !type?.name || type.value === undefined) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: name, type.name, or type.value",
                });
            }

            if (!["percentage", "number"].includes(type.name)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid type name. Allowed values: 'percentage' or 'number'",
                });
            }

            const updatedCharge = await Charges.findByIdAndUpdate(
                chargeId,
                { name, type },
                { new: true }
            );

            if (!updatedCharge) {
                return res.status(404).json({
                    success: false,
                    message: "Charge not found",
                });
            }

            res.status(200).json({
                success: true,
                data: updatedCharge,
                message: "Charge updated successfully",
            });
        } catch (err) {
            console.error("Error in editCharge:", err);
            res.status(500).json({
                success: false,
                message: "An error occurred while updating the charge",
            });
        }
    },
    deleteCharge: async (req, res) => {
        try {
            const chargeId = req.params.id;

            const deleted = await Charges.findByIdAndDelete(chargeId);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: "Charge not found",
                });
            }

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
            const charges = await DeliveryCharge.find({});
            return res.status(200).json({
                success: true,
                data: {
                    charges
                }
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
            const { emirate, chargeType, fixedCharge, distanceCharge } = req.body;

            // Validation
            if (!emirate || !chargeType) {
                return res.status(400).json({
                    success: false,
                    message: "Emirate and Charge Type are required."
                });
            }

            // Check for existing charge for this Emirate
            const existing = await DeliveryCharge.findOne({ emirate });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: `Delivery charge configuration already exists for ${emirate}. Please edit the existing one.`
                });
            }

            const newCharge = new DeliveryCharge({
                emirate,
                chargeType,
                fixedCharge: chargeType === 'fixed' ? fixedCharge : 0,
                distanceCharge: chargeType === 'distance' ? distanceCharge : {}
            });

            await newCharge.save();

            return res.status(201).json({
                success: true,
                message: "Delivery charge created successfully",
                data: newCharge
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
            const { emirate, chargeType, fixedCharge, distanceCharge, isActive } = req.body;

            const updateData = {
                emirate,
                chargeType,
                isActive
            };

            if (chargeType === 'fixed') {
                updateData.fixedCharge = fixedCharge;
                // Optional: reset distanceCharge or keep it
            } else if (chargeType === 'distance') {
                updateData.distanceCharge = distanceCharge;
                // Optional: reset fixedCharge
            }

            const updatedCharge = await DeliveryCharge.findByIdAndUpdate(
                chargeId,
                { $set: updateData },
                { new: true }
            );

            if (!updatedCharge) {
                return res.status(404).json({
                    success: false,
                    message: "Delivery charge not found"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Delivery charge updated successfully",
                data: updatedCharge
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
            const deleted = await DeliveryCharge.findByIdAndDelete(chargeId);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: "Delivery charge not found"
                });
            }

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