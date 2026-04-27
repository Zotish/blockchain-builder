const mongoose = require('mongoose');

let isConnected = false;

async function connectDB(uri) {
  if (isConnected) return;

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('✅ MongoDB connected');

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected — reconnecting...');
      isConnected = false;
    });
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    // Graceful fallback: continue running (API will return 503 on DB ops)
    throw err;
  }
}

module.exports = { connectDB };
