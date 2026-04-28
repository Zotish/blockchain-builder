const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE;
    this.token = null;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('chainforge_token');
    }
  }

  setToken(token) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('chainforge_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chainforge_token');
      localStorage.removeItem('chainforge_user');
    }
  }

  getUser() {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('chainforge_user');
      return user ? JSON.parse(user) : null;
    }
    return null;
  }

  setUser(user) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chainforge_user', JSON.stringify(user));
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Is the backend running?');
      }
      throw error;
    }
  }

  // Auth
  async register(email, password, username) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    });
    if (res.success) {
      this.setToken(res.data.token);
      this.setUser(res.data.user);
    }
    return res;
  }

  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.success) {
      this.setToken(res.data.token);
      this.setUser(res.data.user);
    }
    return res;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  logout() {
    this.clearToken();
  }

  // Chains
  async getChains() {
    return this.request('/chains');
  }

  async getChain(id) {
    return this.request(`/chains/${id}`);
  }

  async createChain(chainData) {
    return this.request('/chains', {
      method: 'POST',
      body: JSON.stringify(chainData),
    });
  }

  async updateChain(id, updates) {
    return this.request(`/chains/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteChain(id) {
    return this.request(`/chains/${id}`, {
      method: 'DELETE',
    });
  }

  async getGenesis(chainId) {
    return this.request(`/chains/${chainId}/genesis`);
  }

  // Templates
  async getTemplates(type = null) {
    const query = type ? `?type=${type}` : '';
    return this.request(`/templates${query}`);
  }

  async getTemplate(id) {
    return this.request(`/templates/${id}`);
  }

  // Deploy
  async deployTestnet(chainId) {
    return this.request(`/deploy/testnet/${chainId}`, {
      method: 'POST',
    });
  }

  async deployMainnet(chainId, paymentId) {
    return this.request(`/deploy/mainnet/${chainId}`, {
      method: 'POST',
      body: JSON.stringify({ paymentId }),
    });
  }

  async getDeployment(id) {
    return this.request(`/deploy/${id}`);
  }

  // Payment
  async getPricing() {
    return this.request('/payment/pricing');
  }

  async createPayment(chainId, plan, currency = 'ETH') {
    return this.request('/payment/create', {
      method: 'POST',
      body: JSON.stringify({ chainId, plan, currency }),
    });
  }

  async verifyPayment(paymentId, txHash) {
    return this.request('/payment/verify', {
      method: 'POST',
      body: JSON.stringify({ paymentId, txHash }),
    });
  }

  async getPaymentHistory() {
    return this.request('/payment/history');
  }

  // Faucet
  async requestFaucet(chainId, address) {
    return this.request(`/faucet/${chainId}`, {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  }

  // Deploy extras
  async getDeployLogs(chainId) {
    return this.request(`/deploy/logs/${chainId}`);
  }

  async getDeployStatus(chainId) {
    return this.request(`/deploy/status/${chainId}`);
  }

  // Chain adapter info
  async getChainAdapter(chainId) {
    return this.request(`/chains/${chainId}/adapter`);
  }
}

const api = new ApiClient();
export default api;
