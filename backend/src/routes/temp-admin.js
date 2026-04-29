const express = require('express');
const User = require('../models/User');
const router = express.Router();

// ⚠️ TEMPORARY ROUTE TO SET ADMIN — WILL BE DELETED AFTER USE
router.get('/setup', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).send('Email required');

        const user = await User.findOneAndUpdate(
            { email: email.toLowerCase() },
            { role: 'admin' },
            { new: true }
        );

        if (user) {
            res.send(`🚀 Success! ${email} is now an ADMIN. You can now login and visit /admin`);
        } else {
            res.status(404).send(`❌ User ${email} not found. Did you register already?`);
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = router;
