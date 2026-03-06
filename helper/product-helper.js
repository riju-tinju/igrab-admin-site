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

const productFun = {
  getProductByFilter: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || "";
      const filter = req.query.filter || "all";
      const sortField = req.query.sortField || "createdAt";
      const sortDirection = req.query.sortDirection === "asc" ? 1 : -1;

      const branchId = req.session.admin?.selectedBranch;
      // console.log("Selected Branch ID:", branchId);
      if (!branchId) {
        // Check if any branches exist at all
        const anyBranch = await Store.findOne({});
        if (!anyBranch) {
          // Zero state: No branches exist yet. Return empty list.
          return res.status(200).json({
            success: true,
            data: {
              products: [],
              pagination: { currentPage: page, totalPages: 0, totalProducts: 0, hasNext: false, hasPrev: false },
              stats: { totalProducts: 0, publishedProducts: 0, lowStockProducts: 0, outOfStockProducts: 0 }
            }
          });
        }
        return res.status(400).json({
          success: false,
          message: "Branch not selected",
          code: "NO_BRANCH_SELECTED",
        });
      }

      const matchStage = {
        'name.en': { $regex: search, $options: "i" },
        branchIds: { $in: [new ObjectId(branchId)] },
      };

      // Project relevant stock from inventory
      const inventoryData = await Inventory.find({ branchId: branchId });
      const productStockMap = {};
      inventoryData.forEach((inv) => {
        productStockMap[inv.productId.toString()] = inv.stock;
      });

      let products = await Product.find(matchStage)
        .populate("categoryId brandId")
        .lean();

      // Attach stock
      products = products.map((product) => {
        const stock = productStockMap[product._id.toString()] || 0;
        return {
          _id: product._id,
          name: product.name.en,
          category: product.categoryId?.name?.en || "Uncategorized",
          price: product.pricing?.price || 0,
          stock: stock,
          totalOrders: product.sales?.totalOrders || 0,
          brand: product.brandId?.name || "No Brand",
          status: product.status?.isPublished ? "published" : "unpublished",
          image: product.images?.[0] || "",
          createdAt: product.createdAt,
        };
      });

      // Apply filters
      if (filter === "out-of-stock") {
        products = products.filter((p) => p.stock === 0);
      } else if (filter === "top-selling") {
        products = products.sort((a, b) => b.totalOrders - a.totalOrders);
      } else if (filter === "low-stock") {
        products = products.filter((p) => p.stock <= 20 && p.stock >= 0);
      } else if (filter === "recently-added") {
        products = products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      // Sort
      if (["price", "totalOrders", "createdAt"].includes(sortField)) {
        products.sort((a, b) => {
          if (sortDirection === 1) return a[sortField] - b[sortField];
          else return b[sortField] - a[sortField];
        });
      }

      const totalProducts = products.length;
      const totalPages = Math.ceil(totalProducts / limit);
      const paginatedProducts = products.slice((page - 1) * limit, page * limit);

      const stats = {
        totalProducts,
        publishedProducts: products.filter((p) => p.status === "published").length,
        lowStockProducts: products.filter((p) => p.stock <= 10 && p.stock > 0).length,
        outOfStockProducts: products.filter((p) => p.stock === 0).length,
      };

      return res.status(200).json({
        success: true,
        data: {
          products: paginatedProducts,
          pagination: {
            currentPage: page,
            totalPages,
            totalProducts,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          stats,
        },
      });
    } catch (err) {
      console.error("Error in getProductByFilter:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR",
      });
    }
  },
  deleteProduct: async (req, res) => {
    try {
      const productId = req.params.id;
      if (!ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID",
          code: "INVALID_PRODUCT_ID",
        });
      }

      // Check if product exists
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
          code: "PRODUCT_NOT_FOUND",
        });
      }

      // Delete product
      await Product.deleteOne({ _id: productId });

      // Also delete related inventory, reviews, and orders
      //   await Inventory.deleteMany({ productId: new ObjectId(productId) });
      //   await Reviews.deleteMany({ productId: new ObjectId(productId) });
      //   await Order.deleteMany({ "items.productId": new ObjectId(productId) });

      return res.status(200).json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (err) {
      console.error("Error in deleteProduct:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "SERVER_ERROR",
      });
    }
  },
  setStockToProduct: async (req, res) => {
    try {
      const { id } = req.params; // productId
      const { stock } = req.body;
      const branchId = req.session.admin?.selectedBranch;

      // Validation
      if (!branchId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BRANCH_NOT_SELECTED',
            message: 'Branch must be selected to update stock'
          }
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PRODUCT_ID',
            message: 'Invalid product ID'
          }
        });
      }

      if (!Number.isInteger(stock) || stock < 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STOCK_VALUE',
            message: 'Stock must be a positive integer',
            field: 'stock'
          }
        });
      }

      // Check if the product exists
      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found'
          }
        });
      }

      // Update or create inventory record for this product and branch
      const inventory = await Inventory.findOneAndUpdate(
        { productId: id, branchId },
        { stock, updatedAt: new Date() },
        { upsert: true, new: true }
      );

      return res.status(200).json({
        success: true,
        message: 'Stock updated successfully',
        data: {
          productId: id,
          branchId,
          stock: inventory.stock
        }
      });

    } catch (error) {
      console.error('Error updating stock:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update stock'
        }
      });
    }
  },
  getDataForCreateProduct: async (req, res) => {
    const data = {
      categories: [],
      brands: [],
      stores: [],
    }
    try {
      // Fetch categories
      const categories = await Category.find({}) || [];

      // Fetch brands
      const brands = await Brand.find({}) || [];

      // Fetch stores
      const stores = await Store.find({ isActive: true }) || [];

      data.categories = categories
      data.brands = brands
      data.stores = stores
      return data;
    } catch (err) {
      return data
    }
  },
  createProduct: async (req, res) => {
    try {
      const productData = req.body;

      // Validate required fields
      if (!productData.name?.en || !productData.name?.ar) {
        return res.status(400).json({
          success: false,
          error: { message: 'Product name in both languages is required' }
        });
      }

      // Create product in database
      const product = new Product(productData);
      let savedProduct = await product.save();
      if (!savedProduct) {
        return res.status(500).json({
          success: false,
          error: { message: 'Failed to create product' }
        });
      }
      return res.json({
        success: true,
        data: { savedProduct },
        message: 'Product created successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: error.message }
      });
    }
  },
  createCategory: async (req, res, imageName) => {
    try {
      // console.log("Creating category with data:", req.body);
      const categoryData = req.body;
      categoryData.image = imageName || null; // Set image if provided
      const category = new Category(categoryData);
      await category.save();

      res.json({
        success: true,
        data: { category }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: error.message }
      });
    }
  },
  createBrand: async (req, res, imageName) => {
    try {
      const brandData = req.body;
      brandData.logo = imageName || null; // Set logo if provided
      const brand = new Brand(brandData);
      await brand.save();

      res.json({
        success: true,
        data: { brand }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: error.message }
      });
    }
  },
  getProductById: async (productId) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return null;
      }
      return await Product.findById(productId).lean();
    } catch (error) {
      console.error('Error in getProductById:', error);
      return null;
    }
  },
  editProduct: async (req, res) => {
    let { productData, productId } = req.body;
    try {
      // Update product data (no status fields)
      productData.updatedAt = new Date();

      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        productData,
        { new: true, runValidators: true }
      );
      if (!updatedProduct) {
        return res.status(404).json({
          success: false,
          error: { message: 'Product not found' }
        });
      }
      res.json({
        success: true,
        data: { product: updatedProduct },
        message: 'Product updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: error.message }
      });
    }


  }


}

module.exports = productFun;
