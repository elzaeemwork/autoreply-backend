const axios = require('axios');

// Google Gemini API integration
class GeminiAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';
  }

  // Test API key validity
  async testConnection() {
    try {
      const response = await this.generateResponse('مرحبا، هذا اختبار للاتصال!');
      return { success: true, response };
    } catch (error) {
      console.error('Gemini API connection test failed:', error.message);
      return {
        success: false,
        error: error.message,
        status: error.response?.status || 'unknown'
      };
    }
  }

  // Generate response using Google Gemini
  async generateResponse(prompt, maxTokens = 1024) {
    try {
      const url = `${this.baseUrl}?key=${this.apiKey}`;

      console.log('Using Gemini API URL:', this.baseUrl);
      console.log('Using API key ending with:', this.apiKey.substring(this.apiKey.length - 5));

      const data = {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: maxTokens,
          topP: 0.95,
          topK: 40
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      console.log('Sending request to Gemini API with prompt:', prompt.substring(0, 50) + '...');

      // Set timeout to 10 seconds
      const response = await axios.post(url, data, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Received response from Gemini API with status:', response.status);

      console.log('Response data structure:', JSON.stringify(response.data).substring(0, 500) + '...');

      if (response.data &&
          response.data.candidates &&
          response.data.candidates.length > 0 &&
          response.data.candidates[0].content &&
          response.data.candidates[0].content.parts &&
          response.data.candidates[0].content.parts.length > 0) {
        const responseText = response.data.candidates[0].content.parts[0].text;
        console.log('Successfully extracted response text:', responseText.substring(0, 50) + '...');
        return responseText;
      } else {
        console.error('Invalid response format from Gemini API:', JSON.stringify(response.data).substring(0, 200) + '...');
        throw new Error('Invalid response format from Gemini API');
      }
    } catch (error) {
      console.error('Error generating response from Gemini:', error.message);
      if (error.response) {
        console.error('Error response data:', JSON.stringify(error.response.data).substring(0, 200) + '...');
        console.error('Error response status:', error.response.status);
        console.error('Error response headers:', JSON.stringify(error.response.headers).substring(0, 200) + '...');
      }
      throw error;
    }
  }

  // Generate product-aware response with conversation history and store info
  async generateProductResponse(userMessage, products, conversationHistory = [], storeInfo = null) {
    // Create a context with store information
    let storeContext = '';
    if (storeInfo && (storeInfo.name || storeInfo.address || storeInfo.description)) {
      storeContext = 'معلومات المتجر:\n';
      if (storeInfo.name) {
        storeContext += `اسم المتجر: ${storeInfo.name}\n`;
      }
      if (storeInfo.address) {
        storeContext += `عنوان المتجر: ${storeInfo.address}\n`;
      }
      if (storeInfo.description) {
        storeContext += `وصف المتجر: ${storeInfo.description}\n`;
      }
      storeContext += '\n';
    }

    // Create a context with the available products
    let productContext = '';
    if (products && products.length > 0) {
      productContext = 'المنتجات المتوفرة لدينا في المتجر:\n';
      products.forEach((product, index) => {
        productContext += `${index + 1}. ${product.name}: ${product.price} - ${product.description}\n`;
      });
      productContext += '\nأنت تعمل كمساعد للرد على استفسارات العملاء في متجرنا. يجب عليك الإجابة على أسئلة العملاء حول هذه المنتجات بدقة.';
    } else {
      productContext = 'لا توجد منتجات متوفرة حالياً في المتجر.';
    }

    // Format conversation history
    let conversationContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = 'المحادثة السابقة:\n';
      conversationHistory.forEach(msg => {
        const role = msg.type === 'user' ? 'العميل' : 'المساعد';
        conversationContext += `${role}: ${msg.content}\n`;
      });
      conversationContext += '\n';
    }

    // Create the full prompt
    const fullPrompt = `
أنت مساعد للرد على استفسارات العملاء باللهجة العراقية في متجر إلكتروني. يجب أن تكون ودوداً ومهذباً ومفيداً.

${storeContext}${productContext}

${conversationContext}
رسالة العميل الحالية: "${userMessage}"

تعليمات مهمة:
1. قم بالرد على العميل باللهجة العراقية الدارجة، استخدم كلمات مثل (هلا، شلونك، شنو، هواية، اي، بعد، ماكو، اكو) وغيرها من الكلمات العراقية.
2. تصرف كأنك صاحب المتجر أو موظف فيه، وليس كذكاء اصطناعي.
3. عندما يسأل العميل عن اسم المتجر أو عنوانه، استخدم المعلومات المذكورة أعلاه.
4. عندما يسأل العميل عن المنتجات المتوفرة، اذكر له المنتجات من القائمة أعلاه بالتفصيل.
5. عندما يسأل عن منتج معين أو سعر، قدم له المعلومات الدقيقة من قائمة المنتجات أعلاه.
6. إذا لم يكن المنتج المطلوب موجوداً، اقترح منتجات مشابهة من القائمة.
7. إذا كان السؤال غير متعلق بالمنتجات، أجب بشكل عام ولطيف.
8. تذكر المحادثة السابقة واستمر في نفس السياق.
9. لا تقل أبداً أنك نموذج لغوي أو ذكاء اصطناعي، بل تصرف كصاحب المتجر أو موظف فيه.
10. استخدم عبارات ترحيبية عراقية مثل "هلا بيك"، "نورتنا"، "تدلل"، "آمرني"، "خدمة".
11. عند الحديث عن الأسعار، يمكنك استخدام عبارات مثل "سعره زين"، "سعر حلو"، "سعر مناسب".
12. عند وصف المنتجات، استخدم عبارات مثل "يجنن"، "خرافي"، "ممتاز"، "حلو هواية".
13. إذا طلب العميل شراء منتج أو أبدى رغبته في الشراء، اطلب منه معلوماته الشخصية (الاسم، رقم الهاتف، العنوان) إذا لم يقدمها بالفعل.

بالإضافة إلى ردك العادي، اتبع هذه القواعد للتعامل مع الطلبات:

1. إذا طلب العميل شراء منتج ولم يقدم معلوماته الشخصية بعد، اطلب منه هذه المعلومات وأضف في نهاية ردك:
===ORDER_PENDING===
PRODUCT_NAME: [اسم المنتج المطلوب]
QUANTITY: [الكمية المطلوبة، افتراضياً 1]
STATUS: WAITING_FOR_INFO
===END_ORDER===

2. إذا قدم العميل معلوماته الشخصية بعد طلب منتج (في رسالة منفصلة)، قم بتأكيد الطلب وأضف في نهاية ردك:
===ORDER_INFO===
PRODUCT_NAME: [اسم المنتج المطلوب]
QUANTITY: [الكمية المطلوبة، افتراضياً 1]
CUSTOMER_INFO: [معلومات العميل التي قدمها]
NOTES: [أي ملاحظات إضافية]
STATUS: CONFIRMED
===END_ORDER===

3. إذا قدم العميل طلب شراء مع معلوماته الشخصية في نفس الرسالة، قم بتأكيد الطلب مباشرة وأضف في نهاية ردك:
===ORDER_INFO===
PRODUCT_NAME: [اسم المنتج المطلوب]
QUANTITY: [الكمية المطلوبة، افتراضياً 1]
CUSTOMER_INFO: [معلومات العميل التي قدمها]
NOTES: [أي ملاحظات إضافية]
STATUS: CONFIRMED
===END_ORDER===

مثال 1:
إذا قال العميل "أريد شراء هاتف آيفون 15 برو"، فستطلب منه معلوماته وتضيف:
===ORDER_PENDING===
PRODUCT_NAME: هاتف آيفون 15 برو
QUANTITY: 1
STATUS: WAITING_FOR_INFO
===END_ORDER===

مثال 2:
إذا قال العميل بعد ذلك "اسمي أحمد، رقمي 07XXXXXXXX، وعنواني بغداد الكرادة"، فستؤكد الطلب وتضيف:
===ORDER_INFO===
PRODUCT_NAME: هاتف آيفون 15 برو
QUANTITY: 1
CUSTOMER_INFO: اسمي أحمد، رقمي 07XXXXXXXX، وعنواني بغداد الكرادة
NOTES:
STATUS: CONFIRMED
===END_ORDER===
`;

    console.log('Generating response with conversation history of', conversationHistory.length, 'messages');

    // Use the API to generate a response
    return await this.generateResponse(fullPrompt);
  }

  // Generate response using conversation format for Gemini API with product and store context
  async generateConversationResponse(messages, products = [], storeInfo = null) {
    try {
      const url = `${this.baseUrl}?key=${this.apiKey}`;

      console.log('Using Gemini API URL:', this.baseUrl);
      console.log('Using API key ending with:', this.apiKey.substring(this.apiKey.length - 5));
      console.log('Products available:', products.length);
      console.log('Store info available:', storeInfo ? 'Yes' : 'No');

      // Create store context
      let storeContext = '';
      if (storeInfo && (storeInfo.name || storeInfo.address || storeInfo.description)) {
        storeContext = 'معلومات المتجر:\n';
        if (storeInfo.name) {
          storeContext += `اسم المتجر: ${storeInfo.name}\n`;
        }
        if (storeInfo.address) {
          storeContext += `عنوان المتجر: ${storeInfo.address}\n`;
        }
        if (storeInfo.description) {
          storeContext += `وصف المتجر: ${storeInfo.description}\n`;
        }
        storeContext += '\n';
      }

      // Create product context
      let productContext = '';
      if (products && products.length > 0) {
        productContext = 'المنتجات المتوفرة لدينا في المتجر:\n';
        products.forEach((product, index) => {
          productContext += `${index + 1}. ${product.name}: ${product.price} - ${product.description}\n`;
        });
        productContext += '\nأنت تعمل كمساعد للرد على استفسارات العملاء في متجرنا. يجب عليك الإجابة على أسئلة العملاء حول هذه المنتجات بدقة.';
      } else {
        productContext = 'لا توجد منتجات متوفرة حالياً في المتجر.';
      }

      // Add system message with instructions and context
      const systemMessage = {
        role: 'user',
        parts: [{
          text: `أنت مساعد للرد على استفسارات العملاء باللهجة العراقية في متجر إلكتروني. يجب أن تكون ودوداً ومهذباً ومفيداً.

${storeContext}${productContext}

تعليمات مهمة:
1. قم بالرد على العميل باللهجة العراقية الدارجة، استخدم كلمات مثل (هلا، شلونك، شنو، هواية، اي، بعد، ماكو، اكو) وغيرها من الكلمات العراقية.
2. تصرف كأنك صاحب المتجر أو موظف فيه، وليس كذكاء اصطناعي.
3. عندما يسأل العميل عن اسم المتجر أو عنوانه، استخدم المعلومات المذكورة أعلاه.
4. عندما يسأل العميل عن المنتجات المتوفرة، اذكر له المنتجات من القائمة أعلاه بالتفصيل.
5. عندما يسأل عن منتج معين أو سعر، قدم له المعلومات الدقيقة من قائمة المنتجات أعلاه.
6. إذا لم يكن المنتج المطلوب موجوداً، اقترح منتجات مشابهة من القائمة.
7. إذا كان السؤال غير متعلق بالمنتجات، أجب بشكل عام ولطيف.
8. تذكر المحادثة السابقة واستمر في نفس السياق.
9. لا تقل أبداً أنك نموذج لغوي أو ذكاء اصطناعي، بل تصرف كصاحب المتجر أو موظف فيه.
10. استخدم عبارات ترحيبية عراقية مثل "هلا بيك"، "نورتنا"، "تدلل"، "آمرني"، "خدمة".
11. عند الحديث عن الأسعار، يمكنك استخدام عبارات مثل "سعره زين"، "سعر حلو"، "سعر مناسب".
12. عند وصف المنتجات، استخدم عبارات مثل "يجنن"، "خرافي"، "ممتاز"، "حلو هواية".
13. إذا طلب العميل شراء منتج أو أبدى رغبته في الشراء، اطلب منه معلوماته الشخصية (الاسم، رقم الهاتف، العنوان) إذا لم يقدمها بالفعل.

بالإضافة إلى ردك العادي، اتبع هذه القواعد للتعامل مع الطلبات:

1. إذا طلب العميل شراء منتج ولم يقدم معلوماته الشخصية بعد، اطلب منه هذه المعلومات وأضف في نهاية ردك:
===ORDER_PENDING===
PRODUCT_NAME: [اسم المنتج المطلوب]
QUANTITY: [الكمية المطلوبة، افتراضياً 1]
STATUS: WAITING_FOR_INFO
===END_ORDER===

2. إذا قدم العميل معلوماته الشخصية بعد طلب منتج (في رسالة منفصلة)، قم بتأكيد الطلب وأضف في نهاية ردك:
===ORDER_INFO===
PRODUCT_NAME: [اسم المنتج المطلوب]
QUANTITY: [الكمية المطلوبة، افتراضياً 1]
CUSTOMER_INFO: [معلومات العميل التي قدمها]
NOTES: [أي ملاحظات إضافية]
STATUS: CONFIRMED
===END_ORDER===

3. إذا قدم العميل طلب شراء مع معلوماته الشخصية في نفس الرسالة، قم بتأكيد الطلب مباشرة وأضف في نهاية ردك:
===ORDER_INFO===
PRODUCT_NAME: [اسم المنتج المطلوب]
QUANTITY: [الكمية المطلوبة، افتراضياً 1]
CUSTOMER_INFO: [معلومات العميل التي قدمها]
NOTES: [أي ملاحظات إضافية]
STATUS: CONFIRMED
===END_ORDER===

مثال 1:
إذا قال العميل "أريد شراء هاتف آيفون 15 برو"، فستطلب منه معلوماته وتضيف:
===ORDER_PENDING===
PRODUCT_NAME: هاتف آيفون 15 برو
QUANTITY: 1
STATUS: WAITING_FOR_INFO
===END_ORDER===

مثال 2:
إذا قال العميل بعد ذلك "اسمي أحمد، رقمي 07XXXXXXXX، وعنواني بغداد الكرادة"، فستؤكد الطلب وتضيف:
===ORDER_INFO===
PRODUCT_NAME: هاتف آيفون 15 برو
QUANTITY: 1
CUSTOMER_INFO: اسمي أحمد، رقمي 07XXXXXXXX، وعنواني بغداد الكرادة
NOTES:
STATUS: CONFIRMED
===END_ORDER===

الآن ستبدأ المحادثة الفعلية مع العميل:`
        }]
      };

      // Format messages for Gemini API
      const formattedMessages = messages.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // Add system message at the beginning
      formattedMessages.unshift(systemMessage);

      const data = {
        contents: formattedMessages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.95,
          topK: 40
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      console.log('Sending conversation request to Gemini API with', messages.length, 'messages');

      // Set timeout to 10 seconds
      const response = await axios.post(url, data, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Received response from Gemini API with status:', response.status);

      if (response.data &&
          response.data.candidates &&
          response.data.candidates.length > 0 &&
          response.data.candidates[0].content &&
          response.data.candidates[0].content.parts &&
          response.data.candidates[0].content.parts.length > 0) {
        const responseText = response.data.candidates[0].content.parts[0].text;
        console.log('Successfully extracted response text:', responseText.substring(0, 50) + '...');
        return responseText;
      } else {
        console.error('Invalid response format from Gemini API:', JSON.stringify(response.data).substring(0, 200) + '...');
        throw new Error('Invalid response format from Gemini API');
      }
    } catch (error) {
      console.error('Error generating conversation response from Gemini:', error.message);
      if (error.response) {
        console.error('Error response data:', JSON.stringify(error.response.data).substring(0, 200) + '...');
        console.error('Error response status:', error.response.status);
      }
      throw error;
    }
  }
}

module.exports = new GeminiAPI(process.env.GEMINI_API_KEY);
