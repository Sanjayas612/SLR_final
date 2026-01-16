// server.js - Updated with Profile Setup & Token Pass System with Payment
const express = require("express");
require("dotenv").config();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const path = require("path");
const cors = require("cors");
const QRCode = require('qrcode');
const crypto = require('crypto');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.use(bodyParser.json());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://your-render-app.onrender.com' : '*',
  credentials: true
}));
app.use(express.static(__dirname));

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "67430401790-jdomcgb5s0vcvsp6ln56j3g3aem2h26v.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dcd0vatd4',
  api_key: process.env.CLOUDINARY_API_KEY || '686887924855346',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'HcltpsGGsCldCyoBtuGMOpwv3iI'
});

const mealStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'messmate_meals',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 600, crop: 'limit' }]
  }
});

const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'messmate_profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
  }
});

const uploadMeal = multer({ storage: mealStorage });
const uploadProfile = multer({ storage: profileStorage });

const mongoURI = process.env.MONGODB_URI || "mongodb+srv://SLR:SLR@slr.eldww0q.mongodb.net/mess_db?retryWrites=true&w=majority&appName=SLR&serverSelectionTimeoutMS=10000&connectTimeoutMS=10000";

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000
}).then(() => {
  console.log("✅ MongoDB Connected Successfully");
  initMeals();
}).catch(err => {
  console.error("❌ MongoDB Connection Error:", err.message);
  process.exit(1);
});

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["student", "producer"], default: "student" },
  profilePhoto: String,
  profilePhotoId: String,
  profileComplete: { type: Boolean, default: false },
  orders: [{
    mealName: String,
    price: Number,
    date: { type: Date, default: Date.now },
    paid: { type: Boolean, default: false },
    token: String
  }],
  verifiedToday: {
    date: String,
    verified: { type: Boolean, default: false },
    verifiedAt: Date,
    meals: [{
      name: String,
      quantity: Number,
      totalPrice: Number
    }]
  },
  ratings: {
    type: Map,
    of: Number,
    default: new Map()
  },
  createdAt: { type: Date, default: Date.now }
});

const mealSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  image: String,
  cloudinaryId: String,
  description: String,
  price: { type: Number, default: 0 },
  avgRating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  ratings: [Number],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const tokenSchema = new mongoose.Schema({
  token: { type: String, unique: true, required: true },
  date: { type: String, required: true },
  userEmail: { type: String, required: true },
  userName: { type: String, required: true },
  userPhoto: String,
  meals: [{
    name: String,
    quantity: Number,
    price: Number
  }],
  totalAmount: { type: Number, required: true },
  paid: { type: Boolean, default: true },
  verified: { type: Boolean, default: false },
  verifiedAt: Date,
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
  paymentDetails: {
    mainAmount: Number,
    mainUPI: String,
    commissionAmount: Number,
    commissionUPI: String,
    transactionId: String,
    upiRef: String,
    paymentTime: Date
  }
});

const User = mongoose.model("User", userSchema);
const Meal = mongoose.model("Meal", mealSchema);
const Token = mongoose.model("Token", tokenSchema);

let ratingClients = [];

async function generateDailyToken(date) {
  const dateStr = date.toDateString();
  const count = await Token.countDocuments({ date: dateStr });
  return `${count + 1}`;
}

// 4. Update the cleanExpiredTokens function
async function cleanExpiredTokens() {
  const now = new Date();
  
  // Only delete tokens that are expired, unpaid, and unverified
  await Token.deleteMany({ 
    expiresAt: { $lt: now },
    paid: false,
    verified: false 
  });
  console.log("🧹 Cleaned expired unpaid tokens");
}


setInterval(cleanExpiredTokens, 60 * 60 * 1000);

