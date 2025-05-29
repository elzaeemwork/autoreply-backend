const express = require('express');
const router = express.Router();
const axios = require('axios');
const DataStore = require('../utils/dataStore');
const gemini = require('../utils/gemini');

/**
 * Facebook Webhook Endpoint
 * 
 * This endpoint handles two types of requests:
 * 1. GET: Webhook verification from Facebook (required for setup)
 * 2. POST: Incoming messages from Facebook Messenger
 */

// Webhook verification endpoint (GET)
router.get('/', async (req, res) => {
  try {
    // Parse parameters from the webhook verification request
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Check if a token and mode were sent
    if (mode && token) {
      // Check the mode and token sent are correct
      if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
        // Respond with the challenge token from the request
        console.log('WEBHOOK_VERIFIED');
        return res.status(200).send(challenge);
      } else {
        // Respond with '403 Forbidden' if verify tokens do not match
        console.error('Verification failed. Token mismatch.');
        return res.sendStatus(403);
      }
    } else {
      // Respond with '400 Bad Request' if required parameters are missing
      console.error('Missing required parameters for webhook verification');
      return res.sendStatus(400);
    }
  } catch (error) {
    console.error('Webhook verification error:', error);
    return res.sendStatus(500);
  }
});

// Webhook message handling endpoint (POST)
router.post('/', async (req, res) => {
  try {
    const body = req.body;

    // Check if this is an event from a page subscription
    if (body.object === 'page') {
      // Send a 200 OK response immediately to acknowledge receipt
      // This is important for Facebook to know we received the message
      res.status(200).send('EVENT_RECEIVED');

      // Iterate over each entry - there may be multiple if batched
      for (const entry of body.entry) {
        // Get the page ID for this event
        const pageId = entry.id;
        
        // Find the page token from our stored tokens
        const tokens = await DataStore.readData('tokens.json');
        const pageToken = findPageToken(tokens, pageId);
        
        if (!pageToken) {
          console.error(`No token found for page ID: ${pageId}`);
          continue; // Skip this entry if we don't have a token
        }

        // Find the user ID associated with this page
        const userId = findUserIdForPage(tokens, pageId);
        
        if (!userId) {
          console.error(`No user found for page ID: ${pageId}`);
          continue; // Skip this entry if we don't have a user
        }

        // Get the webhook event
        if (entry.messaging) {
          for (const webhookEvent of entry.messaging) {
            // Process the event
            await handleMessagingEvent(webhookEvent, pageToken, userId, pageId);
          }
        }
      }
    } else {
      // Return a '404 Not Found' if event is not from a page subscription
      console.error('Received webhook event is not from a page subscription');
      return res.sendStatus(404);
    }
  } catch (error) {
    console.error('Webhook handling error:', error);
    // We've already sent a 200 OK response, so we don't need to send another response
  }
});

/**
 * Handle a messaging event from Facebook
 * @param {Object} event - The messaging event from Facebook
 * @param {string} pageToken - The page access token for sending responses
 * @param {string} userId - The user ID in our system
 * @param {string} pageId - The Facebook page ID
 */
async function handleMessagingEvent(event, pageToken, userId, pageId) {
  try {
    // Check if this is a message event
    if (event.message) {
      const senderId = event.sender.id;
      const messageText = event.message.text;
      
      // Log the incoming message
      console.log(`Received message from ${senderId} for page ${pageId}: ${messageText}`);
      
      // Skip if this is a message sent by the page itself
      if (senderId === pageId) {
        console.log('Skipping message sent by the page itself');
        return;
      }
      
      // Skip if there's no text content
      if (!messageText) {
        console.log('Skipping message with no text content');
        return;
      }
      
      // Store the incoming message
      await DataStore.addMessage({
        userId,
        platform: 'facebook',
        content: messageText,
        type: 'user',
        metadata: {
          senderId,
          pageId
        }
      });
      
      // Get user's products
      const products = await DataStore.getProducts(userId);
      
      // Get store information
      const storeInfo = await DataStore.getStoreInfo(userId);
      
      // Get conversation history (last 5 messages)
      const conversationHistory = await DataStore.getConversationHistory(userId, 5);
      
      // Generate AI response
      let aiResponse;
      
      // Try to use the conversation format first (better for maintaining context)
      try {
        // Add the current message to the history for context
        const updatedHistory = [
          ...conversationHistory,
          { role: 'user', content: messageText }
        ];
        
        // If we have enough messages for a conversation, use the conversation API
        if (updatedHistory.length >= 2) {
          // Pass products and store info to the conversation API
          aiResponse = await gemini.generateConversationResponse(updatedHistory, products, storeInfo);
        } else {
          // Otherwise fall back to the regular product response with history
          aiResponse = await gemini.generateProductResponse(messageText, products, conversationHistory, storeInfo);
        }
      } catch (convError) {
        console.error('Conversation API error, falling back to standard API:', convError.message);
        // Fall back to the regular product response with history
        aiResponse = await gemini.generateProductResponse(messageText, products, conversationHistory, storeInfo);
      }
      
      // Store the AI response
      await DataStore.addMessage({
        userId,
        platform: 'facebook',
        content: aiResponse,
        type: 'ai',
        metadata: {
          recipientId: senderId,
          pageId
        }
      });
      
      // Send the response back to Facebook
      await sendFacebookMessage(senderId, aiResponse, pageToken);
    }
  } catch (error) {
    console.error('Error handling messaging event:', error);
  }
}

/**
 * Send a message to Facebook Messenger
 * @param {string} recipientId - The recipient's Facebook ID
 * @param {string} messageText - The message text to send
 * @param {string} pageToken - The page access token
 */
async function sendFacebookMessage(recipientId, messageText, pageToken) {
  try {
    // Prepare the message payload
    const messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        text: messageText
      }
    };
    
    // Send the message
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageToken}`,
      messageData
    );
    
    console.log('Successfully sent message to Facebook:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending message to Facebook:', error);
    if (error.response) {
      console.error('Facebook API error:', error.response.data);
    }
    throw error;
  }
}

/**
 * Find the page token for a given page ID
 * @param {Array} tokens - The tokens array from the database
 * @param {string} pageId - The Facebook page ID
 * @returns {string|null} - The page token or null if not found
 */
function findPageToken(tokens, pageId) {
  for (const token of tokens) {
    if (token.accounts) {
      for (const account of token.accounts) {
        if (account.id === pageId) {
          return account.accessToken;
        }
      }
    }
  }
  return null;
}

/**
 * Find the user ID for a given page ID
 * @param {Array} tokens - The tokens array from the database
 * @param {string} pageId - The Facebook page ID
 * @returns {string|null} - The user ID or null if not found
 */
function findUserIdForPage(tokens, pageId) {
  for (const token of tokens) {
    if (token.accounts) {
      for (const account of token.accounts) {
        if (account.id === pageId) {
          return token.userId;
        }
      }
    }
  }
  return null;
}

module.exports = router;
