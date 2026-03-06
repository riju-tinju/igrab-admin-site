const mongoose = require("mongoose");
const Product = require("../model/productSchema");
const Category = require("../model/categorySchema");
const Brand = require("../model/brandSchema");
const Reviews = require("../model/reviewSchema");
const User = require("../model/userSchema");
const Admin = require("../model/adminSchema");
const nodemailer = require('nodemailer');

// Create a transporter object using SMTP transport
let transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER, // Use env for security
    pass: process.env.EMAIL_PASS  // Use env for security
  }
});

// Twilio Client Getter (Lazily initialized)
let twilioClient = null;
const getTwilioClient = () => {
  if (twilioClient) return twilioClient;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    console.error("Twilio SID or Auth Token missing in .env");
    return null;
  }
  return require('twilio')(accountSid, authToken);
};

const customerFun = {
  createSuperAdmin: async (req, res) => {
    try {
      const { name, countryCode, phone } = req.params;

      if (!name || !countryCode || !phone) {
        return res.status(400).json({ success: false, message: "Name, countryCode and phone are required" });
      }

      const sanitizedPhone = phone.replace(/\s/g, '');

      // Check if admin already exists
      const exists = await Admin.findOne({ phone: sanitizedPhone, countryCode });
      if (exists) {
        return res.status(409).json({ success: false, message: "Super admin already exists" });
      }

      const admin = new Admin({
        name,
        email: `${sanitizedPhone}@igrab.com`, // Placeholder email
        phone: sanitizedPhone,
        countryCode,
        role: 'superadmin',
        isActive: true
      });

      await admin.save();

      return res.status(201).json({
        success: true,
        message: "Super admin created successfully",
        data: {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      });
    } catch (err) {
      console.error("Error creating super admin:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
  checkAndGenerateOTPUser: async (req, res) => {
    try {
      const { name, countryCode, phone } = req.body;

      // Basic validations
      if (!countryCode) return res.status(400).json({ error: "Country code is required" });
      if (!phone) return res.status(400).json({ error: "Phone number is required" });
      if (!name) return res.status(400).json({ error: "Name is required" });

      const sanitizedPhone = phone.replace(/\s/g, '');
      const fullPhoneNumber = `${countryCode}${sanitizedPhone}`;

      // Generate OTP and expiry
      const otp = customerFun.generateOTP();
      const otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

      // Robust search: try with separate fields first, then fallback to phone field matching full number
      let user = await Admin.findOne({ phone: sanitizedPhone, countryCode: countryCode });

      if (!user) {
        // Fallback: search for admins who might have the full phone number stored in the 'phone' field
        user = await Admin.findOne({ phone: { $in: [fullPhoneNumber, `+${fullPhoneNumber}`, sanitizedPhone] } });

        if (user) {
          // Fix the user record for future logins
          user.phone = sanitizedPhone;
          user.countryCode = countryCode;
          await user.save();
        }
      }

      if (user) {
        // User exists – update OTP
        user.otp.otp = otp;
        user.otp.expiresAt = otpExpiresAt;
        user.otp.chances = 3; // Reset chances
        await user.save();

        // console.log("OTP regenerated for existing user:", fullPhoneNumber, otp);

        try {
          await customerFun.sendOtpSMS(fullPhoneNumber, otp, "login");
          return res.status(200).json({ success: true, message: "OTP sent successfully" });
        } catch (err) {
          console.error("Failed to send SMS:", err);
          return res.status(500).json({ error: "Failed to send OTP SMS. Please try again." });
        }
      }

      return res.status(404).json({ error: "Admin user not found" });
    } catch (err) {
      console.error("Error in checkAndGenerateOTPUser:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  /**
   * Sends an OTP SMS to the user via Twilio.
   */
  sendOtpSMS: async (to, otp, type = "login") => {
    try {
      const client = getTwilioClient();
      if (!client) {
        throw new Error("Twilio client not initialized. Check your .env file.");
      }

      const body = `Your iGrab Admin OTP is ${otp}. Valid for 5 minutes.`;

      if (!process.env.TWILIO_PHONE_NUMBER) {
        console.warn("TWILIO_PHONE_NUMBER not set in .env. SMS will not be sent.");
        return true;
      }

      // console.log(`Attempting to send OTP SMS to ${to} from ${process.env.TWILIO_PHONE_NUMBER}...`);

      const message = await client.messages.create({
        body: body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });

      // console.log(`OTP SMS successfully sent to ${to}. Message SID: ${message.sid}`);
      return true;
    } catch (err) {
      console.error("Failed to send OTP SMS error details:", {
        message: err.message,
        code: err.code,
        status: err.status,
        moreInfo: err.moreInfo
      });
      throw new Error(`SMS sending failed: ${err.message}`);
    }
  },

  /**
   * Generates a 6-digit numeric OTP.
   */
  generateOTP: () => {
    return Math.floor(100000 + Math.random() * 900000);
  },
  verifyOTPUser: async (req, res) => {
    try {
      const { countryCode, phone, otp } = req.body;

      // Validate input
      if (!countryCode || !phone || !otp) {
        return res.status(400).json({
          error: "Country code, phone, and OTP are required"
        });
      }

      // Find user by phone
      const user = await Admin.findOne({ phone: phone, countryCode: countryCode });
      if (!user) {
        return res.status(404).json({ error: "Admin user not found" });
      }

      // Check OTP validity
      const { otp: userOTP } = user;
      if (!userOTP || userOTP.chances < 1) {
        return res.status(400).json({ error: "No OTP attempts remaining" });
      }

      // Verify OTP details
      const isOTPValid = (
        String(userOTP.otp) === String(otp) &&
        Date.now() <= userOTP.expiresAt
      );

      if (!isOTPValid) {
        user.otp.chances -= 1;
        await user.save();

        return res.status(400).json({
          error: "Invalid or expired OTP",
          attemptsRemaining: user.otp.chances
        });
      }

      // Successful verification - update user

      user.otp = {
        otp: null,
        chances: 3,
        expiresAt: null
      };


      await user.save();

      // Set session
      req.session.admin = { id: user._id };

      // Explicitly save session to MongoDB
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
          return res.status(500).json({ error: "Failed to save session" });
        }

        // console.log("Session saved successfully:", req.session.admin);
        // console.log("OTP verified successfully for user:", user);
        return res.status(200).json({
          success: true,
          message: "OTP verified successfully"
        });
      });

    } catch (err) {
      console.error("Error in verifyOTPUser:", err);
      return res.status(500).json({
        error: "Internal server error"
      });
    }
  },

  /**
   * Ensures initial data (Super Admin and Main Branch) exists.
   */
  ensureInitialData: async () => {
    try {
      const StoreBranch = require("../model/storeBranchSchema");

      // 1. Ensure at least one branch exists
      let branch = await StoreBranch.findOne();
      if (!branch) {
        // console.log("No branches found. Creating default branch...");
        branch = new StoreBranch({
          name: "Main Branch",
          address: "Default Address, Dubai",
          email: "mainbranch@example.com",
          contactNumber: "0000000000",
          location: {
            type: "Point",
            coordinates: [55.2708, 25.2048] // Dubai Burj Khalifa approx
          }
        });
        await branch.save();
        // console.log("Default branch created:", branch.name);
      }

      // 2. Ensure at least one Super Admin exists
      let admin = await Admin.findOne({ role: 'superadmin' });
      if (!admin) {
        // console.log("No super admin found. Creating default super admin...");
        admin = new Admin({
          name: "System Admin",
          email: "jadhugd@gmail.com", // Using the email from nodemailer config
          phone: "500000000", // Default phone for seeding
          countryCode: "+971",
          role: 'superadmin',
          isActive: true,
          branches: [branch._id],
          selectedBranch: branch._id
        });
        await admin.save();
        // console.log("Default super admin created:", admin.email);
      }

      return { branch, admin };
    } catch (err) {
      console.error("Error seeding initial data:", err);
    }
  },
}
module.exports = customerFun;
