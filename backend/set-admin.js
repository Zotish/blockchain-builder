require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const email = process.argv[2];

if (!email) {
    console.error('❌ Please provide an email address: node set-admin.js user@example.com');
    process.exit(1);
}

async function setAdmin() {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGO_URI is not set in .env');
        
        await mongoose.connect(uri);
        console.log('📡 Connected to MongoDB...');

        const user = await User.findOneAndUpdate(
            { email: email.toLowerCase() },
            { role: 'admin' },
            { new: true }
        );

        if (user) {
            console.log(`✅ Success! User ${email} is now an ADMIN.`);
        } else {
            console.error(`❌ User with email ${email} not found.`);
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        mongoose.connection.close();
    }
}

setAdmin();
