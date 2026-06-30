'use strict';

/**
 * successionService.test.js
 *
 * Exhaustive unit tests for successionService.js using a real in-memory SQLite
 * database (NODE_ENV=test is set by npm test / cross-env).
 *
 * Tables touched by the service:
 *   real_estate, fixed_deposits, investments, bank_balances,
 *   nps_accounts, gold_holdings, sinking_funds,
 *   nominees, family_members, audit_logs, ledger_lines
 */

const { nativeDb } = require('../../database');
const successionService = require('./successionService');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function insertFamilyMember(name = 'Alice', role = 'Spouse') {
    return nativeDb
        .prepare('INSERT INTO family_members (name, role) VALUES (?, ?)')
        .run(name, role)
        .lastInsertRowid;
}

function insertRealEstate({ title = 'Home', currentMarketValue = 1000000, linkedLoanId = null, owner_split_percent = 100 } = {}) {
    return nativeDb
        .prepare('INSERT INTO real_estate (title, currentMarketValue, linkedLoanId, owner_split_percent) VALUES (?, ?, ?, ?)')
        .run(title, currentMarketValue, linkedLoanId, owner_split_percent)
        .lastInsertRowid;
}

function insertFixedDeposit({ bankName = 'SBI FD', principal = 500000, owner_split_percent = 100 } = {}) {
    return nativeDb
        .prepare('INSERT INTO fixed_deposits (bankName, principal, owner_split_percent) VALUES (?, ?, ?)')
        .run(bankName, principal, owner_split_percent)
        .lastInsertRowid;
}

function insertInvestment({ title = 'Nifty Fund', currentAmount = 200000, owner_split_percent = 100 } = {}) {
    return nativeDb
        .prepare('INSERT INTO investments (title, currentAmount, owner_split_percent) VALUES (?, ?, ?)')
        .run(title, currentAmount, owner_split_percent)
        .lastInsertRowid;
}

function insertBankBalance({ bankName = 'HDFC Savings', balance = 100000 } = {}) {
    return nativeDb
        .prepare('INSERT INTO bank_balances (bankName, balance) VALUES (?, ?)')
        .run(bankName, balance)
        .lastInsertRowid;
}

function insertNpsAccount({ pranNumber = 'PRAN123', currentValue = 300000, owner_split_percent = 100 } = {}) {
    return nativeDb
        .prepare('INSERT INTO nps_accounts (pranNumber, currentValue, owner_split_percent) VALUES (?, ?, ?)')
        .run(pranNumber, currentValue, owner_split_percent)
        .lastInsertRowid;
}

function insertGoldHolding({ title = '22K Biscuit', weightGrams = 10, currentPricePerGram = 6000, owner_split_percent = 100 } = {}) {
    return nativeDb
        .prepare('INSERT INTO gold_holdings (title, weightGrams, currentPricePerGram, owner_split_percent) VALUES (?, ?, ?, ?)')
        .run(title, weightGrams, currentPricePerGram, owner_split_percent)
        .lastInsertRowid;
}

function insertSinkingFund({ title = 'Emergency Fund', currentAmount = 50000, owner_split_percent = 100 } = {}) {
    return nativeDb
        .prepare('INSERT INTO sinking_funds (title, currentAmount, owner_split_percent) VALUES (?, ?, ?)')
        .run(title, currentAmount, owner_split_percent)
        .lastInsertRowid;
}

