require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

require('../database');
const { verifyInternalToken } = require('./middlewares/auth');

const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');

const app = express();



const PORT = process.env.PORT || 4000;




// Security and Parsers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "same-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"]
        }
    },
    frameguard: { action: 'deny' }
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'test' ? '*' : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-internal-token', 'Authorization']
}));

app.use('/api/auth', express.json({ limit: '1kb' }));
app.use(express.json({ limit: '1mb' }));

// Rate Limiting — general API
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, 
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', generalLimiter);

// Apply IPC auth check to all API routes EXCEPT /api/auth which handles master password setup/login
app.use('/api', (req, res, next) => {
    // Only allow login and check-setup to bypass internal token verification
    if (req.path === '/auth/login' || req.path === '/auth/check-setup' || req.path === '/auth/setup' || req.path === '/loans/query') return next();
    return verifyInternalToken(req, res, next);
});

app.use('/api/auth', authRoutes);

const remindersRoutes = require('./routes/reminders');
app.use('/api/reminders', remindersRoutes);

const budgetsRoutes = require('./routes/budgets');
app.use('/api/budgets', budgetsRoutes);

const sinkingFundsRoutes = require('./routes/sinkingFunds');
app.use('/api/sinking-funds', sinkingFundsRoutes);

const creditCardsRoutes = require('./routes/creditCards');
app.use('/api/credit-cards', creditCardsRoutes);

const familyMembersRoutes = require('./routes/familyMembers');
app.use('/api/family-members', familyMembersRoutes);

const investmentsRoutes = require('./routes/investments');
app.use('/api/investments', investmentsRoutes);

const fixedDepositsRoutes = require('./routes/fixedDeposits');
app.use('/api/fixed-deposits', fixedDepositsRoutes);

const goldHoldingsRoutes = require('./routes/goldHoldings');
app.use('/api/gold-holdings', goldHoldingsRoutes);

const npsAccountsRoutes = require('./routes/npsAccounts');
app.use('/api/nps-accounts', npsAccountsRoutes);

const investmentsController = require('./controllers/investmentsController');
const npsAccountsController = require('./controllers/npsAccountsController');
const loansController = require('./controllers/loansController');

const realEstateRoutes = require('./routes/realEstate');
app.use('/api/real-estate', realEstateRoutes);

const loansRoutes = require('./routes/loans');
app.use('/api/loans', loansRoutes);

app.use('/api/settings', settingsRoutes);

const transactionsRoutes = require('./routes/transactions');
app.use('/api', transactionsRoutes);

const ledgerRoutes = require('./routes/ledger');
app.use('/api', ledgerRoutes);

const auditRoutes = require('./routes/audit');
app.use('/api', auditRoutes);

const banksRoutes = require('./routes/banks');
app.use('/api', banksRoutes);

const documentsRoutes = require('./routes/documents');
app.use('/api', documentsRoutes);

const analyticsRoutes = require('./routes/analytics');
app.use('/api', analyticsRoutes);

const netWorthRoutes = require('./routes/netWorth');
app.use('/api/net-worth', netWorthRoutes);

const successionRoutes = require('./routes/succession');
app.use('/api', successionRoutes);

// Additional top-level endpoints for aggregated queries
app.get('/api/loans-list', loansController.getLoansList);
app.get('/api/loan-payments', loansController.getAllPayments);
app.get('/api/nps-projection', npsAccountsController.getProjection);
app.get('/api/stocks-search', investmentsController.stocksSearch);
app.get('/api/amfi-search', investmentsController.amfiSearch);

// Set up Vault directories securely
const uploadDir = path.join(process.env.USER_DATA_PATH || path.join(__dirname, '..'), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use('/uploads', (req, res, next) => {
    // Authenticate uploads directory using internal token
    verifyInternalToken(req, res, next);
}, express.static(uploadDir));

// Serve static frontend files (bundled by electron-builder)
const staticFrontendPath = path.join(__dirname, '../public');
if (fs.existsSync(staticFrontendPath)) {
    app.use(express.static(staticFrontendPath));
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            res.sendFile(path.join(staticFrontendPath, 'index.html'));
        } else {
            res.status(404).json({ error: 'API endpoint not found' });
        }
    });
} else {
    // Reject unsupported HTTP methods
    app.use((req, res) => res.status(405).json({ error: 'Method not allowed' }));
}
const backupService = require('./services/backupService');
backupService.init();

module.exports = app;
