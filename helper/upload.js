const multer = require("multer");
const path = require("path");
const fs = require("fs");

const getStorageDir = (req) => {
  const url = req.originalUrl || req.url;
  let subfolder = "others";

  if (url.includes("/upload/images") || url.includes("/products")) {
    subfolder = "products";
  } else if (url.includes("/brands")) {
    subfolder = "brands";
  } else if (url.includes("/categories")) {
    subfolder = "categories";
  } else if (url.includes("/settings/upload")) {
    subfolder = "brands"; // Settings logo typically acts like a brand logo
  }

  // Adjust path relative to admin site/helper/upload.js -> e:\projects\igrbwork\storage\public
  const dir = path.join(__dirname, "../../storage/public", subfolder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, getStorageDir(req));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    // Keep 'product-' prefix for backward compatibility, or we could make this dynamic too.
    const prefix = req.originalUrl && req.originalUrl.includes("/brands") ? "brand-"
      : req.originalUrl && req.originalUrl.includes("/categories") ? "category-"
        : "product-";
    cb(null, prefix + uniqueSuffix + ext);
  }
});

const imageFilter = function (req, file, cb) {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|webp|WEBP|gif|GIF)$/)) {
    req.fileValidationError = 'Only image files are allowed!';
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
};

const imageSizeLimit = (parseFloat(process.env.IMAGE_SIZE_LIMIT) || 5) * 1024 * 1024;

const upload = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: imageSizeLimit
  }
});

module.exports = upload;
