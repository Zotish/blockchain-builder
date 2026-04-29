const express = require('express');
const authMiddleware = require('../middleware/auth');
const Chain = require('../models/Chain');
const User = require('../models/User');
const { getSSHConnection, runOnVPS, getVPSConfig } = require('../services/vpsService');

const router = express.Router();

// Admin Middleware (Simple check for admin role)
const adminMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        const adminEmail = (process.env.ADMIN_EMAIL || 'chandrazotish@gmail.com').toLowerCase();
        
        console.log(`🔒 Checking admin access for: ${user?.email} (Expected: ${adminEmail})`);

        if (user && (user.role === 'admin' || user.email.toLowerCase() === adminEmail)) {
            next();
        } else {
            console.warn(`🚫 Admin access denied for: ${user?.email}`);
            res.status(403).json({ success: false, error: 'Access denied. Admins only.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error in admin auth.' });
    }
};

/**
 * GET /api/admin/stats
 * Fetches overall platform stats and VPS health
 */
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // 1. Database Stats
        const totalUsers = await User.countDocuments();
        const totalChains = await Chain.countDocuments();
        const activeChains = await Chain.countDocuments({ status: 'deployed' });

        // 2. VPS Health Stats (Real-time from Hetzner)
        const vpsConfig = getVPSConfig();
        let vpsHealth = { cpu: 'N/A', ram: 'N/A', disk: 'N/A', containers: 0 };

        if (vpsConfig) {
            const ssh = await getSSHConnection(vpsConfig);
            
            // Get CPU/RAM usage using 'top' and 'free'
            const ramInfo = await runOnVPS(ssh, "free -m | awk 'NR==2{printf \"%.2f%%\", $3*100/$2}'");
            const cpuInfo = await runOnVPS(ssh, "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1\"%\"}'");
            const diskInfo = await runOnVPS(ssh, "df -h / | awk 'NR==2{print $5}'");
            const containerCount = await runOnVPS(ssh, "docker ps -q | wc -l");

            vpsHealth = {
                cpu: cpuInfo.trim(),
                ram: ramInfo.trim(),
                disk: diskInfo.trim(),
                containers: parseInt(containerCount.trim())
            };
        }

        res.json({
            success: true,
            data: {
                summary: { totalUsers, totalChains, activeChains },
                vpsHealth
            }
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch admin stats.' });
    }
});

module.exports = router;
