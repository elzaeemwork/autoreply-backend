const express = require('express');
const router = express.Router();
const DataStore = require('../utils/dataStore');
const auth = require('../utils/auth');
const gemini = require('../utils/gemini');

// Helper function to parse customer information from text
function parseCustomerInfo(customerInfoText) {
  const customerData = {
    name: '',
    phone: '',
    address: ''
  };

  if (!customerInfoText) return customerData;



  // Split the text by common separators
  const parts = customerInfoText.split(/[،,\n]/);

  // Extract name (look for patterns like "اسمي أحمد" or "أحمد محمد")
  const namePatterns = [
    /اسمي\s+([^،,\n]+)/i,
    /الاسم\s*:?\s*([^،,\n]+)/i,
    /^([^،,\n0-9]+?)(?:\s*[،,]|\s*رقم|\s*هاتف|\s*عنوان|$)/i
  ];

  for (const pattern of namePatterns) {
    const nameMatch = customerInfoText.match(pattern);
    if (nameMatch && nameMatch[1]) {
      customerData.name = nameMatch[1].trim();

      break;
    }
  }

  // If no name found with patterns, try to get the first non-phone, non-address part
  if (!customerData.name) {
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (trimmedPart &&
          !trimmedPart.match(/07\d{8,9}/) &&
          !trimmedPart.match(/(بغداد|البصرة|أربيل|موصل|نجف|كربلاء|ديالى|الأنبار|واسط|ذي قار|ميسان|المثنى|القادسية|صلاح الدين|كركوك)/i)) {
        customerData.name = trimmedPart;

        break;
      }
    }
  }

  // Extract phone number (look for Iraqi phone patterns)
  const phonePatterns = [
    /رقمي?\s*:?\s*(07\d{8,9})/i,
    /هاتفي?\s*:?\s*(07\d{8,9})/i,
    /رقم\s*الهاتف\s*:?\s*(07\d{8,9})/i,
    /(07\d{8,9})/i,
    /(\+964\s*7\d{8,9})/i
  ];

  for (const pattern of phonePatterns) {
    const phoneMatch = customerInfoText.match(pattern);
    if (phoneMatch && phoneMatch[1]) {
      customerData.phone = phoneMatch[1].trim();

      break;
    }
  }

  // Extract address (look for patterns like "عنواني بغداد" or "بغداد الكرادة")
  const addressPatterns = [
    /عنواني\s+([^،,\n]+)/i,
    /العنوان\s*:?\s*([^،,\n]+)/i,
    /أسكن\s+في\s+([^،,\n]+)/i,
    /من\s+([^،,\n]+)/i,
    /في\s+([^،,\n]+)/i
  ];

  for (const pattern of addressPatterns) {
    const addressMatch = customerInfoText.match(pattern);
    if (addressMatch && addressMatch[1]) {
      customerData.address = addressMatch[1].trim();

      break;
    }
  }

  // If no specific address patterns found, look for Iraqi cities/provinces
  if (!customerData.address) {
    const cityPatterns = [
      /(بغداد[^،,\n]*)/i,
      /(البصرة[^،,\n]*)/i,
      /(أربيل[^،,\n]*)/i,
      /(موصل[^،,\n]*)/i,
      /(نجف[^،,\n]*)/i,
      /(كربلاء[^،,\n]*)/i,
      /(ديالى[^،,\n]*)/i,
      /(الأنبار[^،,\n]*)/i,
      /(واسط[^،,\n]*)/i,
      /(ذي قار[^،,\n]*)/i,
      /(ميسان[^،,\n]*)/i,
      /(المثنى[^،,\n]*)/i,
      /(القادسية[^،,\n]*)/i,
      /(صلاح الدين[^،,\n]*)/i,
      /(كركوك[^،,\n]*)/i
    ];

    for (const pattern of cityPatterns) {
      const addressMatch = customerInfoText.match(pattern);
      if (addressMatch && addressMatch[1]) {
        customerData.address = addressMatch[1].trim();

        break;
      }
    }
  }

  // If still no address, try to find any remaining part that's not name or phone
  if (!customerData.address) {
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (trimmedPart &&
          trimmedPart !== customerData.name &&
          !trimmedPart.match(/07\d{8,9}/) &&
          trimmedPart.length > 3) {
        customerData.address = trimmedPart;

        break;
      }
    }
  }


  return customerData;
}

