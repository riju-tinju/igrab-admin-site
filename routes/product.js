var express = require('express');
var router = express.Router();
const productHelper = require('../helper/product-helper');
const upload = require("../helper/upload");
const asyncHandler = require('../helper/asyncHandler');
let products = [
  {
    _id: "507f1f77bcf86cd799439011",
    name: "Classic Espresso",
    category: "Coffee",
    price: 18,
    stock: 283,
    totalOrders: 1420,
    brand: "iGrab Premium",
    status: "published",
    image: "☕",
    createdAt: "2023-12-01T10:30:00Z"
  },
  {
    _id: "507f1f77bcf86cd799439012",
    name: "Kunafa Supreme",
    category: "Sweets",
    price: 45,
    stock: 98,
    totalOrders: 856,
    brand: "Al Amoor Sweets",
    status: "published",
    image: "🧁",
    createdAt: "2023-11-28T15:45:00Z"
  },
  {
    _id: "507f1f77bcf86cd799439013",
    name: "Turkish Delight",
    category: "Sweets",
    price: 32,
    stock: 154,
    totalOrders: 632,
    brand: "Heritage Sweets",
    status: "published",
    image: "🍬",
    createdAt: "2023-11-25T09:20:00Z"
  },
  {
    _id: "507f1f77bcf86cd799439014",
    name: "Caramel Macchiato",
    category: "Coffee",
    price: 28,
    stock: 0,
    totalOrders: 445,
    brand: "iGrab Premium",
    status: "out-of-stock",
    image: "☕",
    createdAt: "2023-11-20T14:15:00Z"
  },
  {
    _id: "507f1f77bcf86cd799439015",
    name: "Fresh Orange Juice",
    category: "Beverages",
    price: 15,
    stock: 267,
    totalOrders: 234,
    brand: "iGrab Fresh",
    status: "published",
    image: "🍊",
    createdAt: "2023-11-18T11:30:00Z"
  },
  {
    _id: "507f1f77bcf86cd799439016",
    name: "Baklava Mix",
    category: "Sweets",
    price: 55,
    stock: 76,
    totalOrders: 389,
    brand: "Damascus Sweets",
    status: "published",
    image: "🥮",
    createdAt: "2023-11-15T16:45:00Z"
  },
  {
    _id: "507f1f77bcf86cd799439017",
    name: "Americano",
    category: "Coffee",
    price: 22,
    stock: 145,
    totalOrders: 891,
    brand: "iGrab Premium",
    status: "published",
    image: "☕",
    createdAt: "2023-11-12T08:20:00Z"
  },
  {
    _id: "507f1f77bcf86cd799439018",
    name: "iGrab T-Shirt",
    category: "Merchandise",
    price: 65,
    stock: 45,
    totalOrders: 67,
    brand: "iGrab Official",
    status: "draft",
    image: "👕",
    createdAt: "2023-11-10T13:10:00Z"
  },
  {
    _id: "507f1f77bcf86cd799439019",
    name: "Iced Latte",
    category: "Beverages",
    price: 25,
    stock: 189,
    totalOrders: 512,
    brand: "iGrab Premium",
    status: "published",
    image: "🧊",
    createdAt: "2023-11-08T10:45:00Z"
  },
  {
    _id: "507f1f77bcf86cd799439020",
    name: "Ma'amoul Cookies",
    category: "Sweets",
    price: 38,
    stock: 234,
    totalOrders: 678,
    brand: "Traditional Treats",
    status: "published",
    image: "🍪",
    createdAt: "2023-11-05T12:30:00Z"
  }
]
/* GET users listing. */
router.get('/product', function (req, res, next) {
  res.render('pages/products/products', { title: 'Product Management' });
});
/* GET users listing. */
router.get('/api/products', asyncHandler(async function (req, res, next) {
  await productHelper.getProductByFilter(req, res);

  // const response = {
  //   "success": true,
  //   "data": {
  //     "products": products,
  //     "pagination": {
  //       "currentPage": 1,
  //       "totalPages": 25,
  //       "totalProducts": 247,
  //       "hasNext": true,
  //       "hasPrev": false
  //     },
  //     "stats": {
  //       "totalProducts": 2479,
  //       "publishedProducts": 198,
  //       "lowStockProducts": 12,
  //       "outOfStockProducts": 8
  //     }
  //   }
  // }

  // res.json(response);
}))
router.delete('/api/products/:id', asyncHandler(async function (req, res, next) {
  await productHelper.deleteProduct(req, res);
}));

router.patch('/api/products/:id/stock', asyncHandler(async function (req, res, next) {
  await productHelper.setStockToProduct(req, res);
}));


// creta product
router.get('/product/create', asyncHandler(async function (req, res, next) {
  let { brands, stores, categories } = await productHelper.getDataForCreateProduct(req, res);
  const imageLimit = parseInt(process.env.IMAGE_LIMIT) || 10;
  const imageSizeLimit = parseFloat(process.env.IMAGE_SIZE_LIMIT) || 5;
  res.render('pages/products/create-product', { brands, stores, categories, imageLimit, imageSizeLimit });
}));
router.post('/product/create', asyncHandler(async function (req, res, next) {
  await productHelper.createProduct(req, res);
}));

// POST /upload/images
router.post('/upload/images', upload.array('images', 10), asyncHandler(async function (req, res, next) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No files uploaded",
      code: "NO_FILES"
    });
  }

  const savedFilenames = [];

  // Save each file name to DB
  for (const file of req.files) {
    savedFilenames.push(`${file.filename}`);
  }

  res.status(200).json({
    success: true,
    data: {
      urls: savedFilenames
    }
  });
}));

router.post('/categories', upload.array('image', 10), asyncHandler(async function (req, res) {
  await productHelper.createCategory(req, res, req.files[0]?.filename || null);
}));
router.post('/brands', upload.array('logo', 10), asyncHandler(async function (req, res) {
  await productHelper.createBrand(req, res, req.files[0]?.filename || null);
}));


// EDIT product
router.get('/product/edit/:id', asyncHandler(async function (req, res, next) {
  let { brands, stores, categories } = await productHelper.getDataForCreateProduct(req, res);
  let product = await productHelper.getProductById(req.params.id);
  if (!product) {
    return res.status(404).render('error/404'); // Use custom error page
  }
  const imageLimit = parseInt(process.env.IMAGE_LIMIT) || 10;
  const imageSizeLimit = parseFloat(process.env.IMAGE_SIZE_LIMIT) || 5;
  res.render('pages/products/edit-product', { brands, stores, categories, product, imageLimit, imageSizeLimit });
}));

router.post('/product/edit', asyncHandler(async function (req, res, next) {
  await productHelper.editProduct(req, res);
}));
module.exports = router;
