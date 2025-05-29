const express = require('express');
const router = express.Router();
const axios = require('axios');
const DataStore = require('../utils/dataStore');
const auth = require('../utils/auth');

// Facebook OAuth login URL
router.get('/facebook', auth.authenticate, (req, res) => {
  const userId = req.user._id;

  // Generate Facebook OAuth URL
  const redirectUri = process.env.REDIRECT_URI;
  const facebookAppId = process.env.FACEBOOK_APP_ID;

  // Enhanced scope to include more permissions for better integration
  const scope = [
    'instagram_basic',
    'instagram_manage_messages',
    'pages_show_list',
    'pages_manage_metadata',
    'pages_messaging',
    'pages_read_engagement',
    'pages_manage_posts',
    'public_profile',
    'email'
  ].join(',');

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${facebookAppId}&redirect_uri=${redirectUri}&state=${userId}&scope=${scope}&display=popup`;

  res.json({ authUrl });
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    // Validate state parameter
    if (!state) {
      console.error('Missing state parameter in OAuth callback');
      return res.redirect('/oauth-error.html');
    }

    const userId = state; // The state parameter contains the user ID

    // Verify that the user exists
    const user = await DataStore.getUserById(userId);
    if (!user) {
      console.error(`User with ID ${userId} not found in OAuth callback`);
      return res.redirect('/oauth-error.html');
    }

    // Validate code parameter
    if (!code) {
      console.error('Missing code parameter in OAuth callback');
      return res.redirect('/oauth-error.html');
    }

    console.log(`Processing OAuth callback for user ${userId} with code: ${code.substring(0, 10)}...`);

    // Exchange code for access token
    console.log('Exchanging code for access token with params:', {
      client_id: process.env.FACEBOOK_APP_ID,
      redirect_uri: process.env.REDIRECT_URI,
      // Don't log the secret or code for security reasons
    });

    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: process.env.REDIRECT_URI,
        code
      }
    });

    console.log('Received token response:', {
      access_token: tokenResponse.data.access_token ? `${tokenResponse.data.access_token.substring(0, 10)}...` : 'undefined',
      expires_in: tokenResponse.data.expires_in
    });

    const { access_token, expires_in } = tokenResponse.data;

    // Get user info with more detailed account information
    console.log('Fetching user info from Facebook Graph API');

    const userResponse = await axios.get('https://graph.facebook.com/me', {
      params: {
        access_token,
        fields: 'id,name,email,accounts{name,access_token,id,instagram_business_account{id,name,username,profile_picture_url}}'
      }
    });

    console.log('Received user info:', {
      id: userResponse.data.id,
      name: userResponse.data.name,
      email: userResponse.data.email,
      hasAccounts: !!userResponse.data.accounts,
      accountsCount: userResponse.data.accounts?.data?.length || 0
    });

    const { id: facebookId, name, email, accounts } = userResponse.data;

    // Process accounts to include Instagram information
    let processedAccounts = [];

    if (accounts && accounts.data) {
      console.log(`Processing ${accounts.data.length} Facebook pages`);

      // For each Facebook page, get more details
      processedAccounts = await Promise.all(accounts.data.map(async (account) => {
        console.log(`Processing Facebook page: ${account.name} (${account.id})`);
        let instagramAccount = null;

        // If the page has an Instagram business account linked
        if (account.instagram_business_account) {
          console.log(`Page ${account.name} has Instagram business account linked: ${account.instagram_business_account.id}`);
          instagramAccount = account.instagram_business_account;

          // Get more Instagram account details if available
          try {
            console.log(`Fetching additional Instagram details for account ${instagramAccount.id}`);
            const instaResponse = await axios.get(`https://graph.facebook.com/${instagramAccount.id}`, {
              params: {
                access_token: account.access_token,
                fields: 'name,username,profile_picture_url,followers_count,media_count'
              }
            });

            if (instaResponse.data) {
              console.log(`Received Instagram details for ${instaResponse.data.username || instaResponse.data.name || instagramAccount.id}`);
              instagramAccount = {
                ...instagramAccount,
                ...instaResponse.data
              };
            }
          } catch (instaError) {
            console.error(`Error fetching Instagram details for account ${instagramAccount.id}:`, instaError.message);
          }
        } else {
          console.log(`Page ${account.name} has no Instagram business account linked`);
        }

        return {
          id: account.id,
          name: account.name,
          accessToken: account.access_token,
          instagramAccount
        };
      }));

      console.log(`Processed ${processedAccounts.length} accounts successfully`);
    } else {
      console.log('No Facebook pages found in the user account');
    }

    // Store tokens
    console.log('Reading existing tokens from database');
    const tokens = await DataStore.readData('tokens.json');
    console.log(`Found ${tokens.length} existing tokens in database`);

    // Check if token already exists for this user
    const existingTokenIndex = tokens.findIndex(t => t.userId === userId);
    console.log(`User ${userId} token exists: ${existingTokenIndex !== -1}`);

    // Calculate expiry date safely
    let expiryDate;
    try {
      // Make sure expires_in is a valid number and not too large
      // If expires_in is undefined or invalid, default to 60 days (common for Facebook long-lived tokens)
      const expiresInSeconds = parseInt(expires_in) || (60 * 24 * 60 * 60); // 60 days in seconds
      console.log(`Using expires_in value: ${expiresInSeconds} seconds (${expiresInSeconds / 86400} days)`);

      // Limit to a reasonable maximum (e.g., 90 days in seconds)
      const maxExpirySeconds = 90 * 24 * 60 * 60; // 90 days
      const safeExpirySeconds = Math.min(expiresInSeconds, maxExpirySeconds);
      expiryDate = new Date(Date.now() + safeExpirySeconds * 1000);
      console.log(`Calculated expiry date: ${expiryDate.toISOString()} (${safeExpirySeconds / 86400} days from now)`);
    } catch (dateError) {
      console.error('Error calculating expiry date:', dateError);
      // Default to 60 days if there's an error (common for Facebook long-lived tokens)
      expiryDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      console.log(`Using default expiry date: ${expiryDate.toISOString()} (60 days from now)`);
    }

    const tokenData = {
      userId,
      facebookId,
      name,
      email,
      accessToken: access_token,
      expiresAt: expiryDate.toISOString(),
      accounts: processedAccounts,
      connectedAt: new Date().toISOString()
    };

    if (existingTokenIndex !== -1) {
      console.log(`Updating existing token for user ${userId}`);
      tokens[existingTokenIndex] = tokenData;
    } else {
      console.log(`Adding new token for user ${userId}`);
      tokens.push(tokenData);
    }

    console.log('Saving tokens to database');
    const saveResult = await DataStore.writeData('tokens.json', tokens);
    console.log(`Token save result: ${saveResult ? 'success' : 'failed'}`);

    // Redirect to frontend with success message
    console.log('Redirecting to success page');
    res.redirect('/oauth-success.html');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/oauth-error.html');
  }
});