function insertNomineeRaw({ name, relationship, family_member_id, assetType, assetId, assetDescription, sharePercent, notes = '' }) {
    return nativeDb
        .prepare('INSERT INTO nominees (name, relationship, family_member_id, assetType, assetId, assetDescription, sharePercent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(name, relationship, family_member_id, assetType, assetId, assetDescription, sharePercent, notes)
        .lastInsertRowid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────

const TABLES = [
    'nominees',
    'family_members',
    'real_estate',
    'fixed_deposits',
    'investments',
    'bank_balances',
    'nps_accounts',
    'gold_holdings',
    'sinking_funds',
    'ledger_lines',
    'audit_logs',
];

beforeAll(() => {
    TABLES.forEach(t => nativeDb.prepare(`DELETE FROM ${t}`).run());
});

afterEach(() => {
    TABLES.forEach(t => nativeDb.prepare(`DELETE FROM ${t}`).run());
});

// ─────────────────────────────────────────────────────────────────────────────
// getAssignableAssets
// ─────────────────────────────────────────────────────────────────────────────

describe('getAssignableAssets', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    test('returns empty asset list when all tables are empty', () => {
        const result = successionService.getAssignableAssets();
        expect(result).toEqual({ assets: [] });
    });

    // ── Real Estate ──────────────────────────────────────────────────────────

    test('includes a 100%-owned real estate asset at full value', () => {
        insertRealEstate({ title: 'Villa', currentMarketValue: 2000000 });
        const { assets } = successionService.getAssignableAssets();
        const prop = assets.find(a => a.type === 'Property');
        expect(prop).toBeDefined();
        expect(prop.description).toBe('Villa');
        expect(prop.value).toBeCloseTo(2000000);
    });

    test('applies split percent to real estate value', () => {
        insertRealEstate({ title: 'Flat', currentMarketValue: 1000000, owner_split_percent: 50 });
        const { assets } = successionService.getAssignableAssets();
        const prop = assets.find(a => a.type === 'Property');
        expect(prop.description).toContain('50% Share');
        expect(prop.value).toBeCloseTo(500000);
    });

    test('deducts linked loan balance from real estate net value', () => {
        const loanEntityId = 42;
        nativeDb.prepare(
            "INSERT INTO ledger_lines (account_class, account_type, entity_id, credit_amount, debit_amount) VALUES ('Liability', 'loan', ?, ?, ?)"
        ).run(loanEntityId, 300000, 0);

        insertRealEstate({ title: 'Mortgaged Flat', currentMarketValue: 1000000, linkedLoanId: loanEntityId });
        const { assets } = successionService.getAssignableAssets();
        const prop = assets.find(a => a.type === 'Property');
        expect(prop.description).toContain('Net of Debt');
        // net = 1000000 - 300000 = 700000
        expect(prop.value).toBeCloseTo(700000);
    });

    test('deducts split-portion of loan when owner has partial share', () => {
        const loanEntityId = 55;
        nativeDb.prepare(
            "INSERT INTO ledger_lines (account_class, account_type, entity_id, credit_amount, debit_amount) VALUES ('Liability', 'loan', ?, ?, ?)"
        ).run(loanEntityId, 200000, 0);

        insertRealEstate({ title: 'Joint Mortgaged', currentMarketValue: 1000000, linkedLoanId: loanEntityId, owner_split_percent: 50 });
        const { assets } = successionService.getAssignableAssets();
        const prop = assets.find(a => a.type === 'Property');
        // gross = 1000000 * 50% = 500000; debt = 200000 * 50% = 100000 => net = 400000
        expect(prop.value).toBeCloseTo(400000);
    });

    test('real estate with no market value returns 0', () => {
        insertRealEstate({ title: 'Empty Land', currentMarketValue: 0 });
        const { assets } = successionService.getAssignableAssets();
        const prop = assets.find(a => a.type === 'Property');
        expect(prop.value).toBe(0);
    });

    test('real estate without loan does not label Net of Debt', () => {
        insertRealEstate({ title: 'Clear Property', currentMarketValue: 500000 });
        const { assets } = successionService.getAssignableAssets();
        const prop = assets.find(a => a.type === 'Property');
        expect(prop.description).not.toContain('Net of Debt');
    });

    // ── Fixed Deposits ───────────────────────────────────────────────────────

    test('includes fixed deposit entry', () => {
        insertFixedDeposit({ bankName: 'ICICI FD', principal: 600000 });
        const { assets } = successionService.getAssignableAssets();
        const fd = assets.find(a => a.type === 'Fixed Deposit');
        expect(fd).toBeDefined();
        expect(fd.description).toContain('ICICI FD');
        expect(typeof fd.value).toBe('number');
    });

    test('fixed deposit applies split percent label', () => {
        insertFixedDeposit({ bankName: 'Axis FD', principal: 400000, owner_split_percent: 60 });
        const { assets } = successionService.getAssignableAssets();
        const fd = assets.find(a => a.type === 'Fixed Deposit');
        expect(fd.description).toContain('60% Share');
    });

    test('fixed deposit without split does not show share label', () => {
        insertFixedDeposit({ bankName: 'SBI FD', principal: 200000, owner_split_percent: 100 });
        const { assets } = successionService.getAssignableAssets();
        const fd = assets.find(a => a.type === 'Fixed Deposit');
        expect(fd.description).not.toContain('Share');
    });

    // ── Investments ──────────────────────────────────────────────────────────

    test('includes investment asset entry', () => {
        insertInvestment({ title: 'Nifty 50 Index', currentAmount: 150000 });
        const { assets } = successionService.getAssignableAssets();
        const inv = assets.find(a => a.type === 'Investment');
        expect(inv).toBeDefined();
        expect(typeof inv.value).toBe('number');
    });

    test('investment applies split percent in description', () => {
        insertInvestment({ title: 'Equity Fund', currentAmount: 100000, owner_split_percent: 70 });
        const { assets } = successionService.getAssignableAssets();
        const inv = assets.find(a => a.type === 'Investment');
        expect(inv.description).toContain('70% Share');
    });

    // ── Bank Balances ────────────────────────────────────────────────────────

    test('includes bank balance at correct value', () => {
        insertBankBalance({ bankName: 'SBI Savings', balance: 80000 });
        const { assets } = successionService.getAssignableAssets();
        const bank = assets.find(a => a.type === 'Bank Account');
        expect(bank).toBeDefined();
        expect(bank.description).toContain('SBI Savings');
        expect(bank.value).toBeCloseTo(80000);
    });

    test('bank balance applies split — always 100% (no split column in schema)', () => {
        insertBankBalance({ bankName: 'Solo Bank', balance: 200000 });
        const { assets } = successionService.getAssignableAssets();
        const bank = assets.find(a => a.type === 'Bank Account');
        // bank_balances has no owner_split_percent column so split is always 100
        expect(bank.value).toBeCloseTo(200000);
        expect(bank.description).not.toContain('Share');
    });

    test('bank balance with zero balance returns value 0', () => {
        insertBankBalance({ bankName: 'Empty Bank', balance: 0 });
        const { assets } = successionService.getAssignableAssets();
        const bank = assets.find(a => a.type === 'Bank Account');
        expect(bank.value).toBe(0);
    });

    // ── NPS Accounts ─────────────────────────────────────────────────────────

    test('includes NPS account entry with correct PRAN number in description', () => {
        insertNpsAccount({ pranNumber: 'PRAN001', currentValue: 400000 });
        const { assets } = successionService.getAssignableAssets();
        const nps = assets.find(a => a.type === 'NPS Account');
        expect(nps).toBeDefined();
        expect(typeof nps.value).toBe('number');
        // Service now correctly aliases pranNumber as pran
        expect(nps.description).toBe('PRAN: PRAN001');
    });

    test('NPS account applies split percent', () => {
        insertNpsAccount({ pranNumber: 'PRAN002', currentValue: 300000, owner_split_percent: 80 });
        const { assets } = successionService.getAssignableAssets();
        const nps = assets.find(a => a.type === 'NPS Account');
        expect(nps.description).toContain('80% Share');
        // value should be 300000 * 80% = 240000
        expect(nps.value).toBeCloseTo(240000);
    });

    // ── Gold Holdings ────────────────────────────────────────────────────────

    test('includes gold holding with computed total value (weightGrams * pricePerGram)', () => {
        insertGoldHolding({ title: '24K Bar', weightGrams: 10, currentPricePerGram: 6500 });
        const { assets } = successionService.getAssignableAssets();
        const gold = assets.find(a => a.type === 'Gold Holding');
        expect(gold).toBeDefined();
        // weightGrams * currentPricePerGram = 10 * 6500 = 65000
        expect(gold.value).toBeCloseTo(65000);
    });

    test('gold holding applies split percent', () => {
        insertGoldHolding({ title: 'Joint Gold', weightGrams: 20, currentPricePerGram: 5000, owner_split_percent: 50 });
        const { assets } = successionService.getAssignableAssets();
        const gold = assets.find(a => a.type === 'Gold Holding');
        // total = 20*5000 = 100000; split 50% => 50000
        expect(gold.value).toBeCloseTo(50000);
        expect(gold.description).toContain('50% Share');
    });

    test('gold holding with zero weight returns value 0', () => {
        insertGoldHolding({ title: 'Empty Gold', weightGrams: 0, currentPricePerGram: 6000 });
        const { assets } = successionService.getAssignableAssets();
        const gold = assets.find(a => a.type === 'Gold Holding');
        expect(gold.value).toBe(0);
    });

    // ── Sinking Funds ────────────────────────────────────────────────────────

    test('includes sinking fund at correct value', () => {
        insertSinkingFund({ title: 'Vacation Fund', currentAmount: 75000 });
        const { assets } = successionService.getAssignableAssets();
        const sf = assets.find(a => a.type === 'Sinking Fund');
        expect(sf).toBeDefined();
        expect(sf.description).toContain('Vacation Fund');
        expect(sf.value).toBeCloseTo(75000);
    });

    test('sinking fund applies split percent', () => {
        insertSinkingFund({ title: 'Joint Fund', currentAmount: 100000, owner_split_percent: 40 });
        const { assets } = successionService.getAssignableAssets();
        const sf = assets.find(a => a.type === 'Sinking Fund');
        expect(sf.value).toBeCloseTo(40000);
        expect(sf.description).toContain('40% Share');
    });

    // ── Multiple assets of different types ───────────────────────────────────

    test('returns assets from all 7 asset categories', () => {
        insertRealEstate();
        insertFixedDeposit();
        insertInvestment();
        insertBankBalance();
        insertNpsAccount();
        insertGoldHolding();
        insertSinkingFund();

        const { assets } = successionService.getAssignableAssets();
        const types = assets.map(a => a.type);
        expect(types).toContain('Property');
        expect(types).toContain('Fixed Deposit');
        expect(types).toContain('Investment');
        expect(types).toContain('Bank Account');
        expect(types).toContain('NPS Account');
        expect(types).toContain('Gold Holding');
        expect(types).toContain('Sinking Fund');
    });

    test('multiple rows of same type are all returned', () => {
        insertBankBalance({ bankName: 'Bank A', balance: 10000 });
        insertBankBalance({ bankName: 'Bank B', balance: 20000 });
        const { assets } = successionService.getAssignableAssets();
        const banks = assets.filter(a => a.type === 'Bank Account');
        expect(banks).toHaveLength(2);
    });

    test('each returned asset has id, type, description, value fields', () => {
        insertRealEstate({ title: 'Test Property', currentMarketValue: 100000 });
        const { assets } = successionService.getAssignableAssets();
        const prop = assets[0];
        expect(prop).toHaveProperty('id');
        expect(prop).toHaveProperty('type');
        expect(prop).toHaveProperty('description');
        expect(prop).toHaveProperty('value');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// getSuccessionSummary
// ─────────────────────────────────────────────────────────────────────────────

describe('getSuccessionSummary', () => {
    test('returns empty nominees list and 0 completeness when no data', () => {
        const result = successionService.getSuccessionSummary();
        expect(result.nominees).toEqual([]);
        expect(result.completeness).toBe(0);
    });

    test('nominees include joined family_member_name and family_member_role', () => {
        const memberId = insertFamilyMember('Bob', 'Son');
        const reId = insertRealEstate({ title: 'House' });
        insertNomineeRaw({
            name: 'Bob',
            relationship: 'Son',
            family_member_id: memberId,
            assetType: 'Property',
            assetId: reId,
            assetDescription: 'House',
            sharePercent: 100,
        });

        const { nominees } = successionService.getSuccessionSummary();
        expect(nominees).toHaveLength(1);
        expect(nominees[0].family_member_name).toBe('Bob');
        expect(nominees[0].family_member_role).toBe('Son');
    });

    test('completeness is 100 when single asset is fully mapped', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const reId = insertRealEstate();
        insertNomineeRaw({
            name: 'Alice', relationship: 'Spouse',
            family_member_id: memberId,
            assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 100,
        });

        const { completeness } = successionService.getSuccessionSummary();
        expect(completeness).toBe(100);
    });

    test('completeness is 50 when 1 of 2 assets are mapped', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const reId = insertRealEstate({ title: 'House' });
        insertBankBalance({ bankName: 'Unmapped Bank', balance: 50000 });
        insertNomineeRaw({
            name: 'Alice', relationship: 'Spouse',
            family_member_id: memberId,
            assetType: 'Property', assetId: reId,
            assetDescription: 'House', sharePercent: 100,
        });

        const { completeness } = successionService.getSuccessionSummary();
        expect(completeness).toBe(50);
    });

    test('completeness does not exceed 100 even with two nominees splitting same asset', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const reId = insertRealEstate({ title: 'House' });
        insertNomineeRaw({
            name: 'Alice', relationship: 'Spouse',
            family_member_id: memberId,
            assetType: 'Property', assetId: reId,
            assetDescription: 'House', sharePercent: 60,
        });
        insertNomineeRaw({
            name: 'Alice', relationship: 'Spouse',
            family_member_id: memberId,
            assetType: 'Property', assetId: reId,
            assetDescription: 'House', sharePercent: 40,
        });

        const { completeness } = successionService.getSuccessionSummary();
        expect(completeness).toBeLessThanOrEqual(100);
    });

    test('General type nominees are excluded from completeness count', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        insertRealEstate(); // 1 asset that is NOT mapped
        insertNomineeRaw({
            name: 'Alice', relationship: 'Spouse',
            family_member_id: memberId,
            assetType: 'General', assetId: null,
            assetDescription: 'General Estate', sharePercent: 100,
        });

        const { completeness } = successionService.getSuccessionSummary();
        // 1 unmapped asset, 1 total => 0%
        expect(completeness).toBe(0);
    });

    test('nominees with non-existent family_member_id have null for joined fields', () => {
        insertNomineeRaw({
            name: 'Ghost', relationship: 'Unknown',
            family_member_id: 9999,
            assetType: 'General', assetId: null,
            assetDescription: '', sharePercent: 50,
        });

        const { nominees } = successionService.getSuccessionSummary();
        expect(nominees[0].family_member_name).toBeNull();
        expect(nominees[0].family_member_role).toBeNull();
    });

    test('multiple nominees are all returned', () => {
        const m1 = insertFamilyMember('Alice', 'Spouse');
        const m2 = insertFamilyMember('Bob', 'Son');
        const reId = insertRealEstate();
        insertNomineeRaw({
            name: 'Alice', relationship: 'Spouse',
            family_member_id: m1,
            assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 60,
        });
        insertNomineeRaw({
            name: 'Bob', relationship: 'Son',
            family_member_id: m2,
            assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 40,
        });

        const { nominees } = successionService.getSuccessionSummary();
        expect(nominees).toHaveLength(2);
    });

    test('completeness counts across all 7 asset types', () => {
        const memberId = insertFamilyMember('Eve', 'Spouse');
        const reId = insertRealEstate();
        const fdId = insertFixedDeposit();
        const invId = insertInvestment();
        const bankId = insertBankBalance();
        const npsId = insertNpsAccount();
        const goldId = insertGoldHolding();
        const sfId = insertSinkingFund();

        // Map all 7
        const types = [
            { type: 'Property', id: reId },
            { type: 'Fixed Deposit', id: fdId },
            { type: 'Investment', id: invId },
            { type: 'Bank Account', id: bankId },
            { type: 'NPS Account', id: npsId },
            { type: 'Gold Holding', id: goldId },
            { type: 'Sinking Fund', id: sfId },
        ];
        types.forEach(({ type, id }) => {
            insertNomineeRaw({
                name: 'Eve', relationship: 'Spouse',
                family_member_id: memberId,
                assetType: type, assetId: id,
                assetDescription: '', sharePercent: 100,
            });
        });

        const { completeness } = successionService.getSuccessionSummary();
        expect(completeness).toBe(100);
    });

    test('result object has nominees and completeness properties', () => {
        const result = successionService.getSuccessionSummary();
        expect(result).toHaveProperty('nominees');
        expect(result).toHaveProperty('completeness');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// createNominee
// ─────────────────────────────────────────────────────────────────────────────

describe('createNominee', () => {
    test('successfully creates a nominee for a real estate asset', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const reId = insertRealEstate();

        const result = successionService.createNominee({
            family_member_id: memberId,
            assetType: 'Property',
            assetId: reId,
            assetDescription: 'Home',
            sharePercent: 100,
            notes: 'Primary residence',
        });

        expect(result.success).toBe(true);
        expect(result.id).toBeGreaterThan(0);
    });

    test('successfully creates a General type nominee (no assetId required)', () => {
        const memberId = insertFamilyMember('Bob', 'Son');

        const result = successionService.createNominee({
            family_member_id: memberId,
            assetType: 'General',
            assetId: null,
            assetDescription: 'General Estate',
            sharePercent: 50,
            notes: '',
        });

        expect(result.success).toBe(true);
    });

    test('creates nominee for Fixed Deposit', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const fdId = insertFixedDeposit();
        const result = successionService.createNominee({
            family_member_id: memberId,
            assetType: 'Fixed Deposit',
            assetId: fdId,
            assetDescription: 'SBI FD',
            sharePercent: 100,
        });
        expect(result.success).toBe(true);
    });

    test('creates nominee for Investment', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const invId = insertInvestment();
        const result = successionService.createNominee({
            family_member_id: memberId,
            assetType: 'Investment',
            assetId: invId,
            assetDescription: 'Nifty Fund',
            sharePercent: 100,
        });
        expect(result.success).toBe(true);
    });

    test('creates nominee for Bank Account', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const bankId = insertBankBalance();
        const result = successionService.createNominee({
            family_member_id: memberId,
            assetType: 'Bank Account',
            assetId: bankId,
            assetDescription: 'HDFC Savings',
            sharePercent: 100,
        });
        expect(result.success).toBe(true);
    });

    test('creates nominee for NPS Account', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const npsId = insertNpsAccount();
        const result = successionService.createNominee({
            family_member_id: memberId,
            assetType: 'NPS Account',
            assetId: npsId,
            assetDescription: 'PRAN123',
            sharePercent: 100,
        });
        expect(result.success).toBe(true);
    });

    test('creates nominee for Gold Holding', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const goldId = insertGoldHolding();
        const result = successionService.createNominee({
            family_member_id: memberId,
            assetType: 'Gold Holding',
            assetId: goldId,
            assetDescription: '22K Biscuit',
            sharePercent: 100,
        });
        expect(result.success).toBe(true);
    });

    test('creates nominee for Sinking Fund', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const sfId = insertSinkingFund();
        const result = successionService.createNominee({
            family_member_id: memberId,
            assetType: 'Sinking Fund',
            assetId: sfId,
            assetDescription: 'Emergency Fund',
            sharePercent: 100,
        });
        expect(result.success).toBe(true);
    });

    test('splits share between two nominees for the same asset', () => {
        const m1 = insertFamilyMember('Alice', 'Spouse');
        const m2 = insertFamilyMember('Bob', 'Son');
        const reId = insertRealEstate();

        successionService.createNominee({ family_member_id: m1, assetType: 'Property', assetId: reId, assetDescription: 'Home', sharePercent: 60 });
        const result = successionService.createNominee({ family_member_id: m2, assetType: 'Property', assetId: reId, assetDescription: 'Home', sharePercent: 40 });

        expect(result.success).toBe(true);
    });

    test('throws when sharePercent is 0', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        expect(() => successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 0,
        })).toThrow('Share percentage must be strictly positive.');
    });

    test('throws when sharePercent is negative', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        expect(() => successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: -10,
        })).toThrow('Share percentage must be strictly positive.');
    });

    test('throws when sharePercent is non-numeric string (treated as 0)', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        expect(() => successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 'abc',
        })).toThrow('Share percentage must be strictly positive.');
    });

    test('throws when family_member_id does not exist', () => {
        const reId = insertRealEstate();
        expect(() => successionService.createNominee({
            family_member_id: 9999,
            assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 50,
        })).toThrow('Target family member does not exist.');
    });

    test('throws for invalid assetType', () => {
        const memberId = insertFamilyMember();
        expect(() => successionService.createNominee({
            family_member_id: memberId,
            assetType: 'CryptoWallet', assetId: 1,
            assetDescription: 'BTC', sharePercent: 50,
        })).toThrow('Invalid asset type forged.');
    });

    test('throws when asset does not exist in the ledger (orphan injection)', () => {
        const memberId = insertFamilyMember();
        expect(() => successionService.createNominee({
            family_member_id: memberId,
            assetType: 'Property', assetId: 99999,
            assetDescription: 'Ghost Property', sharePercent: 50,
        })).toThrow('Target asset does not exist in the ledger (Orphan Injection Blocked).');
    });

    test('throws when total share would exceed 100% for specific asset', () => {
        const m1 = insertFamilyMember('Alice', 'Spouse');
        const reId = insertRealEstate();
        successionService.createNominee({
            family_member_id: m1, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 70,
        });

        const m2 = insertFamilyMember('Bob', 'Son');
        expect(() => successionService.createNominee({
            family_member_id: m2, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 40, // 70 + 40 > 100
        })).toThrow('Total share percentage for this asset (or General Estate) cannot exceed 100%.');
    });

    test('throws when General estate shares total would exceed 100%', () => {
        const m1 = insertFamilyMember('Alice', 'Spouse');
        const m2 = insertFamilyMember('Bob', 'Son');
        successionService.createNominee({
            family_member_id: m1, assetType: 'General', assetId: null,
            assetDescription: '', sharePercent: 70,
        });

        expect(() => successionService.createNominee({
            family_member_id: m2, assetType: 'General', assetId: null,
            assetDescription: '', sharePercent: 40,
        })).toThrow('Total share percentage for this asset (or General Estate) cannot exceed 100%.');
    });

    test('writes an audit log entry on successful creation', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const reId = insertRealEstate();
        successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 100,
        });

        const log = nativeDb.prepare("SELECT * FROM audit_logs WHERE entity = 'succession_nominee' AND action = 'CREATE'").get();
        expect(log).toBeDefined();
        expect(log.details).toContain('Property');
    });

    test('nominee name and relationship are populated from family member table', () => {
        const memberId = insertFamilyMember('Charlie', 'Sibling');
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 100,
        });

        const nominee = nativeDb.prepare('SELECT * FROM nominees WHERE id = ?').get(id);
        expect(nominee.name).toBe('Charlie');
        expect(nominee.relationship).toBe('Sibling');
    });

    test('assetDescription defaults to empty string when not provided', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            sharePercent: 100,
        });
        const nominee = nativeDb.prepare('SELECT * FROM nominees WHERE id = ?').get(id);
        expect(nominee.assetDescription).toBe('');
    });

    test('notes defaults to empty string when not provided', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            sharePercent: 50,
        });
        const nominee = nativeDb.prepare('SELECT * FROM nominees WHERE id = ?').get(id);
        expect(nominee.notes).toBe('');
    });

    test('exactly 100% share is allowed for a single nominee', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const result = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 100,
        });
        expect(result.success).toBe(true);
    });

    test('fractional share percent is accepted', () => {
        const m1 = insertFamilyMember('Alice', 'Spouse');
        const m2 = insertFamilyMember('Bob', 'Son');
        const reId = insertRealEstate();
        successionService.createNominee({ family_member_id: m1, assetType: 'Property', assetId: reId, assetDescription: 'Home', sharePercent: 33.33 });
        const result = successionService.createNominee({ family_member_id: m2, assetType: 'Property', assetId: reId, assetDescription: 'Home', sharePercent: 33.33 });
        expect(result.success).toBe(true);
    });

    test('different assets can each have independent 100% nominees', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const bankId = insertBankBalance();

        const r1 = successionService.createNominee({ family_member_id: memberId, assetType: 'Property', assetId: reId, assetDescription: '', sharePercent: 100 });
        const r2 = successionService.createNominee({ family_member_id: memberId, assetType: 'Bank Account', assetId: bankId, assetDescription: '', sharePercent: 100 });
        expect(r1.success).toBe(true);
        expect(r2.success).toBe(true);
    });

    test('returned id corresponds to newly inserted nominee row', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 75,
        });
        const row = nativeDb.prepare('SELECT id FROM nominees WHERE id = ?').get(id);
        expect(row).toBeDefined();
        expect(row.id).toBe(id);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateNominee
