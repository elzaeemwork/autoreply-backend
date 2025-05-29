const { v4: uuidv4 } = require('uuid');
const database = require('../config/database');

// Import models
const User = require('../models/User');
const Token = require('../models/Token');
const Message = require('../models/Message');
const Product = require('../models/Product');
const StoreInfo = require('../models/StoreInfo');
const Order = require('../models/Order');
const ActivationCode = require('../models/ActivationCode');

// Ensure database connection
const ensureConnection = async () => {
  if (!database.isConnected()) {
    await database.connect();
  }
};

class DataStore {
  // Legacy methods for backward compatibility (now deprecated)
  static async readData(fileName) {
    console.warn(`readData(${fileName}) is deprecated. Use specific model methods instead.`);
    await ensureConnection();

    try {
      if (fileName === 'users.json') {
        return await User.find({}).lean();
      } else if (fileName === 'tokens.json') {
        return await Token.find({}).lean();
      } else if (fileName === 'messages.json') {
        return await Message.find({}).lean();
      } else if (fileName === 'activation_codes.json') {
        return await ActivationCode.find({}).lean();
      }
      return [];
    } catch (error) {
      console.error(`Error reading ${fileName}:`, error);
      return [];
    }
  }

  static async writeData(fileName, data) {
    console.warn(`writeData(${fileName}) is deprecated. Use specific model methods instead.`);
    await ensureConnection();

    try {
      if (fileName === 'tokens.json') {
        // For tokens, we need to handle the array differently
        // Clear existing tokens and insert new ones
        await Token.deleteMany({});
        if (data && data.length > 0) {
          await Token.insertMany(data);
        }
        return true;
      }
      return true; // For other files, just return true for backward compatibility
    } catch (error) {
      console.error(`Error writing ${fileName}:`, error);
      return false;
    }
  }