// Helper function to calculate total amount
function calculateTotalAmount(priceString, quantity) {
  if (!priceString || !quantity) return '0';

  // Extract numeric value from price string (e.g., "1200 دولار" -> 1200)
  const numericMatch = priceString.match(/(\d+(?:\.\d+)?)/);
  if (numericMatch) {
    const price = parseFloat(numericMatch[1]);
    const total = price * quantity;
    return total.toString();
  }

  return '0';
}

// Test Gemini API connection
router.get('/test-gemini', async (req, res) => {
  try {
    const result = await gemini.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Test Gemini API error:', error);
    res.status(500).json({
      message: 'Error testing Gemini API connection',
      error: error.message
    });
  }
});

// Debug Gemini API
router.get('/debug-gemini', async (req, res) => {
  try {
    // Log API key (masked for security)
    const apiKey = process.env.GEMINI_API_KEY;
    const maskedKey = apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}` : 'Not set';
    console.log('Using Gemini API Key:', maskedKey);

    // Test with a simple prompt
    const simplePrompt = 'مرحبا، كيف حالك؟';
    console.log('Sending simple prompt to Gemini API:', simplePrompt);

    const response = await gemini.generateResponse(simplePrompt);
    console.log('Received response from Gemini API:', response);

    res.json({
      success: true,
      apiKeyMasked: maskedKey,
      prompt: simplePrompt,
      response: response
    });
  } catch (error) {
    console.error('Debug Gemini API error:', error);

    // Log more detailed error information
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    }

    res.status(500).json({
      message: 'Error debugging Gemini API',
      error: error.message,
      details: error.response ? error.response.data : null
    });
  }
});

// Debug conversation API
router.get('/debug-conversation', async (req, res) => {
  try {
    // Create sample products
    const sampleProducts = [
      {
        id: '1',
        name: 'هاتف آيفون 15 برو',
        price: '1200 دولار',
        description: 'هاتف ذكي من شركة آبل بمواصفات عالية'
      },
      {
        id: '2',
        name: 'سماعة آيربودز برو',
        price: '250 دولار',
        description: 'سماعات لاسلكية من شركة آبل بخاصية إلغاء الضوضاء'
      },
      {
        id: '3',
        name: 'ساعة آبل ووتش سيريس 9',
        price: '400 دولار',
        description: 'ساعة ذكية من شركة آبل بمزايا صحية متقدمة'
      }
    ];

    // Create sample store info for testing
    const sampleStoreInfo = {
      name: 'متجر التكنولوجيا الحديثة',
      address: 'شارع الرشيد، بغداد',
      description: 'متجر متخصص في بيع أحدث المنتجات التكنولوجية بأسعار منافسة',
      updatedAt: new Date().toISOString()
    };

    // Create a sample conversation
    const conversation = [
      {
        type: 'user',
        content: 'مرحبا، كيف حالك؟',
        timestamp: new Date(Date.now() - 5000).toISOString()
      },
      {
        type: 'ai',
        content: 'أنا بخير، شكراً لسؤالك! كيف يمكنني مساعدتك اليوم؟',
        timestamp: new Date(Date.now() - 4000).toISOString()
      },
      {
        type: 'user',
        content: 'هل لديك منتجات للبيع؟',
        timestamp: new Date(Date.now() - 3000).toISOString()
      }
    ];

    console.log('Testing conversation API with sample conversation, products, and store info');

    // Test the conversation API with products and store info
    const response = await gemini.generateConversationResponse(conversation, sampleProducts, sampleStoreInfo);
    console.log('Received response from conversation API:', response);

    res.json({
      success: true,
      conversation: conversation,
      products: sampleProducts,
      storeInfo: sampleStoreInfo,
      response: response
    });
  } catch (error) {
    console.error('Debug conversation API error:', error);

    // Log more detailed error information
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    }

    res.status(500).json({
      message: 'Error debugging conversation API',
      error: error.message,
      details: error.response ? error.response.data : null
    });
  }
});

// Get message history for a user
router.get('/', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const messages = await DataStore.getMessages(userId);
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message and get AI response
router.post('/chat', auth.authenticate, auth.checkMessageQuota, async (req, res) => {
  try {
    const userId = req.user._id;
    const { message, platform } = req.body;

    // Validate input
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Get user's products
    const products = await DataStore.getProducts(userId);

    // Get store information
    const storeInfo = await DataStore.getStoreInfo(userId);
    console.log(`Retrieved store info for user ${userId}:`, JSON.stringify(storeInfo));

    // Get conversation history (last 5 messages)
    const conversationHistory = await DataStore.getConversationHistory(userId, 5);

    console.log(`Processing chat request for user ${userId} with message: "${message}"`);
    console.log(`User has ${products ? products.length : 0} products`);
    console.log(`Retrieved ${conversationHistory.length} previous messages for context`);

    try {
      // Save user message first
      const savedUserMessage = await DataStore.addMessage({
        userId,
        platform: platform || 'test',
        content: message,
        type: 'user'
      });

      // Add the new user message to the conversation history
      const updatedHistory = [...conversationHistory, savedUserMessage];

      // Generate AI response with conversation history
      let aiResponse;

      // Try to use the conversation format first (better for maintaining context)
      try {
        // If we have enough messages for a conversation, use the conversation API
        if (updatedHistory.length >= 2) {
          // Pass products and store info to the conversation API
          aiResponse = await gemini.generateConversationResponse(updatedHistory, products, storeInfo);
        } else {
          // Otherwise fall back to the regular product response with history
          aiResponse = await gemini.generateProductResponse(message, products, conversationHistory, storeInfo);
        }
      } catch (convError) {
        console.error('Conversation API error, falling back to standard API:', convError.message);
        // Fall back to the regular product response with history
        aiResponse = await gemini.generateProductResponse(message, products, conversationHistory, storeInfo);
      }

      // Check if the response contains order information
      let orderInfo = null;
      let orderStatus = null;

      // Check for confirmed order
      const orderInfoMatch = aiResponse.match(/===ORDER_INFO===\s+([\s\S]*?)===END_ORDER===/);

      // Check for pending order
      const orderPendingMatch = aiResponse.match(/===ORDER_PENDING===\s+([\s\S]*?)===END_ORDER===/);

      if (orderInfoMatch && orderInfoMatch[1]) {
        const orderText = orderInfoMatch[1];
        console.log('Confirmed order information detected:', orderText);

        // Extract order details
        const productNameMatch = orderText.match(/PRODUCT_NAME:\s*(.+?)(?:\n|$)/);
        const quantityMatch = orderText.match(/QUANTITY:\s*(\d+)(?:\n|$)/);
        const customerInfoMatch = orderText.match(/CUSTOMER_INFO:\s*(.+?)(?:\n|$)/);
        const notesMatch = orderText.match(/NOTES:\s*(.+?)(?:\n|$)/);
        const statusMatch = orderText.match(/STATUS:\s*(.+?)(?:\n|$)/);

        // Create order object
        if (productNameMatch && productNameMatch[1].trim() && statusMatch && statusMatch[1].trim() === 'CONFIRMED') {
          const productName = productNameMatch[1].trim();
          const quantity = quantityMatch && quantityMatch[1] ? parseInt(quantityMatch[1]) : 1;
          const customerInfoText = customerInfoMatch && customerInfoMatch[1] ? customerInfoMatch[1].trim() : '';
          const notes = notesMatch && notesMatch[1] ? notesMatch[1].trim() : '';

          // Parse customer information
          const customerData = parseCustomerInfo(customerInfoText);

          // Find matching product to get price
          const matchingProduct = products.find(p =>
            p.name.toLowerCase().includes(productName.toLowerCase()) ||
            productName.toLowerCase().includes(p.name.toLowerCase())
          );

          orderInfo = {
            productId: matchingProduct ? matchingProduct._id : 'unknown',
            productName: productName,
            quantity: quantity,
            customerName: customerData.name,
            customerPhone: customerData.phone,
            customerAddress: customerData.address,
            totalAmount: matchingProduct ? calculateTotalAmount(matchingProduct.price, quantity) : '0',
            notes: notes,
            status: 'pending',
            source: 'chat',
            items: [{
              productId: matchingProduct ? matchingProduct._id : 'unknown',
              productName: productName,
              quantity: quantity,
              price: matchingProduct ? matchingProduct.price : '0'
            }]
          };

          // Save order to database
          try {
            const order = await DataStore.addOrder(userId, orderInfo);
            console.log('Order saved successfully:', order._id);
            orderStatus = 'CONFIRMED';

            // Remove order info from response
            aiResponse = aiResponse.replace(/===ORDER_INFO===\s+[\s\S]*?===END_ORDER===/, '').trim();
          } catch (orderError) {
            console.error('Error saving order:', orderError);
          }
        }
      } else if (orderPendingMatch && orderPendingMatch[1]) {
        const orderText = orderPendingMatch[1];
        console.log('Pending order information detected:', orderText);

        // Extract order details
        const productNameMatch = orderText.match(/PRODUCT_NAME:\s*(.+?)(?:\n|$)/);
        const quantityMatch = orderText.match(/QUANTITY:\s*(\d+)(?:\n|$)/);
        const statusMatch = orderText.match(/STATUS:\s*(.+?)(?:\n|$)/);

        if (productNameMatch && productNameMatch[1].trim() && statusMatch && statusMatch[1].trim() === 'WAITING_FOR_INFO') {
          // Store pending order information in session
          orderStatus = 'PENDING';

          // Remove order pending info from response
          aiResponse = aiResponse.replace(/===ORDER_PENDING===\s+[\s\S]*?===END_ORDER===/, '').trim();
        }
      }

      // Save AI response
      const savedResponse = await DataStore.addMessage({
        userId,
        platform: platform || 'test',
        content: aiResponse,
        type: 'ai'
      });

      // Return AI response
      res.json({
        message: savedResponse.content,
        messageId: savedResponse.id,
        timestamp: savedResponse.timestamp,
        orderStatus: orderStatus, // 'CONFIRMED', 'PENDING', or null
        orderCreated: orderInfo ? true : false
      });
    } catch (apiError) {
      console.error('Gemini API error:', apiError);

      // Log detailed error information
      if (apiError.response) {
        console.error('API error response:', apiError.response.data);
        console.error('API error status:', apiError.response.status);
      }

      // Return a more specific error message
      res.status(500).json({
        message: 'خطأ في الاتصال بخدمة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى لاحقاً.',
        error: apiError.message,
        details: apiError.response ? apiError.response.data : null
      });
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      message: 'Error generating response',
      error: error.message
    });
  }
});

// Get message statistics
router.get('/stats', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const messages = await DataStore.getMessages(userId);

    // Calculate statistics
    const totalMessages = messages.length;
    const userMessages = messages.filter(msg => msg.type === 'user').length;
    const aiMessages = messages.filter(msg => msg.type === 'ai').length;

    // Group by platform
    const platformStats = {};
    messages.forEach(msg => {
      if (!platformStats[msg.platform]) {
        platformStats[msg.platform] = 0;
      }
      platformStats[msg.platform]++;
    });

    // Group by date
    const dateStats = {};
    messages.forEach(msg => {
      try {
        // Use createdAt if timestamp is not available or invalid
        const dateValue = msg.timestamp || msg.createdAt;
        if (dateValue) {
          const date = new Date(dateValue).toISOString().split('T')[0];
          if (!dateStats[date]) {
            dateStats[date] = 0;
          }
          dateStats[date]++;
        }
      } catch (error) {
        console.error('Error processing message date:', error);
      }
    });

    res.json({
      totalMessages,
      userMessages,
      aiMessages,
      platformStats,
      dateStats
    });
  } catch (error) {
    console.error('Get message stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
