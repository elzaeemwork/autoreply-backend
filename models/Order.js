const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: String,
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  productId: {
    type: String,
    required: false
  },
  productName: {
    type: String,
    required: false
  },
  quantity: {
    type: Number,
    required: false,
    min: 1,
    default: 1
  },
  customerName: {
    type: String,
    required: false
  },
  customerPhone: {
    type: String,
    required: false
  },
  customerAddress: {
    type: String,
    required: false
  },
  items: [orderItemSchema],
  totalAmount: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  notes: {
    type: String,
    default: ''
  },
  source: {
    type: String,
    enum: ['chat', 'manual', 'api', 'test'],
    default: 'manual'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online'],
    default: 'cash'
  }
}, {
  timestamps: true
});

// Index for efficient queries
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);
