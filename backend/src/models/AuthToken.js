const mongoose = require('mongoose');
const crypto = require('crypto');

const emailVerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token:     { type: String, required: true, unique: true },
    type:      { type: String, enum: ['email_verify', 'password_reset'], required: true },
    expiresAt: { type: Date, required: true },
    used:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-delete expired tokens
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

emailVerificationSchema.statics.createToken = async function (userId, type, expiryMs = 24 * 60 * 60 * 1000) {
  // Invalidate old tokens of same type
  await this.deleteMany({ userId, type });
  const token = crypto.randomBytes(32).toString('hex');
  return this.create({
    userId,
    token,
    type,
    expiresAt: new Date(Date.now() + expiryMs),
  });
};

module.exports = mongoose.model('AuthToken', emailVerificationSchema);
