const request = require('supertest');

// Mock MongoDB to avoid real DB connection in tests
jest.mock('../../src/config/db', () => ({
  connectDB: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/services/chainMonitor', () => ({
  startChainMonitor: jest.fn(),
}));
jest.mock('../../src/services/cronService', () => ({
  startCronJobs: jest.fn(),
}));
jest.mock('../../src/models/User', () => {
  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'test@test.com',
    username: 'testuser',
    isVerified: false,
    toSafeObject: jest.fn().mockReturnValue({ email: 'test@test.com', username: 'testuser' }),
    save: jest.fn(),
  };
  return {
    findOne: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(mockUser),
    create: jest.fn().mockResolvedValue(mockUser),
  };
});
jest.mock('../../src/models/AuthToken', () => ({
  createToken: jest.fn().mockResolvedValue({ token: 'test-token' }),
}));
jest.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

const { app } = require('../../src/server');

describe('Auth Routes', () => {
  describe('POST /api/auth/register', () => {
    test('rejects missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com' }); // missing password and username
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('rejects invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'notvalid', password: 'password123', username: 'testuser' });
      expect(res.status).toBe(400);
    });

    test('rejects weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com', password: '123', username: 'testuser' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    test('rejects missing credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/health', () => {
    test('returns ok status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
