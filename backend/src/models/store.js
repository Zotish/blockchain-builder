// In-memory data store (will be replaced with MongoDB)
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

class InMemoryStore {
  constructor() {
    this.users = [];
    this.chains = [];
    this.deployments = [];
    this.payments = [];
  }

  // User operations
  async createUser({ email, password, username, walletAddress }) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      id: uuidv4(),
      email,
      username,
      password: hashedPassword,
      walletAddress: walletAddress || null,
      plan: 'free',
      chainsCreated: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(user);
    return this.sanitizeUser(user);
  }

  async findUserByEmail(email) {
    return this.users.find(u => u.email === email) || null;
  }

  async findUserById(id) {
    const user = this.users.find(u => u.id === id);
    return user ? this.sanitizeUser(user) : null;
  }

  async findUserByIdFull(id) {
    return this.users.find(u => u.id === id) || null;
  }

  async validatePassword(user, password) {
    return bcrypt.compare(password, user.password);
  }

  sanitizeUser(user) {
    const { password, ...sanitized } = user;
    return sanitized;
  }

  // Chain operations
  async createChain(chainData) {
    const chain = {
      id: uuidv4(),
      ...chainData,
      status: 'draft',
      network: 'testnet',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.chains.push(chain);
    return chain;
  }

  async findChainsByUser(userId) {
    return this.chains.filter(c => c.userId === userId);
  }

  async findChainById(id) {
    return this.chains.find(c => c.id === id) || null;
  }

  async updateChain(id, updates) {
    const index = this.chains.findIndex(c => c.id === id);
    if (index === -1) return null;
    this.chains[index] = { ...this.chains[index], ...updates, updatedAt: new Date() };
    return this.chains[index];
  }

  async deleteChain(id) {
    const index = this.chains.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.chains.splice(index, 1);
    return true;
  }

  // Deployment operations
  async createDeployment(deployData) {
    const deployment = {
      id: uuidv4(),
      ...deployData,
      status: 'pending',
      logs: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.deployments.push(deployment);
    return deployment;
  }

  async findDeploymentsByChain(chainId) {
    return this.deployments.filter(d => d.chainId === chainId);
  }

  async findDeploymentById(id) {
    return this.deployments.find(d => d.id === id) || null;
  }

  async updateDeployment(id, updates) {
    const index = this.deployments.findIndex(d => d.id === id);
    if (index === -1) return null;
    this.deployments[index] = { ...this.deployments[index], ...updates, updatedAt: new Date() };
    return this.deployments[index];
  }

  async addDeploymentLog(id, log) {
    const deployment = this.deployments.find(d => d.id === id);
    if (!deployment) return null;
    deployment.logs.push({ message: log, timestamp: new Date() });
    deployment.updatedAt = new Date();
    return deployment;
  }

  // Payment operations
  async createPayment(paymentData) {
    const payment = {
      id: uuidv4(),
      ...paymentData,
      status: 'pending',
      createdAt: new Date(),
    };
    this.payments.push(payment);
    return payment;
  }

  async findPaymentById(id) {
    return this.payments.find(p => p.id === id) || null;
  }

  async updatePayment(id, updates) {
    const index = this.payments.findIndex(p => p.id === id);
    if (index === -1) return null;
    this.payments[index] = { ...this.payments[index], ...updates };
    return this.payments[index];
  }

  async findPaymentsByUser(userId) {
    return this.payments.filter(p => p.userId === userId);
  }
}

// Singleton instance
const store = new InMemoryStore();
module.exports = store;
