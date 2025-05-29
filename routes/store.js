const express = require('express');
const router = express.Router();
const DataStore = require('../utils/dataStore');
const auth = require('../utils/auth');

// Get store information
router.get('/info', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const storeInfo = await DataStore.getStoreInfo(userId);
    res.json(storeInfo);
  } catch (error) {
    console.error('Get store info error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update store information
router.post('/info', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, address, description } = req.body;

    // Validate input
    if (!name && !address && !description) {
      return res.status(400).json({ message: 'At least one field is required' });
    }

    // Update store info
    const storeInfo = await DataStore.updateStoreInfo(userId, {
      name: name || '',
      address: address || '',
      description: description || ''
    });

    res.json(storeInfo);
  } catch (error) {
    console.error('Update store info error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