async function initMeals() {
  try {
    const mealCount = await Meal.countDocuments();
    if (mealCount === 0) {
      await Meal.insertMany([
        {
          name: "Meal 1",
          image: "https://via.placeholder.com/400x300/667eea/ffffff?text=Meal+1",
          description: "Sample Meal 1 - delicious and filling.",
          price: 100,
          avgRating: 0,
          totalRatings: 0,
          ratings: []
        },
        {
          name: "Meal 2",
          image: "https://via.placeholder.com/400x300/764ba2/ffffff?text=Meal+2",
          description: "Sample Meal 2 - chef's special.",
          price: 120,
          avgRating: 0,
          totalRatings: 0,
          ratings: []
        }
      ]);
      console.log("✅ Meals initialized");
    }
  } catch (err) {
    console.error("Error initializing meals:", err.message);
  }
}

function broadcastRatingUpdate(mealName, avgRating, totalRatings) {
  const message = `data: ${JSON.stringify({ mealName, avgRating, totalRatings })}\n\n`;
  ratingClients.forEach(res => {
    try {
      res.write(message);
    } catch (err) {
      console.error("Error broadcasting:", err);
    }
  });
}

app.get("/sse-ratings", (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  ratingClients.push(res);
  
  req.on('close', () => {
    ratingClients = ratingClients.filter(client => client !== res);
  });
});

app.post("/auth/google", async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ success: false, error: "Token is required" });
    }
    
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const email = payload['email'];
    const name = payload['name'];
    
    if (!email.endsWith('@vvce.ac.in')) {
      return res.status(403).json({ 
        success: false, 
        error: "Please use your @vvce.ac.in email address" 
      });
    }
    
    let user = await User.findOne({ email });
    
    if (!user) {
      user = new User({
        name: name,
        email: email,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        role: "student",
        profileComplete: false
      });
      await user.save();
    }
    
    res.json({ 
      success: true, 
      role: user.role, 
      email: user.email, 
      name: user.name,
      profileComplete: user.profileComplete,
      profilePhoto: user.profilePhoto
    });
  } catch (err) {
    console.error("Google Auth error:", err.message);
    res.status(500).json({ 
      success: false, 
      error: "Authentication failed" 
    });
  }
});

app.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    if (!email || !password || !name) {
      return res.json({ success: false, error: "Missing required fields" });
    }
    
    const existing = await User.findOne({ email });
    if (existing) return res.json({ success: false, error: "duplicate" });
    
    const hashed = await bcrypt.hash(password, 10);
    const user = await new User({ 
      name, 
      email, 
      password: hashed, 
      role,
      profileComplete: false 
    }).save();
    
    res.json({ 
      success: true, 
      role: user.role, 
      email: user.email, 
      name: user.name,
      profileComplete: false
    });
  } catch (err) {
    console.error("Register error:", err.message);
    res.json({ success: false, error: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.json({ success: false, error: "Missing email or password" });
    }
    
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, error: "Invalid credentials" });
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.json({ success: false, error: "Invalid credentials" });
    
    res.json({ 
      success: true, 
      role: user.role, 
      email: user.email, 
      name: user.name,
      profileComplete: user.profileComplete,
      profilePhoto: user.profilePhoto
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.json({ success: false, error: err.message });
  }
});

