const { validate, registerSchema, createChainSchema, verifyPaymentSchema } = require('../../src/middleware/validate');

describe('Validation Schemas', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  // ── registerSchema ──────────────────────────────────────
  describe('registerSchema', () => {
    test('valid registration data', () => {
      const req = { body: { email: 'test@test.com', password: 'password123', username: 'testuser' } };
      const res = mockRes();
      const result = validate(req, res, registerSchema);
      expect(result).toBeTruthy();
      expect(result.email).toBe('test@test.com');
    });

    test('rejects short password', () => {
      const req = { body: { email: 'test@test.com', password: '123', username: 'testuser' } };
      const res = mockRes();
      const result = validate(req, res, registerSchema);
      expect(result).toBeNull();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects invalid email', () => {
      const req = { body: { email: 'notanemail', password: 'password123', username: 'testuser' } };
      const res = mockRes();
      const result = validate(req, res, registerSchema);
      expect(result).toBeNull();
    });

    test('rejects invalid username chars', () => {
      const req = { body: { email: 'test@test.com', password: 'password123', username: 'user name!' } };
      const res = mockRes();
      const result = validate(req, res, registerSchema);
      expect(result).toBeNull();
    });
  });

  // ── createChainSchema ───────────────────────────────────
  describe('createChainSchema', () => {
    test('valid chain data', () => {
      const req = { body: { name: 'My Chain', type: 'evm' } };
      const res = mockRes();
      const result = validate(req, res, createChainSchema);
      expect(result).toBeTruthy();
    });

    test('rejects invalid chain type', () => {
      const req = { body: { name: 'My Chain', type: 'invalid_type' } };
      const res = mockRes();
      const result = validate(req, res, createChainSchema);
      expect(result).toBeNull();
    });

    test('rejects special chars in name', () => {
      const req = { body: { name: '<script>alert(1)</script>', type: 'evm' } };
      const res = mockRes();
      const result = validate(req, res, createChainSchema);
      expect(result).toBeNull();
    });
  });

  // ── verifyPaymentSchema ─────────────────────────────────
  describe('verifyPaymentSchema', () => {
    test('rejects invalid txHash format', () => {
      const req = { body: { paymentId: '507f1f77bcf86cd799439011', txHash: 'not_a_hash' } };
      const res = mockRes();
      const result = validate(req, res, verifyPaymentSchema);
      expect(result).toBeNull();
    });

    test('accepts valid txHash', () => {
      const req = { body: {
        paymentId: '507f1f77bcf86cd799439011',
        txHash: '0x' + 'a'.repeat(64),
      }};
      const res = mockRes();
      const result = validate(req, res, verifyPaymentSchema);
      expect(result).toBeTruthy();
    });
  });
});
