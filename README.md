# AutoReply Backend API Server

نظام خلفي متطور للرد التلقائي على وسائل التواصل الاجتماعي مع دعم Facebook و Instagram.

## المميزات

- 🤖 **رد تلقائي ذكي** باستخدام Google Gemini AI
- 📱 **دعم Facebook و Instagram** عبر Facebook Webhook
- 🛒 **نظام إدارة المنتجات والطلبات**
- 👥 **نظام إدارة المستخدمين والصلاحيات**
- 🔐 **مصادقة آمنة** مع JWT
- 📊 **قاعدة بيانات MongoDB**
- 🌐 **API RESTful** شامل

## التقنيات المستخدمة

- **Node.js** - بيئة التشغيل
- **Express.js** - إطار العمل
- **MongoDB** - قاعدة البيانات
- **Google Gemini AI** - الذكاء الاصطناعي
- **Facebook Graph API** - تكامل وسائل التواصل
- **JWT** - المصادقة والأمان

## متطلبات التشغيل

- Node.js 18+
- MongoDB
- Facebook App (App ID & App Secret)
- Google Gemini API Key

## متغيرات البيئة المطلوبة

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/

# Facebook Integration
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_VERIFY_TOKEN=your_verify_token

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Server
PORT=3000
NODE_ENV=production

# JWT
JWT_SECRET=your_jwt_secret
```

## التثبيت والتشغيل

```bash
# تثبيت المتطلبات
npm install

# تشغيل الخادم
npm start

# تشغيل في وضع التطوير
npm run dev
```

## API Endpoints

### المصادقة
- `POST /api/auth/login` - تسجيل الدخول
- `POST /api/auth/register` - إنشاء حساب جديد

### إدارة المنتجات
- `GET /api/products` - عرض جميع المنتجات
- `POST /api/products` - إضافة منتج جديد
- `PUT /api/products/:id` - تحديث منتج
- `DELETE /api/products/:id` - حذف منتج

### إدارة الطلبات
- `GET /api/orders` - عرض جميع الطلبات
- `POST /api/orders` - إنشاء طلب جديد
- `PUT /api/orders/:id` - تحديث حالة الطلب

### Facebook Webhook
- `GET /api/webhook` - التحقق من Webhook
- `POST /api/webhook` - استقبال الرسائل

## النشر على Railway

1. **ربط GitHub Repository**
2. **إضافة متغيرات البيئة**
3. **النشر التلقائي**

## الدعم

للدعم والاستفسارات، يرجى التواصل عبر GitHub Issues.

## الترخيص

MIT License
