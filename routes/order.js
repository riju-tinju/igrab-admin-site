var express = require('express');
var router = express.Router();
const productHelper = require('../helper/product-helper');
const orderHelper = require('../helper/orderHelper')
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
router.get('/orders', function (req, res, next) {
  res.render('pages/order/orders', { title: 'Order Management' });
});
/* GET users listing. */
router.get('/api/orders', asyncHandler(async function (req, res, next) {
  await orderHelper.getOrderByFilter(req, res);
}));
router.patch('/api/orders/:id/status', asyncHandler(async function (req, res, next) {
  await orderHelper.updateOrderStatus(req, res);
}));
router.patch('/api/orders/bulk-update', asyncHandler(async function (req, res, next) {
  await orderHelper.bulkUpdateOrderStatus(req, res);
}));

router.post('/api/orders/export', asyncHandler(async function (req, res, next) {
  await orderHelper.exportOrders(req, res);
}));

router.get("/api/orders/delivery-executives", asyncHandler(async (req, res) => {
  await orderHelper.getAllExecutives(req, res)
}));

router.post('/api/delivery-executives/:executiveId/toggle-save', asyncHandler(async (req, res) => {
  await orderHelper.saveDeliveryExecutiveByAdmin(req, res);
}));

router.post('/api/orders/:orderId/assign-delivery', asyncHandler(async (req, res) => {
  await orderHelper.assignDeliveryExecutive(req, res);
}));

module.exports = router;
