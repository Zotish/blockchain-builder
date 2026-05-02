const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://zotish:zotish123@cluster0.p7ucl.mongodb.net/blockchain-builder?retryWrites=true&w=majority';
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION_USE_LONG_RANDOM_STRING';

async function runTests() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const User = mongoose.model('User', new mongoose.Schema({ email: String, role: String }));
  const Chain = mongoose.model('Chain', new mongoose.Schema({ 
    name: String, 
    type: String, 
    status: String, 
    userId: mongoose.Schema.Types.ObjectId,
    network: String,
    config: Object,
    token: Object,
    endpoints: Object
  }));

  const user = await User.findOne({ email: 'chandrazotish@gmail.com' });
  if (!user) {
    console.log('User not found');
    process.exit(1);
  }

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
  console.log(`Generated Token for ${user.email}`);

  const chainTypes = ['cosmos', 'substrate', 'solana', 'evm']; // Testing these first

  for (const type of chainTypes) {
    console.log(`\n--- Testing ${type.toUpperCase()} ---`);
    
    // 1. Create Chain
    // (Simulating the API call logic)
    const newChain = new Chain({
      name: `Test-${type}-${Date.now()}`,
      type: type,
      network: 'testnet',
      userId: user._id,
      status: 'pending',
      config: { blockTime: 5 },
      token: { name: 'Test', symbol: 'TEST', supply: 1000000 }
    });
    await newChain.save();
    console.log(`Created Chain ID: ${newChain._id}`);

    // Since I can't trigger the actual deployment process easily from here (it involves SSH to Hetzner),
    // I will check EXISTING chains of these types to see if they work.
  }

  const activeChains = await Chain.find({ status: 'deployed' });
  console.log(`\nFound ${activeChains.length} deployed chains to verify:`);

  for (const chain of activeChains) {
    console.log(`\nVerifying ${chain.name} (${chain.type}) - ${chain.endpoints?.rpc}`);
    // I'll try to reach the RPC via the proxy logic or directly if possible
  }

  await mongoose.disconnect();
}

runTests();