app.post("/update-profile", uploadProfile.single('photo'), async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: "Email required" });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    
    if (req.file && user.profilePhotoId) {
      try {
        await cloudinary.uploader.destroy(user.profilePhotoId);
      } catch (err) {
        console.error("Error deleting old photo:", err);
      }
    }
    
    if (name) user.name = name;
    if (req.file) {
      user.profilePhoto = req.file.path;
      user.profilePhotoId = req.file.filename;
    }
    
    user.profileComplete = true;
    await user.save();
    
    res.json({ 
      success: true, 
      name: user.name,
      profilePhoto: user.profilePhoto,
      profileComplete: user.profileComplete
    });
  } catch (err) {
    console.error("Profile update error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/meals", async (req, res) => {
  try {
    const meals = await Meal.find().sort({ createdAt: -1 });
    const mealsWithRating = meals.map(m => {
      const avg = m.ratings.length ? (m.ratings.reduce((a,b)=>a+b,0) / m.ratings.length) : 0;
      return {
        _id: m._id,
        name: m.name,
        image: m.image,
        description: m.description,
        price: m.price,
        avgRating: avg ? Number(avg.toFixed(1)) : 0,
        totalRatings: m.ratings.length
      };
    });
    res.json(mealsWithRating);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/add-meal", uploadMeal.single('image'), async (req, res) => {
  try {
    const { name, price, description } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ success: false, error: "Name and price required" });
    }
    
    const existing = await Meal.findOne({ name });
    if (existing) {
      return res.status(400).json({ success: false, error: "Meal exists" });
    }
    
    const mealData = {
      name,
      price: Number(price),
      description: description || '',
      image: req.file ? req.file.path : 'https://via.placeholder.com/400x300/667eea/ffffff?text=No+Image',
      cloudinaryId: req.file ? req.file.filename : null,
      avgRating: 0,
      totalRatings: 0,
      ratings: []
    };
    
    const meal = new Meal(mealData);
    await meal.save();
    
    res.json({ success: true, meal });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/update-meal/:id", uploadMeal.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description } = req.body;
    
    const meal = await Meal.findById(id);
    if (!meal) {
      return res.status(404).json({ success: false, error: "Meal not found" });
    }
    
    if (req.file && meal.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(meal.cloudinaryId);
      } catch (err) {
        console.error("Error deleting old image:", err);
      }
    }
    
    meal.name = name || meal.name;
    meal.price = price ? Number(price) : meal.price;
    meal.description = description !== undefined ? description : meal.description;
    
    if (req.file) {
      meal.image = req.file.path;
      meal.cloudinaryId = req.file.filename;
    }
    
    meal.updatedAt = new Date();
    await meal.save();
    
    res.json({ success: true, meal });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/delete-meal/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const meal = await Meal.findById(id);
    if (!meal) {
      return res.status(404).json({ success: false, error: "Meal not found" });
    }
    
    if (meal.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(meal.cloudinaryId);
      } catch (err) {
        console.error("Error deleting image:", err);
      }
    }
    
    await Meal.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/user/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (user) {
      const ratingsObj = {};
      user.ratings.forEach((value, key) => ratingsObj[key] = value);
      res.json({
        success: true,
        name: user.name,
        email: user.email,
        profilePhoto: user.profilePhoto,
        profileComplete: user.profileComplete,
        orders: user.orders || [],
        ratings: ratingsObj
      });
    } else {
      res.json({ success: false, error: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/book", async (req, res) => {
  try {
    const { mealName, email, price } = req.body;
    
    if (!mealName || !email || !price) {
      return res.json({ success: false, error: "Missing required fields" });
    }
    
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, error: "User not found" });
    
    if (!user.profileComplete) {
      return res.json({ success: false, error: "Please complete your profile first" });
    }
    
    const newOrder = {
      mealName,
      price,
      date: new Date(),
      paid: false,
      token: null
    };
    user.orders.push(newOrder);
    await user.save();
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// Key changes in server.js to fix token expiration issue

// 1. Update the /pay endpoint to set expiration to 24 hours instead of 5 PM same day
app.post("/pay", async (req, res) => {
  try {
    const { email } = req.body;
    const now = new Date();
    const todayStr = now.toDateString();
    
    if (!email) {
      return res.json({ success: false, error: "Missing email" });
    }
    
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, error: "User not found" });
    
    if (!user.profileComplete) {
      return res.json({ success: false, error: "Please complete your profile first" });
    }
    
    const todayUnpaid = user.orders.filter(o => new Date(o.date).toDateString() === todayStr && !o.paid);
    if (todayUnpaid.length === 0) {
      return res.json({ success: false, error: "No unpaid orders today" });
    }
    
    const token = await generateDailyToken(now);
    
    const mealGroups = {};
    todayUnpaid.forEach(order => {
      if (!mealGroups[order.mealName]) {
        mealGroups[order.mealName] = { quantity: 0, price: order.price };
      }
      mealGroups[order.mealName].quantity++;
    });
    
    const meals = Object.entries(mealGroups).map(([name, data]) => ({
      name,
      quantity: data.quantity,
      price: data.price
    }));
    
    const totalAmount = todayUnpaid.reduce((sum, o) => sum + o.price, 0);
    
    // FIXED: Set expiration to 24 hours from now instead of 5 PM today
    // This gives users time to complete payment
    const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from now
    
    const tokenDoc = new Token({
      token,
      date: todayStr,
      userEmail: email,
      userName: user.name,
      userPhoto: user.profilePhoto,
      meals,
      totalAmount,
      paid: false, // FIXED: Set to false initially, will be true after payment verification
      verified: false,
      expiresAt
    });
    await tokenDoc.save();
    
    // Don't mark orders as paid yet - only after payment verification
    todayUnpaid.forEach(order => {
      order.token = token; // Assign token but don't mark as paid yet
    });
    
    await user.save();
    
    res.json({ 
      success: true, 
      token,
      meals,
      totalAmount,
      userPhoto: user.profilePhoto,
      userName: user.name
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Update the /token/:token endpoint to not check expiration for unpaid tokens
app.get("/token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    
    const tokenDoc = await Token.findOne({ token });
    if (!tokenDoc) {
      return res.json({ success: false, error: "Token not found" });
    }
    
    const now = new Date();
    // FIXED: Only check expiration if token is not paid and not verified
    if (now > tokenDoc.expiresAt && !tokenDoc.paid && !tokenDoc.verified) {
      return res.json({ success: false, error: "Token expired. Please create a new order." });
    }
    
    res.json({
      success: true,
      token: tokenDoc.token,
      date: tokenDoc.date,
      userEmail: tokenDoc.userEmail,
      userName: tokenDoc.userName,
      userPhoto: tokenDoc.userPhoto,
      meals: tokenDoc.meals,
      totalAmount: tokenDoc.totalAmount,
      paid: tokenDoc.paid,
      verified: tokenDoc.verified,
      verifiedAt: tokenDoc.verifiedAt,
      expiresAt: tokenDoc.expiresAt
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Update payment verification to mark orders as paid and extend expiration
app.post("/verify-token-payment", async (req, res) => {
  try {
    const { token, amount } = req.body;
    const now = new Date();
    
    if (!token || !amount) {
      return res.json({ success: false, error: "Token and amount required" });
    }
    
    const tokenDoc = await Token.findOne({ token });
    if (!tokenDoc) {
      return res.json({ success: false, error: "Invalid token" });
    }
    
    if (tokenDoc.verified) {
      return res.json({ 
        success: false, 
        error: "Token already verified",
        verifiedAt: tokenDoc.verifiedAt
      });
    }
    
    // FIXED: Remove expiration check for payment verification
    // Allow payment even if token expired, as long as it's not verified
    
    // Verify amount matches
    if (Math.abs(tokenDoc.totalAmount - amount) > 0.01) {
      return res.json({ success: false, error: "Amount mismatch" });
    }
    
    // Calculate commission (0.01% of total amount)
    const commissionAmount = (amount * 0.0001).toFixed(2);
    
    console.log(`
      ╔═══════════════════════════════════════════════════════╗
      💰 PAYMENT TRANSACTION DETAILS
      ╠═══════════════════════════════════════════════════════╣
      Token: ${token}
      Main Payment: ₹${amount} → 9483246283@kotak811
      Commission (0.01%): ₹${commissionAmount} → pgayushrai@okicici
      User: ${tokenDoc.userEmail}
      Date: ${new Date().toLocaleString('en-IN')}
      ╚═══════════════════════════════════════════════════════╝
    `);
    
    // FIXED: Update token to paid and verified, extend expiration to 5 PM today
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const newExpiresAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0);
    
    tokenDoc.paid = true;
    tokenDoc.verified = true;
    tokenDoc.verifiedAt = now;
    tokenDoc.expiresAt = newExpiresAt; // Now expires at 5 PM today
    tokenDoc.paymentDetails = {
      mainAmount: amount,
      mainUPI: '9483246283@kotak811',
      commissionAmount: parseFloat(commissionAmount),
      commissionUPI: 'pgayushrai@okicici',
      paymentTime: now
    };
    await tokenDoc.save();
    
    // FIXED: Now mark user's orders as paid
    const user = await User.findOne({ email: tokenDoc.userEmail });
    if (user) {
      const todayStr = tokenDoc.date;
      user.orders.forEach(order => {
        if (order.token === token && new Date(order.date).toDateString() === todayStr) {
          order.paid = true;
        }
      });
      
      user.verifiedToday = {
        date: tokenDoc.date,
        verified: true,
        verifiedAt: now,
        meals: tokenDoc.meals
      };
      await user.save();
    }
    
    res.json({ 
      success: true, 
      message: "Payment verified and token activated",
      tokenDoc,
      paymentDetails: {
        mainAmount: amount,
        commissionAmount: parseFloat(commissionAmount)
      }
    });
  } catch (err) {
    console.error("Payment verification error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Get payment details for a token
app.get("/token/:token/payment", async (req, res) => {
  try {
    const { token } = req.params;
    
    const tokenDoc = await Token.findOne({ token });
    if (!tokenDoc) {
      return res.json({ success: false, error: "Token not found" });
    }
    
    const commissionAmount = (tokenDoc.totalAmount * 0.0001).toFixed(2);
    
    res.json({
      success: true,
      token: tokenDoc.token,
      totalAmount: tokenDoc.totalAmount,
      mainUPI: '9483246283@kotak811',
      commissionAmount: parseFloat(commissionAmount),
      commissionUPI: 'pgayushrai@okicici',
      verified: tokenDoc.verified,
      paymentDetails: tokenDoc.paymentDetails || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin endpoint to view all payment transactions
app.get("/admin/payments", async (req, res) => {
  try {
    const tokens = await Token.find({ verified: true })
      .sort({ verifiedAt: -1 })
      .limit(100);
    
    const paymentSummary = tokens.map(t => ({
      token: t.token,
      userEmail: t.userEmail,
      userName: t.userName,
      mainAmount: t.totalAmount,
      commissionAmount: (t.totalAmount * 0.0001).toFixed(2),
      verifiedAt: t.verifiedAt,
      paymentDetails: t.paymentDetails
    }));
    
    const totalMain = tokens.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalCommission = (totalMain * 0.0001).toFixed(2);
    
    res.json({
      success: true,
      transactions: paymentSummary,
      summary: {
        totalTransactions: tokens.length,
        totalMainPayments: totalMain,
        totalCommission: parseFloat(totalCommission),
        mainUPI: '9483246283@kotak811',
        commissionUPI: 'pgayushrai@okicici'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add this to your server.js file

// Simulated UPI Payment Webhook (for testing)
// In production, this would be replaced by actual payment gateway webhook
app.post("/simulate-payment", async (req, res) => {
  try {
    const { token, upiRef } = req.body;
    const now = new Date();
    
    if (!token) {
      return res.json({ success: false, error: "Token required" });
    }
    
    const tokenDoc = await Token.findOne({ token });
    if (!tokenDoc) {
      return res.json({ success: false, error: "Invalid token" });
    }
    
    if (tokenDoc.verified) {
      return res.json({ 
        success: false, 
        error: "Token already verified"
      });
    }
    
    // Simulate payment processing
    const amount = tokenDoc.totalAmount;
    const commissionAmount = (amount * 0.0001).toFixed(2);
    
    console.log(`
      ╔═══════════════════════════════════════════════════════╗
      💰 PAYMENT RECEIVED (Simulated)
      ╠═══════════════════════════════════════════════════════╣
      Token: ${token}
      Amount: ₹${amount}
      UPI Ref: ${upiRef || 'AUTO-' + Date.now()}
      Main UPI: 9483246283@kotak811
      Commission: ₹${commissionAmount} → pgayushrai@okicici
      Time: ${new Date().toLocaleString('en-IN')}
      ╚═══════════════════════════════════════════════════════╝
    `);
    
    // Update token
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const newExpiresAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0);
    
    tokenDoc.paid = true;
    tokenDoc.verified = true;
    tokenDoc.verifiedAt = now;
    tokenDoc.expiresAt = newExpiresAt;
    tokenDoc.paymentDetails = {
      mainAmount: amount,
      mainUPI: '9483246283@kotak811',
      commissionAmount: parseFloat(commissionAmount),
      commissionUPI: 'pgayushrai@okicici',
      transactionId: 'TXN-' + Date.now(),
      upiRef: upiRef || 'AUTO-' + Date.now(),
      paymentTime: now
    };
    await tokenDoc.save();
    
    // Mark user orders as paid
    const user = await User.findOne({ email: tokenDoc.userEmail });
    if (user) {
      const todayStr = tokenDoc.date;
      user.orders.forEach(order => {
        if (order.token === token && new Date(order.date).toDateString() === todayStr) {
          order.paid = true;
        }
      });
      
      user.verifiedToday = {
        date: tokenDoc.date,
        verified: true,
        verifiedAt: now,
        meals: tokenDoc.meals
      };
      await user.save();
    }
    
    res.json({ 
      success: true, 
      message: "Payment processed successfully",
      verified: true,
      verifiedAt: now
    });
  } catch (err) {
    console.error("Payment simulation error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Real UPI Payment Gateway Webhook (for production use)
// Replace this with your actual payment gateway's webhook endpoint
app.post("/upi-webhook", async (req, res) => {
  try {
    // Verify webhook signature (implement based on your payment gateway)
    // const signature = req.headers['x-webhook-signature'];
    // if (!verifySignature(signature, req.body)) {
    //   return res.status(401).json({ error: "Invalid signature" });
    // }
    
    const { 
      status, 
      amount, 
      token, 
      upiTransactionId, 
      payerVPA 
    } = req.body;
    
    if (status !== 'SUCCESS') {
      return res.json({ received: true });
    }
    
    const tokenDoc = await Token.findOne({ token });
    if (!tokenDoc || tokenDoc.verified) {
      return res.json({ received: true });
    }
    
    // Verify amount matches
    if (Math.abs(tokenDoc.totalAmount - amount) > 0.01) {
      console.error(`Amount mismatch for token ${token}: expected ${tokenDoc.totalAmount}, got ${amount}`);
      return res.json({ received: true });
    }
    
    const now = new Date();
    const commissionAmount = (amount * 0.0001).toFixed(2);
    
    console.log(`
      ╔═══════════════════════════════════════════════════════╗
      💰 REAL PAYMENT RECEIVED
      ╠═══════════════════════════════════════════════════════╣
      Token: ${token}
      Amount: ₹${amount}
      UPI Transaction ID: ${upiTransactionId}
      Payer VPA: ${payerVPA}
      Main UPI: 9483246283@kotak811
      Commission: ₹${commissionAmount} → pgayushrai@okicici
      Time: ${new Date().toLocaleString('en-IN')}
      ╚═══════════════════════════════════════════════════════╝
    `);
    
    // Update token
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const newExpiresAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0);
    
    tokenDoc.paid = true;
    tokenDoc.verified = true;
    tokenDoc.verifiedAt = now;
    tokenDoc.expiresAt = newExpiresAt;
    tokenDoc.paymentDetails = {
      mainAmount: amount,
      mainUPI: '9483246283@kotak811',
      commissionAmount: parseFloat(commissionAmount),
      commissionUPI: 'pgayushrai@okicici',
      transactionId: upiTransactionId,
      upiRef: payerVPA,
      paymentTime: now
    };
    await tokenDoc.save();
    
    // Mark user orders as paid
    const user = await User.findOne({ email: tokenDoc.userEmail });
    if (user) {
      const todayStr = tokenDoc.date;
      user.orders.forEach(order => {
        if (order.token === token && new Date(order.date).toDateString() === todayStr) {
          order.paid = true;
        }
      });
      
      user.verifiedToday = {
        date: tokenDoc.date,
        verified: true,
        verifiedAt: now,
        meals: tokenDoc.meals
      };
      await user.save();
    }
    
    res.json({ received: true, verified: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Testing endpoint - Remove in production
app.get("/test-payment/:token", async (req, res) => {
  const { token } = req.params;
  
  // Simulate payment after 3 seconds
  setTimeout(async () => {
    await fetch(`http://localhost:${PORT}/simulate-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        token, 
        upiRef: 'TEST-' + Date.now() 
      })
    });
  }, 3000);
  
  res.send(`
    <html>
      <body style="font-family: Arial; padding: 40px; text-align: center;">
        <h1>Payment Simulation Started</h1>
        <p>Token ${token} will be verified in 3 seconds...</p>
        <p>Go back to dashboard4.html to see auto-detection in action!</p>
      </body>
    </html>
  `);
});
// Webhook endpoint for actual UPI payment verification (for future integration)
app.post("/webhook/payment-confirmation", async (req, res) => {
  try {
    const { transactionId, token, amount, upiRef, status } = req.body;
    
    if (status === 'SUCCESS') {
      const tokenDoc = await Token.findOne({ token });
      if (tokenDoc && !tokenDoc.verified) {
        tokenDoc.verified = true;
        tokenDoc.verifiedAt = new Date();
        tokenDoc.paymentDetails = {
          transactionId,
          upiRef,
          mainAmount: amount,
          mainUPI: '9483246283@kotak811',
          commissionAmount: (amount * 0.0001).toFixed(2),
          commissionUPI: 'pgayushrai@okicici',
          paymentTime: new Date()
        };
        await tokenDoc.save();
        
        console.log(`✅ Payment confirmed for token ${token} - Amount: ₹${amount}`);
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/verify-token", async (req, res) => {
  try {
    const { token } = req.body;
    const now = new Date();
    
    if (!token) {
      return res.json({ success: false, error: "Token required" });
    }
    
    const tokenDoc = await Token.findOne({ token });
    if (!tokenDoc) {
      return res.json({ success: false, error: "Invalid token" });
    }
    
    if (tokenDoc.verified) {
      return res.json({ 
        success: false, 
        error: "Token already verified",
        verifiedAt: tokenDoc.verifiedAt
      });
    }
    
    if (now > tokenDoc.expiresAt) {
      return res.json({ success: false, error: "Token expired" });
    }
    
    tokenDoc.verified = true;
    tokenDoc.verifiedAt = now;
    await tokenDoc.save();
    
    const user = await User.findOne({ email: tokenDoc.userEmail });
    if (user) {
      user.verifiedToday = {
        date: tokenDoc.date,
        verified: true,
        verifiedAt: now,
        meals: tokenDoc.meals
      };
      await user.save();
    }
    
    res.json({ success: true, tokenDoc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/check-verified", async (req, res) => {
  try {
    const { userEmail, date } = req.body;
    const user = await User.findOne({ email: userEmail });
    if (!user) return res.json({ verified: false });
    
    const verifiedToday = user.verifiedToday;
    const isVerified = verifiedToday && verifiedToday.date === date && verifiedToday.verified;
    res.json({ verified: isVerified });
  } catch (err) {
    res.json({ verified: false });
  }
});

app.post("/verify", async (req, res) => {
  try {
    const { userEmail, date } = req.body;
    const now = new Date();
    
    if (!userEmail || !date) {
      return res.json({ success: false, error: "Missing data" });
    }
    
    const user = await User.findOne({ email: userEmail });
    if (!user) return res.json({ success: false, error: "User not found" });
    
    const todayPaid = user.orders.filter(o => new Date(o.date).toDateString() === date && o.paid);
    if (todayPaid.length === 0) {
      return res.json({ success: false, error: "No paid orders" });
    }
    
    const grouped = todayPaid.reduce((acc, meal) => {
      const name = meal.mealName;
      if (!acc[name]) acc[name] = { quantity: 0, totalPrice: 0 };
      acc[name].quantity++;
      acc[name].totalPrice += meal.price;
      return acc;
    }, {});
    
    user.verifiedToday = {
      date,
      verified: true,
      verifiedAt: now,
      meals: Object.entries(grouped).map(([name, info]) => ({
        name,
        quantity: info.quantity,
        totalPrice: info.totalPrice
      }))
    };
    
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/cancel", async (req, res) => {
  try {
    const { orderId, email } = req.body;
    
    if (!orderId || !email) {
      return res.json({ success: false, error: "Missing data" });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: false, error: "User not found" });
    }
    
    const orderIndex = user.orders.findIndex(o => o._id.toString() === orderId);
    if (orderIndex === -1) {
      return res.json({ success: false, error: "Order not found" });
    }
    
    const order = user.orders[orderIndex];
    const now = new Date();
    const orderDateStr = order.date.toDateString();
    const todayStr = now.toDateString();
    
    if (orderDateStr !== todayStr) {
      return res.json({ success: false, error: "Cannot cancel previous orders" });
    }
    
    if (order.paid) {
      return res.json({ success: false, error: "Cannot cancel paid orders" });
    }
    
    user.orders.splice(orderIndex, 1);
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/rate", async (req, res) => {
  try {
    const { mealName, rating, email } = req.body;
    
    if (!mealName || typeof rating === 'undefined' || !email) {
      return res.json({ success: false, error: "Missing fields" });
    }
    
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, error: "User not found" });
    
    user.ratings.set(mealName, Number(rating));
    await user.save();
    
    const meal = await Meal.findOne({ name: mealName });
    if (!meal) return res.json({ success: false, error: "Meal not found" });
    
    meal.ratings.push(Number(rating));
    const avgRating = meal.ratings.length ? (meal.ratings.reduce((a,b)=>a+b,0) / meal.ratings.length) : 0;
    meal.avgRating = Number(avgRating.toFixed(1));
    meal.totalRatings = meal.ratings.length;
    
    await meal.save();
    broadcastRatingUpdate(mealName, meal.avgRating, meal.totalRatings);
    res.json({ success: true, avgRating: meal.avgRating, totalRatings: meal.totalRatings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/meal/:name", async (req, res) => {
  try {
    const meal = await Meal.findOne({ name: req.params.name });
    if (meal) {
      const avgRating = meal.ratings.length ? (meal.ratings.reduce((a,b)=>a+b,0) / meal.ratings.length) : 0;
      res.json({ 
        success: true, 
        name: meal.name, 
        image: meal.image, 
        description: meal.description, 
        price: meal.price, 
        avgRating: Number(avgRating.toFixed(1)), 
        totalRatings: meal.ratings.length 
      });
    } else {
      res.status(404).json({ success: false, error: "Meal not found" });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/producer/stats", async (req, res) => {
  try {
    const { period = 'day' } = req.query;
    const users = await User.find({});
    let allOrders = [];
    let verifiedCount = 0;
    users.forEach(u => {
      allOrders.push(...(u.orders || []));
      if (u.verifiedToday && u.verifiedToday.verified) {
        const todayStr = new Date().toDateString();
        if (u.verifiedToday.date === todayStr) {
          verifiedCount += u.verifiedToday.meals.reduce((sum, m) => sum + m.quantity, 0);
        }
      }
    });
    
    const now = new Date();
    let startDate;
    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(0);
    }

    const filteredOrders = allOrders.filter(o => new Date(o.date) >= startDate);

    const total = filteredOrders.length;
    const paid = filteredOrders.filter(o => o.paid).length;
    const unpaid = total - paid;

    const mealCounts = {};
    filteredOrders.forEach(o => {
      mealCounts[o.mealName] = (mealCounts[o.mealName] || 0) + 1;
    });

    res.json({ total, paid, unpaid, meals: mealCounts, verified: verifiedCount });
  } catch (err) {
    console.error("Error fetching producer stats:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Serve dashboards (routes) ----------
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "dashboard.html"));
});
app.get("/dashboard1", (req, res) => {
    res.sendFile(path.join(__dirname, "dashboard1.html"));
});
app.get("/dashboard3", (req, res) => {
    res.sendFile(path.join(__dirname, "dashboard3.html"));
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: "Server error" });
});

// ---------- Start server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log("📡 Make sure MongoDB Atlas connection is active");
    console.log("☁️ Cloudinary configured for image uploads");
    console.log("🔐 Google OAuth configured");
});