  // User-specific methods
  static async getUsers() {
    await ensureConnection();
    try {
      return await User.find({}).lean();
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  static async getUserById(userId) {
    await ensureConnection();
    try {
      return await User.findOne({ _id: userId }).lean();
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  static async getUserByUsername(username) {
    await ensureConnection();
    try {
      return await User.findOne({ username }).lean();
    } catch (error) {
      console.error('Error getting user by username:', error);
      return null;
    }
  }

  static async createUser(userData) {
    await ensureConnection();
    try {
      const newUser = new User({
        _id: uuidv4(),
        ...userData,
        messageCount: 0,
        freeMessagesRemaining: 50,
        activationCode: null,
        activationExpiry: null
      });
      const savedUser = await newUser.save();
      return savedUser.toObject();
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async updateUser(userId, updates) {
    await ensureConnection();
    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updates,
        { new: true, runValidators: true }
      ).lean();
      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  // Product-specific methods
  static async getProducts(userId) {
    await ensureConnection();
    try {
      return await Product.find({ userId }).lean();
    } catch (error) {
      console.error('Error getting products:', error);
      return [];
    }
  }

  static async addProduct(userId, productData) {
    await ensureConnection();
    try {
      const newProduct = new Product({
        _id: uuidv4(),
        userId,
        ...productData
      });
      const savedProduct = await newProduct.save();
      return savedProduct.toObject();
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }

  static async updateProduct(userId, productId, updates) {
    await ensureConnection();
    try {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: productId, userId },
        updates,
        { new: true, runValidators: true }
      ).lean();
      return updatedProduct;
    } catch (error) {
      console.error('Error updating product:', error);
      return null;
    }
  }

  static async deleteProduct(userId, productId) {
    await ensureConnection();
    try {
      await Product.findOneAndDelete({ _id: productId, userId });
      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      return false;
    }
  }

  // Message-specific methods
  static async getMessages(userId) {
    await ensureConnection();
    try {
      return await Message.find({ userId }).lean();
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  static async getRecentMessages(userId, count = 5) {
    await ensureConnection();
    try {
      return await Message.find({ userId })
        .sort({ createdAt: -1 })
        .limit(count)
        .lean();
    } catch (error) {
      console.error('Error getting recent messages:', error);
      return [];
    }
  }

  static async getConversationHistory(userId, count = 5) {
    await ensureConnection();
    try {
      const messages = await Message.find({ userId })
        .sort({ createdAt: -1 })
        .limit(count * 2)
        .lean();

      // Return in chronological order (oldest first)
      return messages.reverse();
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  static async addMessage(messageData) {
    await ensureConnection();
    try {
      const newMessage = new Message(messageData);
      const savedMessage = await newMessage.save();
      return savedMessage.toObject();
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  // Store information methods
  static async getStoreInfo(userId) {
    await ensureConnection();
    try {
      let storeInfo = await StoreInfo.findOne({ userId }).lean();

      if (!storeInfo) {
        // Create default store info
        const defaultStoreInfo = new StoreInfo({
          userId,
          name: '',
          address: '',
          description: ''
        });
        storeInfo = await defaultStoreInfo.save();
        return storeInfo.toObject();
      }

      return storeInfo;
    } catch (error) {
      console.error(`Error reading store info for user ${userId}:`, error);
      return {
        userId,
        name: '',
        address: '',
        description: ''
      };
    }
  }

  static async updateStoreInfo(userId, storeInfo) {
    await ensureConnection();
    try {
      const updatedInfo = await StoreInfo.findOneAndUpdate(
        { userId },
        { ...storeInfo, userId },
        { new: true, upsert: true, runValidators: true }
      ).lean();

      return updatedInfo;
    } catch (error) {
      console.error(`Error updating store info for user ${userId}:`, error);
      throw error;
    }
  }

  // Orders methods
  static async getOrders(userId) {
    await ensureConnection();
    try {
      return await Order.find({ userId }).sort({ createdAt: -1 }).lean();
    } catch (error) {
      console.error(`Error reading orders for user ${userId}:`, error);
      return [];
    }
  }

  static async addOrder(userId, orderData) {
    await ensureConnection();
    try {
      const newOrder = new Order({
        _id: uuidv4(),
        userId,
        ...orderData,
        status: orderData.status || 'pending'
      });
      const savedOrder = await newOrder.save();
      return savedOrder.toObject();
    } catch (error) {
      console.error(`Error adding order for user ${userId}:`, error);
      throw error;
    }
  }

  static async updateOrderStatus(userId, orderId, status) {
    await ensureConnection();
    try {
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, userId },
        { status },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedOrder) {
        throw new Error('Order not found');
      }

      return updatedOrder;
    } catch (error) {
      console.error(`Error updating order status for user ${userId}:`, error);
      throw error;
    }
  }

  static async updateOrder(userId, orderId, updates) {
    await ensureConnection();
    try {
      // Remove any undefined or null values
      const cleanUpdates = {};
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined && updates[key] !== null) {
          cleanUpdates[key] = updates[key];
        }
      });

      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, userId },
        cleanUpdates,
        { new: true, runValidators: true }
      ).lean();

      if (!updatedOrder) {
        throw new Error('Order not found');
      }

      return updatedOrder;
    } catch (error) {
      console.error(`Error updating order for user ${userId}:`, error);
      throw error;
    }
  }

  static async deleteOrder(userId, orderId) {
    await ensureConnection();
    try {
      const deletedOrder = await Order.findOneAndDelete({ _id: orderId, userId });

      if (!deletedOrder) {
        throw new Error('Order not found');
      }

      return { success: true };
    } catch (error) {
      console.error(`Error deleting order for user ${userId}:`, error);
      throw error;
    }
  }

  // Activation code methods
  static async getActivationCodes() {
    await ensureConnection();
    try {
      return await ActivationCode.find({}).lean();
    } catch (error) {
      console.error('Error getting activation codes:', error);
      return [];
    }
  }

  static async createActivationCode(codeData) {
    await ensureConnection();
    try {
      const newCode = new ActivationCode({
        code: uuidv4().substring(0, 8).toUpperCase(),
        ...codeData,
        used: false
      });
      const savedCode = await newCode.save();
      return savedCode.toObject();
    } catch (error) {
      console.error('Error creating activation code:', error);
      throw error;
    }
  }

  static async useActivationCode(code, userId) {
    await ensureConnection();
    try {
      const updatedCode = await ActivationCode.findOneAndUpdate(
        { code, used: false },
        {
          used: true,
          usedBy: userId,
          usedAt: new Date()
        },
        { new: true }
      ).lean();

      return updatedCode;
    } catch (error) {
      console.error('Error using activation code:', error);
      return null;
    }
  }

  static async validateActivationCode(code) {
    await ensureConnection();
    try {
      return await ActivationCode.findOne({ code, used: false }).lean();
    } catch (error) {
      console.error('Error validating activation code:', error);
      return null;
    }
  }
}

module.exports = DataStore;
