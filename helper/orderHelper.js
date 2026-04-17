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
const DeliveryExecutive = require("../model/deliveryExecutiveSchema")
const { sendOrderStatusNotification } = require("./notificationService");
const PaymentConfiguration = require("../model/paymentSchema");
const stripe = require("stripe");


const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return Math.round(d * 100) / 100; // Round to 2 decimal places
};

const orderFun = {
  getOrderByFilter: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        status = "",
        paymentStatus = "",
        paymentMethod = "",
        dateFrom,
        dateTo,
        sortField = "orderDate",
        sortDirection = "desc",
        fulfillmentType = "",
        pickupFilter = "", // delayed, completed, time_not_set
        pickupDateFrom,
        pickupDateTo,
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOptions = {};
      sortOptions[sortField] = sortDirection === "asc" ? 1 : -1;

      let branchId = req.session.admin?.selectedBranch;
      if (branchId) branchId = branchId.toString();
      if (!branchId) {
        // Check if any branches exist at all
        const anyBranch = await Store.findOne({});
        if (!anyBranch) {
          // Zero state: No branches exist yet. Return empty list.
          return res.status(200).json({
            success: true,
            data: {
              orders: [],
              pagination: { currentPage: parseInt(page), totalPages: 0, totalOrders: 0, limit: parseInt(limit), hasNext: false, hasPrev: false },
              stats: { totalOrders: 0, pendingOrders: 0, confirmedOrders: 0, processingOrders: 0, deliveredOrders: 0, cancelledOrders: 0, unpaidOrders: 0, todayOrders: 0, totalRevenue: 0 }
            }
          });
        }
        return res.status(400).json({
          success: false,
          message: "Branch not selected",
          code: "BRANCH_REQUIRED"
        });
      }

      const query = { storeId: branchId };

      // Standard Filters
      if (status && status !== 'all') {
        query.status = status;
      }
      if (paymentStatus) {
        query.paymentStatus = paymentStatus;
      }
      if (paymentMethod) {
        query.paymentMethod = paymentMethod;
      }
      
      // Order Date Range
      if (dateFrom || dateTo) {
        query.orderDate = {};
        if (dateFrom) query.orderDate.$gte = new Date(dateFrom);
        if (dateTo) query.orderDate.$lte = new Date(dateTo);
      }

      // Search (Regex)
      if (search) {
        const userIds = await User.find({
          $or: [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
          ],
        }).select("_id");

        query.$or = [
          { orderId: { $regex: search, $options: "i" } },
          { userId: { $in: userIds.map(u => u._id) } },
        ];
      }

      // Fulfillment & Pickup Specific Filters
      if (fulfillmentType) {
        query.fulfillmentType = fulfillmentType;
      }

      if (pickupFilter) {
        // All pickup filters assume Pickup type
        query.fulfillmentType = "Pickup";
        
        if (pickupFilter === "delayed") {
          // Add to existing status filter if possible, otherwise set nin
          if (query.status) {
             // If they picked a status that isn't delivered/cancelled, keep it. 
             // If they picked Delivered/Cancelled, delayed is empty results.
             if (["Delivered", "Cancelled"].includes(query.status)) {
                query.status = "EMPTY_FORCE_MATCH"; // Will return nothing
             }
          } else {
             query.status = { $nin: ["Delivered", "Cancelled"] };
          }
          query.estimatedPickupTime = { $lt: new Date() };
        } else if (pickupFilter === "completed") {
          query.status = "Delivered";
        } else if (pickupFilter === "time_not_set") {
          query.estimatedPickupTime = null;
        }
      }

      // Target Pickup Date Range
      if (pickupDateFrom || pickupDateTo) {
        query.fulfillmentType = "Pickup";
        query.estimatedPickupTime = query.estimatedPickupTime || {};
        if (pickupDateFrom) query.estimatedPickupTime.$gte = new Date(pickupDateFrom);
        if (pickupDateTo) query.estimatedPickupTime.$lte = new Date(pickupDateTo);
      }

      const totalOrders = await Order.countDocuments(query);
      const orders = await Order.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("userId", "name email phone");

      const formattedOrders = orders.map(order => ({
        _id: order._id,
        orderId: order.orderId,
        storeId: order.storeId,
        userId: order.userId,
        orderDate: order.orderDate,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        subTotal: order.subTotal,
        charges: order.charges,
        discount: order.discount,
        totalAmount: order.totalAmount,
        couponCode: order.couponCode,
        orderItems: order.orderItems,
        address: order.address,
        deliveryExecutive: order.deliveryExecutive,
        cancelReason: order.cancelReason,
        cancelDate: order.cancelDate,
        updatedAt: order.updatedAt,
        fulfillmentType: order.fulfillmentType || 'Delivery',
        pickupTime: order.pickupTime || null,
        estimatedPickupTime: order.estimatedPickupTime || null,
      }));

      const [
        cancelPendingOrders,
        pendingOrders,
        confirmedOrders,
        processingOrders,
        deliveredOrders,
        cancelledOrders,
        unpaidOrders,
        todayOrders,
        totalRevenue,
        delayedPickups,
        pendingPickups
      ] = await Promise.all([
        Order.countDocuments({ storeId: branchId, status: "Cancel_Pending" }),
        Order.countDocuments({ storeId: branchId, status: "Pending" }),
        Order.countDocuments({ storeId: branchId, status: "Confirmed" }),
        Order.countDocuments({ storeId: branchId, status: "Processing" }),
        Order.countDocuments({ storeId: branchId, status: "Delivered" }),
        Order.countDocuments({ storeId: branchId, status: "Cancelled" }),
        Order.countDocuments({ storeId: branchId, paymentStatus: "Unpaid" }),
        (async () => {
          const now = new Date();
          const startOfToday = new Date(now.setHours(0, 0, 0, 0));
          const endOfToday = new Date(now.setHours(23, 59, 59, 999));
          return await Order.countDocuments({
            storeId: branchId,
            orderDate: { $gte: startOfToday, $lte: endOfToday },
          });
        })(),
        Order.aggregate([
          { $match: { storeId: branchId, paymentStatus: "Paid", status: { $ne: "Cancelled" } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]).then(res => res[0]?.total || 0),
        Order.countDocuments({
          storeId: branchId,
          fulfillmentType: "Pickup",
          status: { $nin: ["Delivered", "Cancelled"] },
          estimatedPickupTime: { $lt: new Date() }
        }),
        Order.countDocuments({
          storeId: branchId,
          fulfillmentType: "Pickup",
          status: { $nin: ["Delivered", "Cancelled"] }
        })
      ]);

      const totalPages = Math.ceil(totalOrders / limit);

      // console.log('\n\norders:\n', formattedOrders)

      return res.status(200).json({
        success: true,
        data: {
          orders: formattedOrders,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalOrders,
            limit: parseInt(limit),
            hasNext: parseInt(page) < totalPages,
            hasPrev: parseInt(page) > 1,
          },
          stats: {
            totalOrders,
            cancelPendingOrders,
            pendingOrders,
            confirmedOrders,
            processingOrders,
            deliveredOrders,
            cancelledOrders,
            unpaidOrders,
            todayOrders,
            totalRevenue,
            delayedPickups,
            pendingPickups,
          },
        },
      });
    } catch (err) {
      console.error("Error in getOrderByFilter:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR",
      });
    }
  },
  updateOrderStatus: async (req, res) => {
    try {
      const { id } = req.params;
      let { status, paymentStatus, assignedTo } = req.body;

      // Validate required 'status'
      const validStatuses = ['Pending', 'Placed', 'Confirmed', 'Processing', 'Delivered', 'Cancelled', 'Cancel_Pending'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid or missing status value",
          code: "INVALID_STATUS"
        });
      }

      // If delivered, override paymentStatus as 'Paid'
      if (status === 'Delivered') {
        paymentStatus = 'Paid';
      }

      const updateFields = {
        status,
        updatedAt: new Date()
      };

      // Optional: Validate & assign paymentStatus
      if (paymentStatus) {
        const validPaymentStatuses = ['Paid', 'Unpaid', 'Failed'];
        if (!validPaymentStatuses.includes(paymentStatus)) {
          return res.status(400).json({
            success: false,
            message: "Invalid paymentStatus value",
            code: "INVALID_PAYMENT_STATUS"
          });
        }
        updateFields.paymentStatus = paymentStatus;
      }

      // Optional: Assign delivery person
      // if (assignedTo) {
      //   updateFields.assignedTo = assignedTo;
      // }

      const updatedOrder = await Order.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true }
      ).select("_id status paymentStatus updatedAt");

      if (!updatedOrder) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
          code: "ORDER_NOT_FOUND"
        });
      }

      // Fetch full order for notification (asynchronously)
      Order.findById(id).then(fullOrder => {
        if (fullOrder) sendOrderStatusNotification(fullOrder);
      }).catch(err => console.error("Error fetching order for notification:", err));

      return res.status(200).json({
        success: true,
        message: "Order status updated successfully",
        data: {
          order: updatedOrder
        }
      });

    } catch (err) {
      console.error("Error in updateOrderStatus:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR"
      });
    }
  },
  bulkUpdateOrderStatus: async (req, res) => {
    try {
      const { orderIds, updates } = req.body;

      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Order IDs are required as a non-empty array",
          code: "MISSING_ORDER_IDS"
        });
      }

      if (!updates || typeof updates !== "object" || !updates.status) {
        return res.status(400).json({
          success: false,
          message: "Status is required in updates",
          code: "MISSING_STATUS"
        });
      }

      const validStatuses = ['Pending', 'Placed', 'Confirmed', 'Processing', 'Delivered', 'Cancelled', 'Cancel_Pending'];
      const validPaymentStatuses = ['Paid', 'Unpaid', 'Failed'];

      if (!validStatuses.includes(updates.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status value",
          code: "INVALID_STATUS"
        });
      }

      const updateFields = {
        status: updates.status,
        updatedAt: new Date()
      };

      // Auto-update paymentStatus if status is 'Delivered'
      if (updates.status === 'Delivered') {
        updateFields.paymentStatus = 'Paid';
      } else if (updates.paymentStatus) {
        if (!validPaymentStatuses.includes(updates.paymentStatus)) {
          return res.status(400).json({
            success: false,
            message: "Invalid payment status value",
            code: "INVALID_PAYMENT_STATUS"
          });
        }
        updateFields.paymentStatus = updates.paymentStatus;
      }

      // Optional assignedTo field
      if (updates.assignedTo) {
        updateFields.assignedTo = updates.assignedTo;
      }

      const targetStatus = (updates.status || '').trim();
      const isCancellation = targetStatus === 'Cancelled' || targetStatus === 'Cancel_Pending';
      const totalSelected = (orderIds || []).length;
      let skippedCount = 0;
      let ordersToUpdate;

      console.log(`[BULK UPDATE] Target Status: "${targetStatus}", IsCancellation: ${isCancellation}, IDs Count: ${totalSelected}`);

      if (isCancellation) {
        // For cancellation, strictly fetch those that are NOT Paid
        // We use a broader nin to catch variants just in case
        ordersToUpdate = await Order.find({
          _id: { $in: orderIds },
          paymentStatus: { $nin: ['Paid', 'paid', 'PAID', 'Success', 'success', 'SUCCESS'] }
        });
        skippedCount = totalSelected - ordersToUpdate.length;

        if (skippedCount > 0) {
          // Log which ones were skipped for debugging
          const skippedOrders = await Order.find({
            _id: { $in: orderIds },
            paymentStatus: { $in: ['Paid', 'paid', 'PAID', 'Success', 'success', 'SUCCESS'] }
          }).select('orderId paymentStatus');
          console.log(`[BULK UPDATE] SKIPPED ${skippedCount} orders:`, skippedOrders.map(o => `${o.orderId}(${o.paymentStatus})`).join(', '));
        }
      } else {
        // For other status updates, fetch all selected orders
        ordersToUpdate = await Order.find({
          _id: { $in: orderIds }
        });
      }

      console.log(`[BULK UPDATE] Target Status: ${updates.status}, Selected: ${totalSelected}, ToUpdate: ${ordersToUpdate.length}, Skipped: ${skippedCount}`);

      if (ordersToUpdate.length === 0) {
        return res.status(200).json({
          success: true,
          message: skippedCount > 0 
            ? `All selected orders (${skippedCount}) were skipped as they are already Paid and require manual refund.` 
            : "No eligible orders were found for bulk update.",
          data: {
            updatedCount: 0,
            skippedCount: skippedCount,
            orders: []
          }
        });
      }

      // Step 2: Perform Bulk Write
      const bulkOps = ordersToUpdate.map(order => ({
        updateOne: {
          filter: { _id: order._id },
          update: { $set: updateFields }
        }
      }));

      await Order.bulkWrite(bulkOps);

      const refreshedOrderIds = ordersToUpdate.map(o => o._id);
      const refreshedOrders = await Order.find({ _id: { $in: refreshedOrderIds } }).select("_id status paymentStatus updatedAt");

      // Send notifications for all updated orders
      ordersToUpdate.forEach(order => {
        // Update the status in memory to match the new status
        order.status = updates.status; 
        sendOrderStatusNotification(order);
      });

      let responseMessage = `${refreshedOrders.length} orders updated successfully.`;
      if (skippedCount > 0) {
        responseMessage += ` ${skippedCount} paid orders were skipped to avoid refund errors.`;
      }

      return res.status(200).json({
        success: true,
        message: responseMessage,
        data: {
          updatedCount: refreshedOrders.length,
          skippedCount: skippedCount,
          orders: refreshedOrders
        }
      });

    } catch (err) {
      console.error("Error in bulkUpdateOrderStatus:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR"
      });
    }
  },

  processOrderRefund: async (req, res) => {
    try {
      const { id } = req.params;
      const order = await Order.findById(id);

      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      if (order.paymentMethod !== 'Online') {
        return res.status(400).json({ success: false, message: "Only online orders can be refunded automatically." });
      }

      if (order.paymentStatus === 'Refunded') {
        return res.status(400).json({ success: false, message: "Order is already refunded." });
      }

      // Fetch Stripe configuration
      const paymentConfig = await PaymentConfiguration.findOne({});
      if (!paymentConfig || !paymentConfig.stripe.isEnabled || !paymentConfig.stripe.secretKey) {
        return res.status(400).json({ success: false, message: "Stripe is not configured or enabled." });
      }

      const stripeClient = stripe(paymentConfig.stripe.secretKey);
      let paymentIntentId = order.paymentIntentId;

      // Fallback: If paymentIntentId is missing, try to find it via metadata search in Stripe
      if (!paymentIntentId) {
        console.log(`[REFUND] Fallback search for Order: ${order.orderId}`);
        const searchResult = await stripeClient.paymentIntents.search({
          query: `metadata['orderId']:'${order.orderId}'`,
        });

        if (searchResult.data && searchResult.data.length > 0) {
          paymentIntentId = searchResult.data[0].id;
          order.paymentIntentId = paymentIntentId;
          await order.save();
          console.log(`[REFUND] Found paymentIntentId ${paymentIntentId} via fallback search.`);
        } else {
          return res.status(400).json({
            success: false,
            message: "Could not find a valid Stripe transaction for this order. Please refund via Stripe Dashboard manually."
          });
        }
      }

      // Process the refund
      const refund = await stripeClient.refunds.create({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer'
      });

      // Update order status
      order.status = 'Cancelled';
      order.paymentStatus = 'Refunded';
      order.refundId = refund.id;
      order.cancelDate = new Date();
      order.updatedAt = new Date();
      await order.save();

      // Trigger notification
      await sendOrderStatusNotification(order);

      console.log(`[REFUND SUCCESS] Order: ${order.orderId}, Refund ID: ${refund.id}`);

      return res.status(200).json({
        success: true,
        message: `Refund successful for order ${order.orderId}. Status updated to Cancelled.`,
        data: { refundId: refund.id }
      });

    } catch (error) {
      console.error("[REFUND ERROR]:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to process refund."
      });
    }
  },

  exportOrders: async (req, res) => {
    try {
      const { orderIds } = req.body;

      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Order IDs are required as a non-empty array",
          code: "MISSING_ORDER_IDS"
        });
      }

      const orders = await Order.find({ _id: { $in: orderIds } })
        .populate("userId", "name phone email")
        .sort({ orderDate: -1 });

      if (!orders.length) {
        return res.status(404).json({
          success: false,
          message: "No orders found for provided IDs",
          code: "NO_ORDERS"
        });
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Orders");

      // Set column headers
      worksheet.columns = [
        { header: "S.No", key: "sno", width: 8 },
        { header: "Order ID", key: "orderId", width: 25 },
        { header: "Order Date", key: "orderDate", width: 20 },
        { header: "Customer Name", key: "customerName", width: 20 },
        { header: "Phone", key: "phone", width: 15 },
        { header: "Distance (KM)", key: "distance", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "Payment Status", key: "paymentStatus", width: 15 },
        { header: "Total Amount", key: "totalAmount", width: 15 },
        { header: "Type", key: "fulfillmentType", width: 15 },
        { header: "Pickup Time", key: "pickupTime", width: 15 },
        { header: "Address", key: "fullAddress", width: 40 },
        { header: "Items", key: "items", width: 50 }
      ];

      // Apply bold formatting to header row
      worksheet.getRow(1).eachCell(cell => {
        cell.font = { bold: true };
      });

      // Fetch branch coordinates for distance calculation
      const branchIds = [...new Set(orders.map(o => o.storeId))];
      const branches = await Store.find({ _id: { $in: branchIds } }).select("location");
      const branchMap = {};
      branches.forEach(b => {
        if (b.location && b.location.coordinates) {
          branchMap[b._id.toString()] = b.location.coordinates;
        }
      });

      // Add data rows
      orders.forEach((order, index) => {
        const addr = order.address || {};
        const fullAddress = [
          addr.fullName,
          addr.phone,
          addr.building,
          addr.flat,
          addr.street,
          addr.area,
          addr.city,
          addr.address,
          addr.landmark
        ]
          .filter(Boolean)
          .join(", ");

        const items = order.orderItems
          .map(i => `${i.name.en || 'Unknown'} (x${i.qty})`)
          .join("; ");

        // Calculate distance
        let distance = 0;
        if (order.address?.distance) {
          distance = order.address.distance;
        } else if (branchMap[order.storeId] && order.address?.coordinates?.coordinates) {
          const bLoc = branchMap[order.storeId];
          const oLoc = order.address.coordinates.coordinates;
          distance = calculateDistance(
            bLoc[1], bLoc[0], // [lng, lat] -> (lat, lng)
            oLoc[1], oLoc[0]
          );
        }

        worksheet.addRow({
          sno: index + 1,
          orderId: order.orderId,
          orderDate: order.orderDate.toLocaleString(),
          customerName: order.address?.fullName || order.userId?.name || "",
          phone: order.address?.phone || order.userId?.phone || "",
          distance: distance || "0",
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalAmount: order.totalAmount,
          fulfillmentType: order.fulfillmentType || 'Delivery',
          pickupTime: order.pickupTime || '',
          fullAddress,
          items
        });
      });

      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:.]/g, "").slice(0, 15);
      const fileName = `orders-export-${timestamp}.xlsx`;
      const exportsDir = path.join(__dirname, "../public/exports");

      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const filePath = path.join(exportsDir, fileName);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const downloadUrl = `${baseUrl}/exports/${fileName}`;
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      await workbook.xlsx.writeFile(filePath);

      return res.status(200).json({
        success: true,
        data: {
          downloadUrl,
          fileName,
          recordCount: orders.length,
          expiresAt
        }
      });

    } catch (err) {
      console.error("Error in exportOrders:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error while exporting orders",
        code: "EXPORT_ERROR"
      });
    }
  },
  getAllExecutives: async (req, res) => {
    try {
      // Get the selected branch from admin session
      const selectedBranchId = req.session.admin?.selectedBranch;

      if (!selectedBranchId) {
        return res.status(400).json({
          success: false,
          message: "No branch selected"
        });
      }

      // Get current branch details
      const currentBranch = await Store.findById(selectedBranchId)
        .select('_id name address location contactNumber');

      if (!currentBranch) {
        return res.status(404).json({
          success: false,
          message: "Selected branch not found"
        });
      }

      // Get all delivery executives with their branch information
      const allExecutives = await DeliveryExecutive.find({ isActive: true })
        .populate('branches', '_id name')
        .select('name phone email status avatar admin_saved branches')
        .lean();

      // Get today's date range (12:00 AM to 11:59 PM)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Get today's orders count for each executive
      const executiveOrdersToday = await Order.aggregate([
        {
          $match: {
            'deliveryExecutive.assigned': true,
            'deliveryExecutive.assignedTime': {
              $gte: todayStart,
              $lte: todayEnd
            },
            status: { $in: ['Pending', 'Placed', 'Confirmed', 'Processing', 'Delivered'] }
          }
        },
        {
          $group: {
            _id: '$deliveryExecutive.id',
            todayOrders: { $sum: 1 }
          }
        }
      ]);

      // Get current orders count for each executive (all time)
      const executiveOrdersCount = await Order.aggregate([
        {
          $match: {
            'deliveryExecutive.assigned': true,
            status: { $in: ['Pending', 'Placed', 'Confirmed', 'Processing'] }
          }
        },
        {
          $group: {
            _id: '$deliveryExecutive.id',
            currentOrders: { $sum: 1 }
          }
        }
      ]);

      // Create maps for quick lookup of order counts
      const ordersMap = {};
      executiveOrdersCount.forEach(item => {
        ordersMap[item._id.toString()] = item.currentOrders;
      });

      const todayOrdersMap = {};
      executiveOrdersToday.forEach(item => {
        todayOrdersMap[item._id.toString()] = item.todayOrders;
      });

      // Calculate ratings for each executive (this would need to be implemented based on your rating system)
      // For now, I'll assume you have a rating system in place elsewhere
      const executiveRatings = {}; // This would come from your rating collection

      // Process executives to add order counts, ratings, and isSaved flag
      const processedExecutives = allExecutives.map(exec => {
        const executiveId = exec._id.toString();

        return {
          id: executiveId,
          name: exec.name,
          phone: exec.phone || 'N/A',
          email: exec.email,
          status: exec.status,
          currentOrders: ordersMap[executiveId] || 0,
          todayOrders: todayOrdersMap[executiveId] || 0, // Today's orders count
          rating: executiveRatings[executiveId] || null, // Replace with actual rating logic
          avatar: exec.avatar || 'https://cdn.pixabay.com/photo/2017/11/10/05/48/user-2935527_1280.png',
          isSaved: exec.admin_saved || false,
          branches: exec.branches.map(branch => ({
            _id: branch._id,
            name: branch.name
          }))
        };
      });

      // Separate executives into current branch and other branches
      const currentBranchExecutives = [];
      const otherBranchExecutives = [];

      processedExecutives.forEach(exec => {
        // Check if executive is assigned to the current branch
        const isInCurrentBranch = exec.branches.some(
          branch => branch._id.toString() === selectedBranchId.toString()
        );

        if (isInCurrentBranch) {
          currentBranchExecutives.push(exec);
        } else {
          otherBranchExecutives.push(exec);
        }
      });

      // Return the formatted response
      return res.status(200).json({
        success: true,
        data: {
          currentBranch: {
            _id: currentBranch._id,
            name: currentBranch.name,
            // address: currentBranch.address,
            // contactNumber: currentBranch.contactNumber
          },
          currentBranchExecutives,
          otherBranchExecutives
        }
      });

    } catch (error) {
      console.error("Error fetching executives:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  },
  // getAllExecutives: async (req, res) => {
  //   try {
  //     // Get the selected branch from admin session
  //     const selectedBranchId = req.session.admin?.selectedBranch;

  //     if (!selectedBranchId) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "No branch selected"
  //       });
  //     }

  //     // Get current branch details
  //     const currentBranch = await Store.findById(selectedBranchId)
  //       .select('_id name address location contactNumber');

  //     if (!currentBranch) {
  //       return res.status(404).json({
  //         success: false,
  //         message: "Selected branch not found"
  //       });
  //     }

  //     // Get all delivery executives with their branch information
  //     const allExecutives = await DeliveryExecutive.find({ isActive: true })
  //       .populate('branches', '_id name')
  //       .select('name phone email status avatar admin_saved branches')
  //       .lean();

  //     // Get current orders count for each executive
  //     const executiveOrdersCount = await Order.aggregate([
  //       {
  //         $match: {
  //           'deliveryExecutive.assigned': true,
  //           status: { $in: ['Pending','Placed', 'Confirmed', 'Processing'] }
  //         }
  //       },
  //       {
  //         $group: {
  //           _id: '$deliveryExecutive.id',
  //           currentOrders: { $sum: 1 }
  //         }
  //       }
  //     ]);

  //     // Create a map for quick lookup of order counts
  //     const ordersMap = {};
  //     executiveOrdersCount.forEach(item => {
  //       ordersMap[item._id.toString()] = item.currentOrders;
  //     });

  //     // Calculate ratings for each executive (this would need to be implemented based on your rating system)
  //     // For now, I'll assume you have a rating system in place elsewhere
  //     const executiveRatings = {}; // This would come from your rating collection

  //     // Process executives to add order counts, ratings, and isSaved flag
  //     const processedExecutives = allExecutives.map(exec => {
  //       const executiveId = exec._id.toString();

  //       return {
  //         id: executiveId,
  //         name: exec.name,
  //         phone: exec.phone || 'N/A',
  //         email: exec.email,
  //         status: exec.status,
  //         currentOrders: ordersMap[executiveId] || 0,
  //         rating: executiveRatings[executiveId] || null, // Replace with actual rating logic
  //         avatar: exec.avatar || 'https://cdn.pixabay.com/photo/2017/11/10/05/48/user-2935527_1280.png',
  //         isSaved: exec.admin_saved || false,
  //         branches: exec.branches.map(branch => ({
  //           _id: branch._id,
  //           name: branch.name
  //         }))
  //       };
  //     });

  //     // Separate executives into current branch and other branches
  //     const currentBranchExecutives = [];
  //     const otherBranchExecutives = [];

  //     processedExecutives.forEach(exec => {
  //       // Check if executive is assigned to the current branch
  //       const isInCurrentBranch = exec.branches.some(
  //         branch => branch._id.toString() === selectedBranchId.toString()
  //       );

  //       if (isInCurrentBranch) {
  //         currentBranchExecutives.push(exec);
  //       } else {
  //         otherBranchExecutives.push(exec);
  //       }
  //     });

  //     // Return the formatted response
  //     return res.status(200).json({
  //       success: true,
  //       data: {
  //         currentBranch: {
  //           _id: currentBranch._id,
  //           name: currentBranch.name,
  //           // address: currentBranch.address,
  //           // contactNumber: currentBranch.contactNumber
  //         },
  //         currentBranchExecutives,
  //         otherBranchExecutives
  //       }
  //     });

  //   } catch (error) {
  //     console.error("Error fetching executives:", error);
  //     return res.status(500).json({
  //       success: false,
  //       message: "Internal server error"
  //     });
  //   }
  // },
  saveDeliveryExecutiveByAdmin: async (req, res) => {
    try {
      const { executiveId } = req.params;

      // Validate executiveId
      if (!executiveId) {
        return res.status(400).json({
          success: false,
          message: "Executive ID is required"
        });
      }

      // Check if executive exists
      const executive = await DeliveryExecutive.findById(executiveId);

      if (!executive) {
        return res.status(404).json({
          success: false,
          message: "Delivery executive not found"
        });
      }

      // Toggle the save status
      executive.admin_saved = !executive.admin_saved;

      // Save the changes
      await executive.save();

      // Return success response
      return res.status(200).json({
        success: true,
        message: `Executive ${executive.admin_saved ? 'saved' : 'unsaved'} successfully`,
        data: {
          executiveId: executive._id,
          isSaved: executive.admin_saved
        }
      });

    } catch (error) {
      console.error("Error toggling executive save status:", error);

      // Handle specific error types
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: "Invalid executive ID format"
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  },
  assignDeliveryExecutive: async (req, res) => {
    try {
      const { orderId } = req.params;
      const executiveId = req.body.deliveryExecutiveId;
      console.log("orderId:", orderId, "executiveId:", executiveId);
      // Validate input
      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: "Order ID is required"
        });
      }

      if (!executiveId) {
        return res.status(400).json({
          success: false,
          message: "Delivery executive ID is required"
        });
      }

      // Check if order exists
      const order = await Order.findOne({ _id: orderId });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found"
        });
      }

      // Check if it's a pickup order
      if (order.fulfillmentType === 'Pickup') {
        return res.status(400).json({
          success: false,
          message: "Cannot assign delivery executive to a pickup order"
        });
      }

      // Check if delivery executive exists
      const executive = await DeliveryExecutive.findById(executiveId);

      if (!executive) {
        return res.status(404).json({
          success: false,
          message: "Delivery executive not found"
        });
      }

      // Check if order is already assigned
      // if (order.deliveryExecutive.assigned) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "Order already has a delivery executive assigned"
      //   });
      // }

      // Calculate delivery charge (to be implemented later)
      // const deliveryCharge = calculateDeliveryCharge(order);
      const deliveryCharge = 0; // Placeholder for future implementation

      // Update order with delivery executive information
      order.deliveryExecutive = {
        assigned: true,
        id: executive._id,
        name: executive.name,
        phone: executive.phone,
        email: executive.email,
        deliveryCharge: deliveryCharge,
        assignedTime: new Date() // Add current date and time
      };

      // Update order status to Processing if it was Confirmed
      if (order.status === 'Confirmed') {
        order.status = 'Processing';
      }

      order.updatedAt = new Date();
      // console.log("Updated order:", order);
      // Save the updated order
      await order.save();


      // Return success response
      return res.status(200).json({
        success: true,
        message: "Delivery executive assigned successfully",
        data: {
          orderId: order.orderId,
          deliveryExecutive: {
            id: executive._id,
            name: executive.name,
            assigned: true
          }
        }
      });

    } catch (error) {
      console.error("Error assigning delivery executive:", error);

      // Handle specific error types
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: "Invalid ID format"
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  },

}

module.exports = orderFun;
