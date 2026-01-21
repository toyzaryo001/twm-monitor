// Master Settings Router
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireMaster } from '../../middleware/auth';
import fs from 'fs';
import path from 'path';

export const masterSettingsRouter = Router();

// All routes require Master role
masterSettingsRouter.use(requireAuth, requireMaster);

// Get current settings (masked)
masterSettingsRouter.get('/', async (req, res) => {
    const jwtSecret = process.env.JWT_SECRET || '';
    const databaseUrl = process.env.DATABASE_URL || '';

    return res.status(200).json({
        ok: true,
        data: {
            jwtSecret: jwtSecret ? `${jwtSecret.slice(0, 8)}...${jwtSecret.slice(-4)}` : 'NOT SET',
            jwtSecretLength: jwtSecret.length,
            databaseConfigured: !!databaseUrl,
            nodeEnv: process.env.NODE_ENV || 'development',
            port: process.env.PORT || '3000',
        },
    });
});

// Generate new JWT secret (returns but doesn't save - user must set in Railway)
masterSettingsRouter.post('/generate-jwt-secret', async (req, res) => {
    const crypto = await import('crypto');
    const newSecret = crypto.randomBytes(32).toString('hex');

    return res.status(200).json({
        ok: true,
        data: {
            secret: newSecret,
            instructions: 'Copy this secret and set it as JWT_SECRET in Railway Variables. Then redeploy.',
        },
    });
});

// Validate current JWT secret
masterSettingsRouter.post('/validate-jwt-secret', async (req, res) => {
    const jwtSecret = process.env.JWT_SECRET || '';

    const issues: string[] = [];

    if (!jwtSecret) {
        issues.push('JWT_SECRET is not set');
    } else if (jwtSecret.length < 32) {
        issues.push('JWT_SECRET should be at least 32 characters');
    } else if (jwtSecret === 'twm-monitor-secret-change-in-production') {
        issues.push('JWT_SECRET is using the default value - please change it!');
    }

    return res.status(200).json({
        ok: true,
        data: {
            valid: issues.length === 0,
            issues,
        },
    });
});

// System info
masterSettingsRouter.get('/system', async (req, res) => {
    return res.status(200).json({
        ok: true,
        data: {
            version: '0.2.0',
            nodeVersion: process.version,
            platform: process.platform,
            uptime: Math.floor(process.uptime()),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            },
        },
    });
});
