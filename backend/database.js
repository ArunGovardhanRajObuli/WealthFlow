const BetterSqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');


const isTest = process.env.NODE_ENV === 'test';
const log = (msg) => { if (!isTest) console.log(msg); };

const dbPath = isTest ? ':memory:' : path.resolve(process.env.USER_DATA_PATH || __dirname, 'finance.sqlite');
const db = new BetterSqlite3(dbPath, { timeout: 5000 });
log(`Connected to the SQLite database (${dbPath === ':memory:' ? 'in-memory' : 'file'}).`);

// Enable WAL mode for better performance and crash resilience
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
log('SQLite WAL mode enabled.');

db.pragma('foreign_keys = ON');
log('SQLite Foreign Keys strictly enforced.');

// Backup logic removed from synchronous startup to prevent blocking the event loop.
// It will be scheduled out-of-band or via an async cron job.




function addColumnIfNotExists(db, table, column, definition) {
    if (!/^[a-zA-Z0-9_]+$/.test(table) || !/^[a-zA-Z0-9_]+$/.test(column)) {
        throw new Error(`Invalid table or column name: ${table}.${column}`);
    }
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.find(c => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

const migrations = [
    {
        version: 1,
        name: '001-initial-schema',
        up: (db) => {
            // base tables
            db.exec(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    category TEXT,
                    date TEXT
                )
            `);
            const txCols = [
                { name: 'isTaxDeductible', def: 'INTEGER DEFAULT 0' },
                { name: 'receiptUrl', def: 'TEXT' },
                { name: 'propertyId', def: 'INTEGER DEFAULT NULL' },
                { name: 'source_bank_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'joint_bank_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'split_percent', def: 'REAL DEFAULT 100' },
                { name: 'split_amount', def: 'REAL DEFAULT NULL' },
                { name: 'linked_loan_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'investment_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'sinking_fund_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'family_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'credit_card_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'fd_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'gold_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'nps_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'insurance_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'subscription_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'asset_units', def: 'REAL DEFAULT NULL' },
                { name: 'transfer_id', def: 'TEXT DEFAULT NULL' }
            ];
            txCols.forEach(c => addColumnIfNotExists(db, 'transactions', c.name, c.def));

            db.exec(`
                CREATE TABLE IF NOT EXISTS ledger_lines (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    transaction_id INTEGER,
                    account_class TEXT,
                    account_type TEXT,
                    entity_id INTEGER,
                    debit_amount REAL DEFAULT 0,
                    credit_amount REAL DEFAULT 0
                )
            `);

            db.exec(`
                CREATE TABLE IF NOT EXISTS reminders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    amount REAL,
                    dueDate TEXT,
                    category TEXT
                )
            `);
            const reminderCols = [
                { name: 'termYears', def: 'INTEGER DEFAULT 0' },
                { name: 'frequency', def: "TEXT DEFAULT 'once'" },
                { name: 'principalAmount', def: 'REAL DEFAULT 0' },
                { name: 'interestRate', def: 'REAL DEFAULT 0' },
                { name: 'owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'policyType', def: "TEXT DEFAULT 'Life'" },
                { name: 'startDate', def: 'TEXT' }
            ];
            reminderCols.forEach(c => addColumnIfNotExists(db, 'reminders', c.name, c.def));

            db.exec(`
                CREATE TABLE IF NOT EXISTS budgets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT UNIQUE,
                    monthlyLimit REAL
                )
            `);

            db.exec(`
                CREATE TABLE IF NOT EXISTS net_worth_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    snapshotDate TEXT,
                    assets REAL DEFAULT 0,
                    liabilities REAL DEFAULT 0
                )
            `);

            db.exec(`
                CREATE TABLE IF NOT EXISTS credit_cards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    creditLimit REAL,
                    currentBalance REAL,
                    dueDate TEXT
                )
            `);
            addColumnIfNotExists(db, 'credit_cards', 'owner_member_id', 'INTEGER DEFAULT NULL');

            db.exec(`
                CREATE TABLE IF NOT EXISTS loan_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    loan_id INTEGER,
                    amount REAL,
                    date TEXT
                )
            `);
            const lpCols = [
                { name: 'source_bank_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'joint_bank_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'split_percent', def: 'REAL DEFAULT 100' },
                { name: 'split_amount', def: 'REAL DEFAULT NULL' },
                { name: 'transaction_id', def: 'INTEGER DEFAULT NULL' }
            ];
            lpCols.forEach(c => addColumnIfNotExists(db, 'loan_payments', c.name, c.def));

            db.exec(`
                CREATE TABLE IF NOT EXISTS sinking_funds (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    targetAmount REAL,
                    currentAmount REAL DEFAULT 0,
                    targetDate TEXT
                )
            `);
            const sfCols = [
                { name: 'owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'joint_owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'owner_split_percent', def: 'REAL DEFAULT 100' }
            ];
            sfCols.forEach(c => addColumnIfNotExists(db, 'sinking_funds', c.name, c.def));

            db.exec(`
                CREATE TABLE IF NOT EXISTS family_members (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    role TEXT,
                    age INTEGER,
                    annualIncome REAL DEFAULT 0,
                    lifeInsuranceCoverage REAL DEFAULT 0,
                    collegeSavings REAL DEFAULT 0
                )
            `);
            addColumnIfNotExists(db, 'family_members', 'targetAge', 'INTEGER DEFAULT 18');
            addColumnIfNotExists(db, 'family_members', 'targetCollegeValue', 'REAL DEFAULT 150000');

            db.exec(`
                CREATE TABLE IF NOT EXISTS net_worth_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    snapshotDate TEXT UNIQUE,
                    assets REAL,
                    liabilities REAL
                )
            `);

            db.exec(`
                CREATE TABLE IF NOT EXISTS investments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    category TEXT,
                    assetClass TEXT,
                    currentAmount REAL DEFAULT 0,
                    targetAmount REAL DEFAULT 0,
                    roi REAL DEFAULT 0,
                    unrealizedGain REAL DEFAULT 0
                )
            `);
            const invCols = [
                { name: 'schemeCode', def: 'TEXT' },
                { name: 'dividendYield', def: 'REAL DEFAULT 0' },
                { name: 'latestNav', def: 'REAL DEFAULT 0' },
                { name: 'totalUnits', def: 'REAL DEFAULT 0' },
                { name: 'owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'joint_owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'owner_split_percent', def: 'REAL DEFAULT 100' }
            ];
            invCols.forEach(c => addColumnIfNotExists(db, 'investments', c.name, c.def));

            db.exec(`
                CREATE TABLE IF NOT EXISTS real_estate (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    propertyType TEXT,
                    baseValue REAL DEFAULT 0,
                    expectedRent REAL DEFAULT 0,
                    currentMarketValue REAL DEFAULT 0,
                    purchaseDate TEXT,
                    occupancyStatus TEXT DEFAULT 'rented',
                    linkedLoanId INTEGER DEFAULT NULL
                )
            `);
            const reCols = [
                { name: 'owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'joint_owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'owner_split_percent', def: 'REAL DEFAULT 100' }
            ];
            reCols.forEach(c => addColumnIfNotExists(db, 'real_estate', c.name, c.def));

            db.exec(`
                CREATE TABLE IF NOT EXISTS investment_lots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    investment_id INTEGER,
                    purchaseDate TEXT,
                    purchaseAmount REAL DEFAULT 0,
                    units REAL DEFAULT 0,
                    costBasis REAL DEFAULT 0,
                    currentNav REAL DEFAULT 0
                )
            `);
            addColumnIfNotExists(db, 'investment_lots', 'transaction_id', 'INTEGER DEFAULT NULL');

            db.exec(`
                CREATE TABLE IF NOT EXISTS sip_purchases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    investment_id INTEGER,
                    date TEXT,
                    amount REAL DEFAULT 0,
                    navPrice REAL DEFAULT 0,
                    unitsPurchased REAL DEFAULT 0
                )
            `);
            addColumnIfNotExists(db, 'sip_purchases', 'transaction_id', 'INTEGER DEFAULT NULL');

            db.exec(`
                CREATE TABLE IF NOT EXISTS savings_rules (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trigger_event TEXT,
                    trigger_threshold REAL DEFAULT 0,
                    action_type TEXT,
                    action_amount REAL DEFAULT 0,
                    target_type TEXT,
                    target_id INTEGER,
                    is_active INTEGER DEFAULT 1
                )
            `);

            db.exec(`
                CREATE TABLE IF NOT EXISTS pending_sweeps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rule_id INTEGER,
                    trigger_transaction_id INTEGER,
                    suggested_amount REAL,
                    target_type TEXT,
                    target_id INTEGER,
                    status TEXT DEFAULT 'pending',
                    created_at TEXT DEFAULT (datetime('now'))
                )
            `);

            db.exec(`
                CREATE TABLE IF NOT EXISTS bank_balances (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    bankName TEXT,
                    balance REAL DEFAULT 0,
                    asOfDate TEXT,
                    createdAt TEXT DEFAULT (datetime('now'))
                )
            `);
            addColumnIfNotExists(db, 'bank_balances', 'owner_member_id', 'INTEGER DEFAULT NULL');

            db.exec(`
                CREATE TABLE IF NOT EXISTS gold_holdings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    type TEXT,
                    weightGrams REAL DEFAULT 0,
                    purchasePricePerGram REAL DEFAULT 0,
                    currentPricePerGram REAL DEFAULT 0,
                    interestRate REAL DEFAULT 0
                )
            `);
            const goldCols = [
                { name: 'purchaseDate', def: 'TEXT' },
                { name: 'maturityDate', def: 'TEXT' },
                { name: 'owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'joint_owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'owner_split_percent', def: 'REAL DEFAULT 100' }
            ];
            goldCols.forEach(c => addColumnIfNotExists(db, 'gold_holdings', c.name, c.def));

            db.exec(`
                CREATE TABLE IF NOT EXISTS nps_accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pranNumber TEXT,
                    memberName TEXT,
                    tier TEXT,
                    totalContribution REAL DEFAULT 0,
                    currentValue REAL DEFAULT 0,
                    monthlyContribution REAL DEFAULT 0,
                    employerContribution REAL DEFAULT 0,
                    equityPct REAL DEFAULT 50,
                    corpBondPct REAL DEFAULT 30,
                    govtSecPct REAL DEFAULT 20,
                    startDate TEXT
                )
            `);
            const npsCols = [
                { name: 'owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'joint_owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'owner_split_percent', def: 'REAL DEFAULT 100' }
            ];
            npsCols.forEach(c => addColumnIfNotExists(db, 'nps_accounts', c.name, c.def));

            db.exec(`
                CREATE TABLE IF NOT EXISTS fixed_deposits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    bankName TEXT,
                    principal REAL DEFAULT 0,
                    interestRate REAL DEFAULT 0,
                    tenureMonths INTEGER DEFAULT 12,
                    startDate TEXT
                )
            `);
            const fdCols = [
                { name: 'maturityDate', def: 'TEXT' },
                { name: 'maturityAmount', def: 'REAL DEFAULT 0' },
                { name: 'isAutoRenew', def: 'INTEGER DEFAULT 0' },
                { name: 'isTaxSaver', def: 'INTEGER DEFAULT 0' },
                { name: 'owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'joint_owner_member_id', def: 'INTEGER DEFAULT NULL' },
                { name: 'owner_split_percent', def: 'REAL DEFAULT 100' }
            ];
            fdCols.forEach(c => addColumnIfNotExists(db, 'fixed_deposits', c.name, c.def));

            db.exec(`
                CREATE TABLE IF NOT EXISTS nominees (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    relationship TEXT,
                    family_member_id INTEGER DEFAULT NULL,
                    assetType TEXT,
                    assetId INTEGER,
                    assetDescription TEXT,
                    sharePercent REAL DEFAULT 100,
                    notes TEXT
                )
            `);

            db.exec(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT DEFAULT (datetime('now')),
                    action TEXT,
                    entity TEXT,
                    entity_id INTEGER,
                    details TEXT
                )
            `);

            db.exec(`
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    category TEXT,
                    familyMemberId INTEGER,
                    assetId INTEGER,
                    fileUrl TEXT,
                    expiryDate TEXT,
                    uploadedAt TEXT DEFAULT (datetime('now'))
                )
            `);

            db.exec(`
                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            `);

            db.exec(`CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_lines (account_class, account_type, entity_id);`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);`);

            // Clean up legacy auto_deb triggers if they exist
            db.exec(`DROP TRIGGER IF EXISTS auto_deb_insert`);
            db.exec(`DROP TRIGGER IF EXISTS auto_deb_update`);
            db.exec(`DROP TRIGGER IF EXISTS auto_deb_delete`);
            db.exec(`DROP TRIGGER IF EXISTS trg_cleanup_ledger_lines;`);
            db.exec(`DROP TRIGGER IF EXISTS trg_auto_ledger_lines;`);
            db.exec(`DROP TRIGGER IF EXISTS trg_update_ledger_lines;`);

            // (Dummy data seeding block removed)
        }
    },
    {
        version: 2,
        name: '002-drop-legacy-transaction-columns',
        up: (db) => {
            db.exec("DROP INDEX IF EXISTS idx_transactions_category");
            
            const columns = db.prepare("PRAGMA table_info(transactions)").all();
            if (columns.find(c => c.name === 'amount')) {
                db.exec("ALTER TABLE transactions DROP COLUMN amount");
            }
            if (columns.find(c => c.name === 'type')) {
                db.exec("ALTER TABLE transactions DROP COLUMN type");
            }

            db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category)");
        }
    },
    {
        version: 3,
        name: '003-create-transaction-details-view',
        up: (db) => {
            db.exec(`
                CREATE VIEW IF NOT EXISTS transaction_details AS
                SELECT 
                    t.*,
                    COALESCE(l.amount, 0) as amount,
                    CASE 
                        WHEN l.revenue_credit > 0 THEN 'income'
                        WHEN t.category = 'transfer' AND l.bank_debit > 0 THEN 'income'
                        WHEN t.category = 'opening_balance' AND l.equity_credit > 0 THEN 'income'
                        WHEN t.category = 'capital_retrieval' THEN 'income'
                        WHEN t.category IN ('cc_repayment', 'capital_deployment', 'loan_payment', 'transfer') THEN 'transfer'
                        ELSE 'expense'
                    END as type
                FROM transactions t
                LEFT JOIN (
                    SELECT 
                        transaction_id,
                        SUM(debit_amount) as amount,
                        SUM(CASE WHEN account_class = 'Revenue' THEN credit_amount ELSE 0 END) as revenue_credit,
                        SUM(CASE WHEN account_type = 'bank' THEN debit_amount ELSE 0 END) as bank_debit,
                        SUM(CASE WHEN account_class = 'Equity' THEN credit_amount ELSE 0 END) as equity_credit
                    FROM ledger_lines
                    GROUP BY transaction_id
                ) l ON t.id = l.transaction_id
            `);
        }
    },
    {
        version: 4,
        name: '004-add-performance-indexes',
        up: (db) => {
            db.exec("CREATE INDEX IF NOT EXISTS idx_ledger_transaction_id ON ledger_lines (transaction_id)");
            db.exec("CREATE INDEX IF NOT EXISTS idx_reminders_category ON reminders (category)");
            db.exec("CREATE INDEX IF NOT EXISTS idx_family_members_role ON family_members (role)");
            db.exec("CREATE INDEX IF NOT EXISTS idx_investments_asset_class ON investments (assetClass)");
        }
    },
    {
        version: 5,
        name: '005-add-maturity-amount-to-reminders',
        up: (db) => {
            addColumnIfNotExists(db, 'reminders', 'maturityAmount', 'REAL DEFAULT NULL');
        }
    },
    {
        version: 6,
        name: '006-add-asset-type-to-documents',
        up: (db) => {
            addColumnIfNotExists(db, 'documents', 'assetType', 'TEXT DEFAULT NULL');
        }
    },
    {
        version: 7,
        name: '007-add-is-deceased',
        up: (db) => {
            addColumnIfNotExists(db, 'family_members', 'isDeceased', 'INTEGER DEFAULT 0');
            addColumnIfNotExists(db, 'real_estate', 'isClosed', 'INTEGER DEFAULT 0');
            addColumnIfNotExists(db, 'fixed_deposits', 'isClosed', 'INTEGER DEFAULT 0');
            addColumnIfNotExists(db, 'investments', 'isClosed', 'INTEGER DEFAULT 0');
            addColumnIfNotExists(db, 'bank_balances', 'isClosed', 'INTEGER DEFAULT 0');
            addColumnIfNotExists(db, 'nps_accounts', 'isClosed', 'INTEGER DEFAULT 0');
            addColumnIfNotExists(db, 'gold_holdings', 'isClosed', 'INTEGER DEFAULT 0');
            addColumnIfNotExists(db, 'sinking_funds', 'isClosed', 'INTEGER DEFAULT 0');
        }
    }
];

function initializeDatabase(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            executed_at TEXT DEFAULT (datetime('now'))
        )
    `);

    // Fetch the current version
    const row = db.prepare('SELECT MAX(version) as maxVersion FROM schema_migrations').get();
    const currentVersion = row && row.maxVersion ? row.maxVersion : 0;

    const pendingMigrations = migrations.filter(m => m.version > currentVersion);

    if (pendingMigrations.length > 0) {
        log(`Found ${pendingMigrations.length} pending migrations.`);
        
        for (const migration of pendingMigrations) {
            log(`Executing migration ${migration.version}: ${migration.name}`);
            
            const runMigration = db.transaction(() => {
                migration.up(db);
                db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(migration.version, migration.name);
            });
            
            try {
                runMigration();
                log(`Migration ${migration.version} successfully applied.`);
            } catch (err) {
                console.error(`Error applying migration ${migration.version}:`, err.message);
                throw err; // Stop executing further migrations
            }
        }
    } else {
        log('Database schema is up to date.');
    }
}


initializeDatabase(db);

const nativeDb = db;

// Run backup asynchronously 5 seconds after startup, then every 24 hours
if (dbPath !== ':memory:') {
    const runBackup = async () => {
        try {
            const backupDir = path.resolve(process.env.USER_DATA_PATH || __dirname, 'backups');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
            if (fs.existsSync(dbPath)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const backupPath = path.join(backupDir, `finance_${timestamp}.sqlite`);
                await nativeDb.backup(backupPath);
                
                const backups = fs.readdirSync(backupDir)
                    .filter(f => f.startsWith('finance_') && f.endsWith('.sqlite'))
                    .sort()
                    .reverse();
                backups.slice(3).forEach(f => fs.unlinkSync(path.join(backupDir, f)));
                console.log(`[Async] Database backup safely created: finance_${timestamp}.sqlite (${backups.length} total, keeping 3)`);
            }
        } catch (backupErr) {
            console.error('Async Backup error (non-fatal):', backupErr.message);
        }
    };
    
    setTimeout(runBackup, 5000);
    setInterval(runBackup, 24 * 60 * 60 * 1000);
}

module.exports = { db, nativeDb };
