const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  storeId: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Pending', 'Placed', 'Confirmed', 'Processing', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Unpaid', 'Failed'],
    default: 'Unpaid'
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Online'],
    required: true
  },
  subTotal: {
    type: Number,
    required: true
  },
  charges: [
    {
      name: String,
      amount: Number
    }
  ],
  discount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  couponCode: {
    type: String,
    default: null
  },
  orderItems: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      name: String,
      image: String,
      qty: Number,
      unitPrice: Number,
      total: Number
    }
  ],
  deliveryExecutive: {
    assigned:{
      type: Boolean,
      default: false
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryExecutive',
      default: null
    },
    name: String,
    phone: String,
    email: String,
    deliveryCharge:Number,
    assignedTime: Date,
    deliveryTime: Date,
  },
  address: {
    fullName: String,
    phone: String,
    building: String,
    flat: String,
    street: String,
    area: String,
    city: String,
    address: String,
    landmark: String,
    notes: String,
    coordinates: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'] // only 'Point' is allowed
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0] // default coordinates
        // required: true
      }
    },
    distance:{
      type: Number,
      default: 0
    },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryBoy',
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create a 2dsphere index if you want to perform geospatial queries
orderSchema.index({ 'address.coordinates': '2dsphere' });

module.exports = mongoose.model('Order', orderSchema);
