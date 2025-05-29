const express = require('express');
const router = express.Router();
const DataStore = require('../utils/dataStore');
const auth = require('../utils/auth');

// Get all orders
router.get('/', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const orders = await DataStore.getOrders(userId);
    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a new order
router.post('/', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      productId,
      productName,
      quantity,
      customerInfo,
      notes,
      totalAmount,
      customerName,
      customerPhone,
      customerAddress,
      source,
      items
    } = req.body;

    // Validate input
    if (!productName) {
      return res.status(400).json({ message: 'Product name is required' });
    }

    // Parse legacy customerInfo if provided
    let finalCustomerName = customerName || '';
    let finalCustomerPhone = customerPhone || '';
    let finalCustomerAddress = customerAddress || '';

    if (customerInfo && typeof customerInfo === 'string' && !customerName && !customerPhone && !customerAddress) {
      // Parse customerInfo string for backward compatibility
      const nameMatch = customerInfo.match(/اسمي?\s*:?\s*([^،,\n]+)/i);
      const phoneMatch = customerInfo.match(/(07\d{8,9})/i);
      const addressMatch = customerInfo.match(/عنواني?\s*:?\s*([^،,\n]+)/i);

      if (nameMatch) finalCustomerName = nameMatch[1].trim();
      if (phoneMatch) finalCustomerPhone = phoneMatch[1].trim();
      if (addressMatch) finalCustomerAddress = addressMatch[1].trim();
    }

    // Create order data
    const orderData = {
      productId: productId || 'unknown',
      productName: productName,
      quantity: parseInt(quantity) || 1,
      customerName: finalCustomerName,
      customerPhone: finalCustomerPhone,
      customerAddress: finalCustomerAddress,
      totalAmount: totalAmount || '0',
      notes: notes || '',
      status: 'pending',
      source: source || 'manual',
      items: items || [{
        productId: productId || 'unknown',
        productName: productName,
        quantity: parseInt(quantity) || 1,
        price: totalAmount || '0'
      }]
    };

    console.log('Creating order with data:', JSON.stringify(orderData, null, 2));

    const order = await DataStore.addOrder(userId, orderData);

    // Return the order with all fields properly populated
    res.status(201).json({
      ...order,
      productName: order.productName || productName,
      quantity: order.quantity || parseInt(quantity) || 1,
      customerName: order.customerName || finalCustomerName,
      customerPhone: order.customerPhone || finalCustomerPhone,
      customerAddress: order.customerAddress || finalCustomerAddress
    });
  } catch (error) {
    console.error('Add order error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// Update order status
router.put('/:orderId/status', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate input
    if (!status || !['pending', 'processing', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Valid status is required' });
    }

    const order = await DataStore.updateOrderStatus(userId, orderId, status);
    res.json(order);
  } catch (error) {
    console.error('Update order status error:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update entire order
router.put('/:orderId', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;
    const updates = req.body;

    // Validate that at least one field is being updated
    const allowedFields = ['productName', 'quantity', 'customerName', 'customerPhone', 'customerAddress', 'totalAmount', 'notes', 'status'];
    const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Validate status if provided
    if (updates.status && !['pending', 'processing', 'completed', 'cancelled'].includes(updates.status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // Parse quantity if provided
    if (updates.quantity) {
      updates.quantity = parseInt(updates.quantity);
    }

    const order = await DataStore.updateOrder(userId, orderId, updates);
    res.json(order);
  } catch (error) {
    console.error('Update order error:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete order
router.delete('/:orderId', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;

    await DataStore.deleteOrder(userId, orderId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete order error:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
