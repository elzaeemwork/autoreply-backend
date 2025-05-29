const express = require('express');
const router = express.Router();
const DataStore = require('../utils/dataStore');
const auth = require('../utils/auth');

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, name } = req.body;

    // Check if user already exists
    const existingUser = await DataStore.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await auth.hashPassword(password);

    // Create user
    const user = await DataStore.createUser({
      username,
      password: hashedPassword,
      email,
      name,
      freeMessagesRemaining: 50
    });

    // Generate token
    const token = auth.generateToken(user);

    // Return user and token
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        freeMessagesRemaining: user.freeMessagesRemaining,
        messageCount: user.messageCount
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    const user = await DataStore.getUserByUsername(username);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await auth.comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = auth.generateToken(user);

    // Return user and token
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        freeMessagesRemaining: user.freeMessagesRemaining,
        messageCount: user.messageCount,
        activationExpiry: user.activationExpiry
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', auth.authenticate, async (req, res) => {
  try {
    // Return user without password
    const { password, ...user } = req.user;
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Activate user with code
router.post('/activate', auth.authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    // Validate activation code
    const validCode = await DataStore.validateActivationCode(code);
    if (!validCode) {
      return res.status(400).json({ message: 'Invalid or used activation code' });
    }

    // Calculate expiry date
    let expiryDate = new Date();
    if (validCode.type === 'full') {
      // 30 days for full activation
      expiryDate.setDate(expiryDate.getDate() + 30);
    } else {
      // 7 days for temporary activation (50 messages)
      expiryDate.setDate(expiryDate.getDate() + 7);
    }

    // Update user with activation details
    const updatedUser = await DataStore.updateUser(userId, {
      activationCode: code,
      activationExpiry: expiryDate.toISOString(),
      activationType: validCode.type,
      freeMessagesRemaining: validCode.type === 'temp' ? 50 : 0
    });

    // Mark code as used
    await DataStore.useActivationCode(code, userId);

    // Return updated user
    res.json({
      message: 'Account activated successfully',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        name: updatedUser.name,
        freeMessagesRemaining: updatedUser.freeMessagesRemaining,
        messageCount: updatedUser.messageCount,
        activationExpiry: updatedUser.activationExpiry,
        activationType: updatedUser.activationType
      }
    });
  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin login
router.post('/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;

    // Check admin credentials
    if (
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    ) {
      // Set admin session
      req.session.isAdmin = true;
      res.json({ message: 'Admin login successful' });
    } else {
      res.status(401).json({ message: 'Invalid admin credentials' });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin logout
router.post('/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ message: 'Admin logout successful' });
});

module.exports = router;
