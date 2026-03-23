const helmet = require('helmet');
const mongoose = require('mongoose');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const verifyAdmin = require('./helper/verifyAdmin');
const verifySuperAdmin = require('./helper/verifySuperAdmin');

var indexRouter = require('./routes/index');
var adminUserRouter = require('./routes/adminUserSetting');
var deliveryExecutiveRouter = require('./routes/deliveryExecutiveSetting');
var productRouter = require('./routes/product');
var orderRouter = require('./routes/order');
var adminAuthRouter = require('./routes/adminAuth');
var dashboardRouter = require('./routes/dashboard');
var settingRouter = require('./routes/settings')
var contactRouter = require('./routes/contacts');
var setupRouter = require('./routes/setup');

const getAdmin = require('./helper/getAdmin');
require("dotenv").config();
const db = require("./config/connection");
db.DBconnect();
const adminHelper = require("./helper/adminHelper");
adminHelper.ensureInitialData();

// One-time Migration for FCM Tokens to standalone DeviceToken collection
const migrateTokens = async () => {
  try {
    const User = require('./model/userSchema');
    const DeviceToken = require('./model/deviceTokenSchema');
    
    // Check if we are connected first
    if (mongoose.connection.readyState !== 1) {
      console.log('[Migration] Waiting for MongoDB connection before starting migration...');
      await new Promise((resolve) => {
        mongoose.connection.once('open', resolve);
      });
    }

    const usersWithTokens = await User.find({ "fcmTokens.0": { $exists: true } });
    console.log(`[Migration] Found ${usersWithTokens.length} users with legacy tokens.`);
    
    let migratedCount = 0;
    for (const user of usersWithTokens) {
      for (const tokenObj of user.fcmTokens) {
        await DeviceToken.findOneAndUpdate(
          { token: tokenObj.token },
          { 
            userId: user._id, 
            platform: tokenObj.platform || 'unknown',
            lastUsed: tokenObj.lastUsed || new Date()
          },
          { upsert: true }
        );
        migratedCount++;
      }
    }
    if (migratedCount > 0) {
      console.log(`[Migration] Successfully migrated ${migratedCount} tokens to DeviceToken collection.`);
    }
  } catch (err) {
    console.error('[Migration] Token migration failed:', err);
  }
};
migrateTokens();

var app = express();

// Trust Proxy (Required for Nginx/Heroku/Load Balancers)
app.set('trust proxy', 1);

// Custom request logger - MUST be first to log every request
app.use((req, res, next) => {
  res.on('finish', () => {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - status: ${res.statusCode}`);
  });
  next();
});

// Security Headers with CSP configuration
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       scriptSrc: [
//         "'self'",
//         "'unsafe-inline'", // Required for inline scripts in EJS templates
//         "'unsafe-eval'", // Required for Alpine.js and other frameworks that use Function()
//         "https://cdn.jsdelivr.net",
//         "https://unpkg.com",
//         "https://code.jquery.com",
//         "https://cdn.datatables.net",
//         "https://cdnjs.cloudflare.com",
//         "https://stackpath.bootstrapcdn.com",
//         "https://maxcdn.bootstrapcdn.com"
//       ],
//       styleSrc: [
//         "'self'",
//         "'unsafe-inline'", // Required for inline styles
//         "https://cdn.jsdelivr.net",
//         "https://unpkg.com",
//         "https://fonts.googleapis.com",
//         "https://cdn.datatables.net",
//         "https://cdnjs.cloudflare.com",
//         "https://stackpath.bootstrapcdn.com",
//         "https://maxcdn.bootstrapcdn.com",
//         "https://use.fontawesome.com"
//       ],
//       fontSrc: [
//         "'self'",
//         "data:",
//         "https://fonts.gstatic.com",
//         "https://cdn.jsdelivr.net",
//         "https://cdnjs.cloudflare.com",
//         "https://use.fontawesome.com",
//         "https://stackpath.bootstrapcdn.com",
//         "https://maxcdn.bootstrapcdn.com"
//       ],
//       imgSrc: [
//         "'self'",
//         "data:",
//         "blob:",
//         "https:",
//         "http:"
//       ],
//       connectSrc: ["'self'"],
//       objectSrc: ["'none'"],
//       mediaSrc: ["'self'"],
//       frameSrc: ["'self'"]
//     }
//   }
// }));

// NoSQL Injection Protection
app.use(mongoSanitize());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again after 15 minutes'
});
app.use('/api/auth/', authLimiter);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Setup session middleware with MongoDB store
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('WARNING: SESSION_SECRET not set in .env. Using a generated random secret. Sessions will not persist across restarts.');
}

app.use(
  session({
    name: 'igrab_admin_sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: `mongodb://localhost:27017/${process.env.DB_NAME || 'iGrab_DB'}`,
      collectionName: 'admin_sessions',
      ttl: 60 * 24 * 60 * 60, // 60 days in seconds
      autoRemove: 'native', // Let MongoDB handle expired session cleanup
      touchAfter: 24 * 3600, // Lazy session update - update session once per 24 hours
      crypto: {
        secret: sessionSecret
      }
    }),
    cookie: {
      maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
      sameSite: 'lax'
    }
  })
);

// Session Debug Middleware - REMOVED after verification
// app.use((req, res, next) => { ... });

// app.use(logger('dev'));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../storage/public/products')));
app.use(express.static(path.join(__dirname, '../storage/public/brands')));
app.use(express.static(path.join(__dirname, '../storage/public/categories')));
app.use(express.static(path.join(__dirname, '../storage/public/others')));

app.use('/uploads/products', express.static(path.join(__dirname, '../storage/public/products')));
app.use('/uploads/brands', express.static(path.join(__dirname, '../storage/public/brands')));
app.use('/uploads/categories', express.static(path.join(__dirname, '../storage/public/categories')));
app.use('/uploads/others', express.static(path.join(__dirname, '../storage/public/others')));


app.use('/', adminAuthRouter)
app.use(verifyAdmin);
const verifySetup = require('./middleware/verifySetup');
app.use(verifySetup);
app.use(getAdmin);

app.use('/', dashboardRouter);
app.use('/', indexRouter);
app.use('/', productRouter);
app.use('/', orderRouter);
app.use('/', settingRouter);
app.use('/', deliveryExecutiveRouter);
app.use('/', contactRouter);
app.use('/', setupRouter);
app.use(verifySuperAdmin);
app.use('/', adminUserRouter);

const errorHandler = require('./middleware/errorHandler');

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  // Check if it's an API request
  if (req.originalUrl.startsWith('/api') || req.headers.accept.includes('application/json')) {
    return res.status(404).json({
      success: false,
      message: 'Not Found'
    });
  }
  res.status(404).render('error/404');
});

// error handler
app.use(errorHandler);

module.exports = app;