// ─────────────────────────────────────────────────────────────────────────────

describe('updateNominee', () => {
    test('successfully updates share percent of an existing nominee', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 60,
        });

        const result = successionService.updateNominee(id, { sharePercent: 80 });
        expect(result.success).toBe(true);

        const row = nativeDb.prepare('SELECT sharePercent FROM nominees WHERE id = ?').get(id);
        expect(row.sharePercent).toBeCloseTo(80);
    });

    test('throws when nominee id does not exist', () => {
        expect(() => successionService.updateNominee(99999, { sharePercent: 50 }))
            .toThrow('Nominee not found.');
    });

    test('throws when new sharePercent is 0', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 50,
        });
        expect(() => successionService.updateNominee(id, { sharePercent: 0 }))
            .toThrow('Share percentage must be strictly positive.');
    });

    test('throws when new sharePercent is negative', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 50,
        });
        expect(() => successionService.updateNominee(id, { sharePercent: -5 }))
            .toThrow('Share percentage must be strictly positive.');
    });

    test('throws when new share combined with others would exceed 100%', () => {
        const m1 = insertFamilyMember('Alice', 'Spouse');
        const m2 = insertFamilyMember('Bob', 'Son');
        const reId = insertRealEstate();

        const { id: id1 } = successionService.createNominee({
            family_member_id: m1, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 70,
        });
        const { id: id2 } = successionService.createNominee({
            family_member_id: m2, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 30,
        });

        // Try to update id2 to 40 => 70 + 40 = 110 > 100
        expect(() => successionService.updateNominee(id2, { sharePercent: 40 }))
            .toThrow('Total share percentage for this asset (or General Estate) cannot exceed 100%.');
    });

    test('throws when General nominee update would push total over 100%', () => {
        const m1 = insertFamilyMember('Alice', 'Spouse');
        const m2 = insertFamilyMember('Bob', 'Son');

        const { id: id1 } = successionService.createNominee({
            family_member_id: m1, assetType: 'General', assetId: null,
            assetDescription: '', sharePercent: 70,
        });
        const { id: id2 } = successionService.createNominee({
            family_member_id: m2, assetType: 'General', assetId: null,
            assetDescription: '', sharePercent: 30,
        });

        expect(() => successionService.updateNominee(id2, { sharePercent: 50 }))
            .toThrow('Total share percentage for this asset (or General Estate) cannot exceed 100%.');
    });

    test('allows update to exactly 100% when no other nominees for that asset', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 50,
        });
        const result = successionService.updateNominee(id, { sharePercent: 100 });
        expect(result.success).toBe(true);
    });

    test('allows updating own share to different value within limits', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 40,
        });
        const result = successionService.updateNominee(id, { sharePercent: 40 });
        expect(result.success).toBe(true);
    });

    test('writes an audit log on successful update with old and new share', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 60,
        });

        nativeDb.prepare("DELETE FROM audit_logs").run();
        successionService.updateNominee(id, { sharePercent: 80 });

        const log = nativeDb.prepare("SELECT * FROM audit_logs WHERE entity = 'succession_nominee' AND action = 'UPDATE'").get();
        expect(log).toBeDefined();
        const details = JSON.parse(log.details);
        expect(details.old_share).toBeCloseTo(60);
        expect(details.new_share).toBeCloseTo(80);
    });

    test('string sharePercent that parses to valid number is accepted', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 50,
        });
        const result = successionService.updateNominee(id, { sharePercent: '75' });
        expect(result.success).toBe(true);
        const row = nativeDb.prepare('SELECT sharePercent FROM nominees WHERE id = ?').get(id);
        expect(row.sharePercent).toBeCloseTo(75);
    });

    test('update does not change other fields like name, assetType etc.', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 50,
        });
        successionService.updateNominee(id, { sharePercent: 75 });
        const row = nativeDb.prepare('SELECT * FROM nominees WHERE id = ?').get(id);
        expect(row.name).toBe('Alice');
        expect(row.assetType).toBe('Property');
        expect(row.assetId).toBe(reId);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteNominee
