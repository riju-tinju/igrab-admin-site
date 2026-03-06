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

const dashboardFun = {
  getDashboardOverview: async (req, res) => {
    try {
      let branchId = req.session.admin?.selectedBranch;
      if (branchId) branchId = branchId.toString();
      if (!branchId) {
        // Check if any branches exist at all
        const anyBranch = await Store.findOne({});
        if (!anyBranch) {
          // System zero-state: No branches exist yet. Return empty stats.
          return res.status(200).json({
            success: true,
            data: {
              stats: {
                totalRevenue: { today: 0, yesterday: 0, thisWeek: 0, lastWeek: 0, thisMonth: 0, lastMonth: 0, percentageChange: 0 },
                orders: { total: 0, today: 0, pending: 0, confirmed: 0, processing: 0, delivered: 0, cancelled: 0, averageOrderValue: 0 },
                customers: { total: 0, newToday: 0, newThisWeek: 0, activeCustomers: 0, growthRate: 0 },
                products: { total: 0, published: 0, outOfStock: 0, lowStock: 0, topSellingToday: [] },
                branches: { total: 0, active: 0, topPerforming: "N/A", totalSalesToday: 0 }
              }
            }
          });
        }
        // If a branch exists but none is selected, auto-select the first one for the response
        const autoBranchId = anyBranch._id.toString();
        req.session.admin.selectedBranch = autoBranchId;
        return res.redirect(req.originalUrl);
      }


      const now = new Date();
      const startOfToday = new Date(now.setHours(0, 0, 0, 0));
      const endOfToday = new Date(now.setHours(23, 59, 59, 999));

      const yesterdayStart = new Date();
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date();
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date();
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const startOfLastWeek = new Date(startOfWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

      const endOfLastWeek = new Date(endOfWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() - 7);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const [
        revenueToday,
        revenueYesterday,
        revenueThisWeek,
        revenueLastWeek,
        revenueThisMonth,
        revenueLastMonth,
        orderStats,
        userStats,
        totalProducts,
        publishedProducts,
        lowStock,
        outOfStock,
        topSellingToday,
        branches,
        totalSalesToday
      ] = await Promise.all([
        Order.aggregate([
          { $match: { storeId: branchId, paymentStatus: "Paid", status: { $ne: "Cancelled" }, orderDate: { $gte: startOfToday, $lte: endOfToday } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]).then(r => r[0]?.total || 0),

        Order.aggregate([
          { $match: { storeId: branchId, paymentStatus: "Paid", status: { $ne: "Cancelled" }, orderDate: { $gte: yesterdayStart, $lte: yesterdayEnd } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]).then(r => r[0]?.total || 0),

        Order.aggregate([
          { $match: { storeId: branchId, paymentStatus: "Paid", status: { $ne: "Cancelled" }, orderDate: { $gte: startOfWeek, $lte: endOfWeek } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]).then(r => r[0]?.total || 0),

        Order.aggregate([
          { $match: { storeId: branchId, paymentStatus: "Paid", status: { $ne: "Cancelled" }, orderDate: { $gte: startOfLastWeek, $lte: endOfLastWeek } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]).then(r => r[0]?.total || 0),

        Order.aggregate([
          { $match: { storeId: branchId, paymentStatus: "Paid", status: { $ne: "Cancelled" }, orderDate: { $gte: startOfMonth, $lte: endOfMonth } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]).then(r => r[0]?.total || 0),

        Order.aggregate([
          { $match: { storeId: branchId, paymentStatus: "Paid", status: { $ne: "Cancelled" }, orderDate: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]).then(r => r[0]?.total || 0),

        (async () => {
          const total = await Order.countDocuments({ storeId: branchId });
          const today = await Order.countDocuments({ storeId: branchId, orderDate: { $gte: startOfToday, $lte: endOfToday } });
          const pending = await Order.countDocuments({ storeId: branchId, status: "Pending" });
          const confirmed = await Order.countDocuments({ storeId: branchId, status: "Confirmed" });
          const processing = await Order.countDocuments({ storeId: branchId, status: "Processing" });
          const delivered = await Order.countDocuments({ storeId: branchId, status: "Delivered" });
          const cancelled = await Order.countDocuments({ storeId: branchId, status: "Cancelled" });
          const avgOrder = await Order.aggregate([
            { $match: { storeId: branchId } },
            { $group: { _id: null, avg: { $avg: "$totalAmount" } } },
          ]).then(r => r[0]?.avg || 0);

          return { total, today, pending, confirmed, processing, delivered, cancelled, averageOrderValue: avgOrder };
        })(),

        (async () => {
          const total = await User.countDocuments();
          const newToday = await User.countDocuments({ createdAt: { $gte: startOfToday, $lte: endOfToday } });
          const newThisWeek = await User.countDocuments({ createdAt: { $gte: startOfWeek, $lte: endOfWeek } });
          const activeCustomers = await Order.distinct("userId", { storeId: branchId }).then(ids => ids.length);
          return { total, newToday, newThisWeek, activeCustomers, growthRate: 12.3 };
        })(),

        Product.countDocuments({ branchIds: branchId }),
        Product.countDocuments({ branchIds: branchId, "status.isPublished": true }),
        Inventory.countDocuments({ branchId, stock: { $lt: 10, $gt: 0 } }),
        Inventory.countDocuments({ branchId, stock: 0 }),
        Product.find({ branchIds: branchId }).sort({ "sales.totalOrders": -1 }).limit(5),

        Store.find({}),
        Order.aggregate([
          { $match: { paymentStatus: "Paid", status: { $ne: "Cancelled" }, orderDate: { $gte: startOfToday, $lte: endOfToday } } },
          { $group: { _id: "$storeId", total: { $sum: "$totalAmount" } } },
          { $sort: { total: -1 } }
        ]),
      ]);

      const percentageChange = revenueLastMonth ? (((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100).toFixed(2) : 0;


      res.status(200).json({
        success: true,
        data: {
          stats: {
            totalRevenue: {
              today: revenueToday,
              yesterday: revenueYesterday,
              thisWeek: revenueThisWeek,
              lastWeek: revenueLastWeek,
              thisMonth: revenueThisMonth,
              lastMonth: revenueLastMonth,
              percentageChange: Number(percentageChange)
            },
            orders: orderStats,
            customers: userStats,
            products: {
              total: totalProducts,
              published: publishedProducts,
              outOfStock,
              lowStock,
              topSellingToday
            },
            branches: {
              total: branches.length,
              active: branches.filter(b => b.isActive).length,
              topPerforming: totalSalesToday.length > 0 ? (await Store.findById(totalSalesToday[0]._id))?.name || "N/A" : "N/A",
              totalSalesToday: totalSalesToday.reduce((sum, b) => sum + b.total, 0)
            }
          }
        }
      });

    } catch (err) {
      console.error("Error in getDashboardOverview:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR"
      });
    }
  },
  fetchRevenue: async (req, res) => {
    try {
      const { period = "7days" } = req.query;
      let branchId = req.session.admin?.selectedBranch;
      if (branchId) branchId = branchId.toString();
      if (!branchId) {
        const anyBranch = await Store.findOne({});
        if (!anyBranch) {
          return res.status(200).json({
            success: true,
            data: {
              revenueData: [],
              summary: { totalRevenue: 0, totalOrders: 0, averageDaily: 0, growthRate: 0 }
            }
          });
        }
        return res.status(400).json({ success: false, message: "Branch not selected", code: "BRANCH_REQUIRED" });
      }

      const days = parseInt(period.replace("days", "")) || 7;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (days - 1));

      const revenueData = await Order.aggregate([
        {
          $match: {
            storeId: branchId,
            paymentStatus: "Paid",
            status: { $ne: "Cancelled" },
            orderDate: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$orderDate" },
            },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
      ]);

      const formattedData = [];
      let totalRevenue = 0;
      let totalOrders = 0;

      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(endDate.getDate() - i);
        const formattedDate = date.toISOString().split("T")[0];
        const dayData = revenueData.find(d => d._id === formattedDate);

        const revenue = dayData ? dayData.revenue : 0;
        const orders = dayData ? dayData.orders : 0;

        formattedData.push({ date: formattedDate, revenue, orders });
        totalRevenue += revenue;
        totalOrders += orders;
      }

      const averageDaily = totalRevenue / days;

      // Calculate growth rate (compare to previous period)
      const prevStart = new Date(startDate);
      prevStart.setDate(prevStart.getDate() - days);
      const prevEnd = new Date(startDate);
      prevEnd.setDate(prevEnd.getDate() - 1);

      const previousRevenue = await Order.aggregate([
        {
          $match: {
            storeId: branchId,
            paymentStatus: "Paid",
            status: { $ne: "Cancelled" },
            orderDate: { $gte: prevStart, $lte: prevEnd },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalAmount" },
          },
        },
      ]);

      const previousTotal = previousRevenue[0]?.revenue || 0;
      const growthRate = previousTotal
        ? ((totalRevenue - previousTotal) / previousTotal) * 100
        : 0;

      res.status(200).json({
        success: true,
        data: {
          revenueData: formattedData.reverse(),
          summary: {
            totalRevenue: parseFloat(totalRevenue.toFixed(2)),
            totalOrders,
            averageDaily: parseFloat(averageDaily.toFixed(2)),
            growthRate: parseFloat(growthRate.toFixed(2)),
          },
        },
      });
    } catch (err) {
      console.error("Error in fetchRevenue:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR",
      });
    }
  },
  getOrderAnalytics: async (req, res) => {
    try {
      let branchId = req.session.admin?.selectedBranch;
      if (branchId) branchId = branchId.toString();
      if (!branchId) {
        const anyBranch = await Store.findOne({});
        if (!anyBranch) {
          return res.status(200).json({
            success: true,
            data: { statusDistribution: [] }
          });
        }
        return res.status(400).json({ success: false, message: "Branch not selected" });
      }

      const totalOrders = await Order.countDocuments({ storeId: branchId });
      const statuses = ["Delivered", "Processing", "Confirmed", "Pending", "Cancelled"];

      const statusCounts = await Promise.all(
        statuses.map(async status => {
          const count = await Order.countDocuments({ storeId: branchId, status });
          const percentage = totalOrders > 0 ? (count / totalOrders) * 100 : 0;
          return { status, count, percentage: parseFloat(percentage.toFixed(1)) };
        })
      );

      res.status(200).json({
        success: true,
        data: { statusDistribution: statusCounts }
      });
    } catch (err) {
      console.error("Error in getOrderAnalytics:", err);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  },

  getTopProducts: async (req, res) => {
    try {
      const { limit = 5 } = req.query;
      let branchId = req.session.admin?.selectedBranch;
      if (branchId) branchId = branchId.toString();
      if (!branchId) {
        const anyBranch = await Store.findOne({});
        if (!anyBranch) {
          return res.status(200).json({ success: true, data: { topProducts: [] } });
        }
        return res.status(400).json({ success: false, message: "Branch not selected" });
      }

      const days = parseInt((req.query.period || "7days").replace("days", "")) || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      startDate.setHours(0, 0, 0, 0);

      const result = await Order.aggregate([
        {
          $match: {
            storeId: branchId,
            paymentStatus: "Paid",
            status: { $ne: "Cancelled" },
            orderDate: { $gte: startDate }
          }
        },
        { $unwind: "$orderItems" },
        {
          $group: {
            _id: "$orderItems.productId",
            totalSold: { $sum: "$orderItems.qty" },
            revenue: { $sum: "$orderItems.total" },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $lookup: {
            from: "categories",
            localField: "product.categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $project: {
            productId: "$_id",
            name: "$product.name.en",
            category: "$category.name.en",
            totalSold: 1,
            revenue: 1,
            image: { $arrayElemAt: ["$product.images", 0] },
          },
        },
      ]);
      res.status(200).json({ success: true, data: { topProducts: result } });
    } catch (err) {
      console.error("Error in getTopProducts:", err);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  },

  getBranchPerformance: async (req, res) => {
    try {
      const today = new Date();
      const startOfToday = new Date(today.setHours(0, 0, 0, 0));
      const endOfToday = new Date(today.setHours(23, 59, 59, 999));

      const yesterdayStart = new Date();
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date();
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const branches = await Store.find({});
      const branchPerformance = await Promise.all(
        branches.map(async (branch) => {
          const [todayPerf, yesterdayPerf] = await Promise.all([
            Order.aggregate([
              { $match: { storeId: branch._id.toString(), paymentStatus: "Paid", status: { $ne: "Cancelled" }, orderDate: { $gte: startOfToday, $lte: endOfToday } } },
              { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } }
            ]).then(r => r[0] || { total: 0, count: 0 }),
            Order.aggregate([
              { $match: { storeId: branch._id.toString(), paymentStatus: "Paid", status: { $ne: "Cancelled" }, orderDate: { $gte: yesterdayStart, $lte: yesterdayEnd } } },
              { $group: { _id: null, total: { $sum: "$totalAmount" } } }
            ]).then(r => r[0]?.total || 0)
          ]);

          const todayRevenue = todayPerf.total;
          const todayOrders = todayPerf.count;
          const growth = yesterdayPerf > 0
            ? parseFloat(((todayRevenue - yesterdayPerf) / yesterdayPerf * 100).toFixed(1))
            : (todayRevenue > 0 ? 100 : 0);

          return {
            branchId: branch._id,
            name: branch.name,
            todayRevenue: parseFloat(todayRevenue.toFixed(2)),
            todayOrders: todayOrders,
            growth
          };
        })
      );

      res.status(200).json({ success: true, data: { branchPerformance } });
    } catch (err) {
      console.error("Error in getBranchPerformance:", err);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  },
}


module.exports = dashboardFun