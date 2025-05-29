const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const DataStore = require('./dataStore');

// Secret key for JWT
const JWT_SECRET = process.env.SESSION_SECRET || 'social-media-automation-secret';

// Authentication utilities
const auth = {
  // Generate JWT token
  generateToken(user) {
    return jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  },

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  },

  // Hash password
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  },

  // Compare password with hash
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  },

  // Authentication middleware
  async authenticate(req, res, next) {
    try {
      // Get token from header
      const token = req.header('x-auth-token');

      // Check if token exists
      if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
      }

      // Verify token
      const decoded = auth.verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ message: 'Token is not valid' });
      }

      // Get user from database
      const user = await DataStore.getUserById(decoded.id);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Set user in request
      req.user = user;
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Admin authentication middleware
  adminAuth(req, res, next) {
    const { username, password } = req.body;

    // Check admin credentials
    if (
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    ) {
      // Set admin session
      req.session.isAdmin = true;
      next();
    } else {
      res.status(401).json({ message: 'Invalid admin credentials' });
    }
  },

  // Check admin session middleware
  checkAdminSession(req, res, next) {
    if (req.session.isAdmin) {
      next();
    } else {
      res.status(401).json({ message: 'Admin access required' });
    }
  },

  // Check message quota middleware
  async checkMessageQuota(req, res, next) {
    try {
      const user = req.user;

      // Check if user has free messages remaining
      if (user.freeMessagesRemaining > 0) {
        // Decrement free messages
        await DataStore.updateUser(user._id, {
          freeMessagesRemaining: user.freeMessagesRemaining - 1,
          messageCount: user.messageCount + 1
        });
        next();
        return;
      }

      // Check if user has an active subscription
      const now = new Date();
      if (user.activationExpiry && new Date(user.activationExpiry) > now) {
        // Increment message count
        await DataStore.updateUser(user._id, {
          messageCount: user.messageCount + 1
        });
        next();
        return;
      }

      // No quota available
      res.status(403).json({
        message: 'Message quota exceeded',
        requiresActivation: true
      });
    } catch (error) {
      console.error('Error checking message quota:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = auth;
