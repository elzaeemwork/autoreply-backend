const express = require('express');
const router = express.Router();
const DataStore = require('../utils/dataStore');
const auth = require('../utils/auth');

// Check if admin is logged in
router.get('/check', (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

// Get all users (admin only)
router.get('/users', auth.checkAdminSession, async (req, res) => {
  try {
    const users = await DataStore.getUsers();

    // Remove sensitive information
    const safeUsers = users.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });

    res.json(safeUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all activation codes (admin only)
router.get('/codes', auth.checkAdminSession, async (req, res) => {
  try {
    const codes = await DataStore.getActivationCodes();
    res.json(codes);
  } catch (error) {
    console.error('Get activation codes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate new activation code (admin only)
router.post('/codes', auth.checkAdminSession, async (req, res) => {
  try {
    const { type, description } = req.body;

    // Validate input
    if (!type || !['full', 'temp'].includes(type)) {
      return res.status(400).json({ message: 'Valid type (full or temp) is required' });
    }

    // Create activation code
    const code = await DataStore.createActivationCode({
      type,
      description: description || `${type === 'full' ? '30 days' : '50 messages'} activation code`
    });

    res.status(201).json(code);
  } catch (error) {
    console.error('Generate activation code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete activation code (admin only)
router.delete('/codes/:code', auth.checkAdminSession, async (req, res) => {
  try {
    const code = req.params.code;
    const codes = await DataStore.getActivationCodes();
    const filteredCodes = codes.filter(c => c.code !== code);

    await DataStore.writeData('activation_codes.json', filteredCodes);
    res.json({ message: 'Activation code deleted' });
  } catch (error) {
    console.error('Delete activation code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get message statistics (admin only)
router.get('/stats', auth.checkAdminSession, async (req, res) => {
  try {
    // Get data from MongoDB instead of JSON files
    const Order = require('../models/Order');
    const Product = require('../models/Product');
    const Message = require('../models/Message');
    const User = require('../models/User');

    // Get counts from database
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalMessages = await Message.countDocuments();
    const totalUsers = await User.countDocuments();

    // Get orders by status
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const processingOrders = await Order.countDocuments({ status: 'processing' });
    const completedOrders = await Order.countDocuments({ status: 'completed' });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });

    // Get recent orders (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentOrders = await Order.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Get orders per day for the last 7 days
    const ordersPerDay = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const count = await Order.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      });

      ordersPerDay[dateStr] = count;
    }

    // Get top products
    const topProducts = await Order.aggregate([
      { $group: { _id: '$productName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      totalOrders,
      totalProducts,
      totalMessages,
      totalUsers,
      pendingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
      recentOrders,
      ordersPerDay,
      topProducts: topProducts.map(p => ({ name: p._id, count: p.count }))
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

module.exports = router;