// Get connected accounts
router.get('/accounts', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log(`Getting connected accounts for user ${userId}`);

    const tokens = await DataStore.readData('tokens.json');
    console.log(`Found ${tokens.length} tokens in database`);

    // Find token for this user
    const userToken = tokens.find(t => t.userId === userId);
    console.log(`User token found: ${!!userToken}`);

    if (!userToken) {
      console.log(`No token found for user ${userId}`);
      return res.json({ connected: false });
    }

    // Check if token is expired
    try {
      const expiryDate = new Date(userToken.expiresAt);
      const now = new Date();
      console.log(`Token expiry date: ${expiryDate.toISOString()}, Current date: ${now.toISOString()}`);

      // Add a small buffer (1 second) to account for processing time differences
      const expiryWithBuffer = new Date(expiryDate.getTime() + 1000);

      if (expiryWithBuffer < now) {
        console.log(`Token for user ${userId} is expired`);
        return res.json({
          connected: true,
          expired: true,
          name: userToken.name,
          email: userToken.email
        });
      }

      console.log(`Token for user ${userId} is valid`);
    } catch (dateError) {
      console.error(`Error checking token expiry for user ${userId}:`, dateError);
      // If there's an error with the date, assume the token is valid
      console.log(`Assuming token is valid despite date error`);
    }

    // Format accounts for better display
    console.log(`Formatting ${userToken.accounts.length} accounts for display`);

    const formattedAccounts = userToken.accounts.map(account => {
      const hasInstagram = !!account.instagramAccount;
      console.log(`Formatting account: ${account.name} (${account.id}), has Instagram: ${hasInstagram}`);

      return {
        id: account.id,
        name: account.name,
        type: 'facebook',
        icon: 'fab fa-facebook',
        connected: true,
        instagram: hasInstagram ? {
          id: account.instagramAccount.id,
          name: account.instagramAccount.name || account.instagramAccount.username,
          username: account.instagramAccount.username,
          profilePicture: account.instagramAccount.profile_picture_url,
          followersCount: account.instagramAccount.followers_count,
          mediaCount: account.instagramAccount.media_count,
          connected: true
        } : null
      };
    });

    console.log(`Formatted ${formattedAccounts.length} accounts successfully`);

    // Prepare response data
    const responseData = {
      connected: true,
      expired: false,
      name: userToken.name,
      email: userToken.email,
      facebookId: userToken.facebookId,
      connectedAt: userToken.connectedAt,
      accounts: formattedAccounts,
      rawAccounts: userToken.accounts // Include raw accounts for debugging
    };

    console.log(`Sending response with ${responseData.accounts.length} formatted accounts`);
    console.log('Response data:', JSON.stringify({
      ...responseData,
      rawAccounts: 'omitted for brevity' // Don't log the full raw accounts
    }));

    res.json(responseData);
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Disconnect account
router.delete('/accounts', auth.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const tokens = await DataStore.readData('tokens.json');

    // Filter out token for this user
    const updatedTokens = tokens.filter(t => t.userId !== userId);

    await DataStore.writeData('tokens.json', updatedTokens);

    res.json({ message: 'Account disconnected successfully' });
  } catch (error) {
    console.error('Disconnect account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
