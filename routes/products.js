const express = require('express');
const router = express.Router();
const DataStore = require('../utils/dataStore');
const auth = require('../utils/auth');

// Get all products for a user
router.get('/', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const products = await DataStore.getProducts(userId);
    res.json(products || []);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a new product
router.post('/', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, price, description } = req.body;

    // Validate input
    if (!name || !price) {
      return res.status(400).json({ message: 'Name and price are required' });
    }

    // Create product
    const product = await DataStore.addProduct(userId, {
      name,
      price,
      description: description || ''
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a product
router.put('/:id', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const productId = req.params.id;
    const { name, price, description } = req.body;

    // Validate input
    if (!name && !price && !description) {
      return res.status(400).json({ message: 'At least one field is required' });
    }

    // Update product
    const updatedProduct = await DataStore.updateProduct(userId, productId, {
      ...(name && { name }),
      ...(price && { price }),
      ...(description !== undefined && { description })
    });

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a product
router.delete('/:id', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const productId = req.params.id;

    // Delete product
    await DataStore.deleteProduct(userId, productId);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