// ─────────────────────────────────────────────────────────────────────────────

describe('deleteNominee', () => {
    test('successfully deletes an existing nominee', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 100,
        });

        const result = successionService.deleteNominee(id);
        expect(result.success).toBe(true);

        const row = nativeDb.prepare('SELECT * FROM nominees WHERE id = ?').get(id);
        expect(row).toBeUndefined();
    });

    test('returns success even when nominee id does not exist', () => {
        const result = successionService.deleteNominee(99999);
        expect(result.success).toBe(true);
    });

    test('writes an audit log when a nominee is deleted', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 100,
        });

        nativeDb.prepare("DELETE FROM audit_logs").run();
        successionService.deleteNominee(id);

        const log = nativeDb.prepare("SELECT * FROM audit_logs WHERE entity = 'succession_nominee' AND action = 'DELETE'").get();
        expect(log).toBeDefined();
        expect(log.entity_id).toBe(id);
    });

    test('does NOT write an audit log when nominee id did not exist', () => {
        nativeDb.prepare("DELETE FROM audit_logs").run();
        successionService.deleteNominee(99999);

        const log = nativeDb.prepare("SELECT * FROM audit_logs WHERE entity = 'succession_nominee' AND action = 'DELETE'").get();
        expect(log).toBeUndefined();
    });

    test('after deleting, freed share allows a new nominee to take 100%', () => {
        const m1 = insertFamilyMember('Alice', 'Spouse');
        const m2 = insertFamilyMember('Bob', 'Son');
        const reId = insertRealEstate();

        const { id: id1 } = successionService.createNominee({
            family_member_id: m1, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 60,
        });
        successionService.deleteNominee(id1);

        // Now 60% should be free again; Bob can take 100%
        const result = successionService.createNominee({
            family_member_id: m2, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 100,
        });
        expect(result.success).toBe(true);
    });

    test('deletes only the specified nominee, not others sharing the same asset', () => {
        const m1 = insertFamilyMember('Alice', 'Spouse');
        const m2 = insertFamilyMember('Bob', 'Son');
        const reId = insertRealEstate();

        const { id: id1 } = successionService.createNominee({
            family_member_id: m1, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 60,
        });
        const { id: id2 } = successionService.createNominee({
            family_member_id: m2, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 40,
        });

        successionService.deleteNominee(id1);

        const remaining = nativeDb.prepare('SELECT * FROM nominees').all();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].id).toBe(id2);
    });

    test('audit log details include family_member_id, assetType, and assetId', () => {
        const memberId = insertFamilyMember('Alice', 'Spouse');
        const reId = insertRealEstate();
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 100,
        });

        nativeDb.prepare("DELETE FROM audit_logs").run();
        successionService.deleteNominee(id);

        const log = nativeDb.prepare("SELECT * FROM audit_logs WHERE action = 'DELETE'").get();
        const details = JSON.parse(log.details);
        expect(details.family_member_id).toBe(memberId);
        expect(details.assetType).toBe('Property');
        expect(details.assetId).toBe(reId);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: full lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('Full lifecycle integration', () => {
    test('create → summary → update → delete flow', () => {
        const memberId = insertFamilyMember('Diana', 'Daughter');
        const reId = insertRealEstate({ title: 'Beach House', currentMarketValue: 5000000 });

        // Create
        const { id } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Beach House', sharePercent: 100,
        });
        expect(id).toBeGreaterThan(0);

        // Summary shows 100% completeness
        let summary = successionService.getSuccessionSummary();
        expect(summary.completeness).toBe(100);
        expect(summary.nominees).toHaveLength(1);

        // Update share to 80
        successionService.updateNominee(id, { sharePercent: 80 });
        const updated = nativeDb.prepare('SELECT sharePercent FROM nominees WHERE id = ?').get(id);
        expect(updated.sharePercent).toBeCloseTo(80);

        // Delete
        successionService.deleteNominee(id);
        summary = successionService.getSuccessionSummary();
        expect(summary.nominees).toHaveLength(0);
        expect(summary.completeness).toBe(0);
    });

    test('multiple asset types contribute independently to completeness', () => {
        const memberId = insertFamilyMember('Eve', 'Spouse');
        const reId = insertRealEstate();
        insertBankBalance();
        insertSinkingFund();

        // Map only real estate
        successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 100,
        });

        const { completeness } = successionService.getSuccessionSummary();
        // 1 of 3 assets mapped
        expect(completeness).toBeGreaterThan(0);
        expect(completeness).toBeLessThan(100);
    });

    test('getAssignableAssets and getSuccessionSummary stay consistent after mutations', () => {
        const memberId = insertFamilyMember();
        const reId = insertRealEstate({ currentMarketValue: 1000000 });
        const bankId = insertBankBalance({ balance: 200000 });

        // Assign real estate
        const { id: nomId } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Property', assetId: reId,
            assetDescription: 'Home', sharePercent: 100,
        });

        const { assets } = successionService.getAssignableAssets();
        expect(assets.length).toBe(2);

        let { completeness } = successionService.getSuccessionSummary();
        expect(completeness).toBe(50); // 1/2 assets mapped

        // Now also assign bank
        const { id: bankNomId } = successionService.createNominee({
            family_member_id: memberId, assetType: 'Bank Account', assetId: bankId,
            assetDescription: 'HDFC', sharePercent: 100,
        });

        ({ completeness } = successionService.getSuccessionSummary());
        expect(completeness).toBe(100);

        // Delete one and check again
        successionService.deleteNominee(nomId);
        ({ completeness } = successionService.getSuccessionSummary());
        expect(completeness).toBe(50);
    });
});
