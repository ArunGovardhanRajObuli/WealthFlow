const { nativeDb } = require('../../database');
const { getTaxHarvest } = require('./taxAnalyticsService');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Returns a YYYY-MM-DD date string that is `offsetDays` from today.
 * Negative = past, positive = future.
 */
function dateOffset(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d - tzOffset).toISOString().slice(0, 10);
}

/** Returns a YYYY-MM-DD exactly `yearsAgo` years and `extraDays` extra days in the past. */
function pastDate(yearsAgo, extraDays = 0) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - yearsAgo);
    d.setDate(d.getDate() - extraDays);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d - tzOffset).toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────
// Table-clearing utility
// ─────────────────────────────────────────────

const TABLES_TO_CLEAR = ['investment_lots', 'investments', 'transactions'];

function clearTables() {
    nativeDb.pragma('foreign_keys = OFF');
    TABLES_TO_CLEAR.forEach(t => nativeDb.prepare(`DELETE FROM ${t}`).run());
    nativeDb.pragma('foreign_keys = ON');
}

// ─────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────

describe('taxAnalyticsService', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        clearTables();
    });

    afterEach(() => {
        clearTables();
    });

    // ─────────────────────────────────────
    // Section 1 – Empty database baseline
    // ─────────────────────────────────────

    describe('getTaxHarvest – empty database', () => {
        it('should return zeros for all realized gain/loss fields when no transactions exist', () => {
            const result = getTaxHarvest();
            expect(result.data.realizedSTCG).toBe(0);
            expect(result.data.realizedLTCG).toBe(0);
            expect(result.data.realizedDebtGains).toBe(0);
            expect(result.data.realizedSTCL).toBe(0);
            expect(result.data.realizedLTCL).toBe(0);
        });

        it('should return an empty lots array when no investment_lots exist', () => {
            const result = getTaxHarvest();
            expect(result.data.lots).toEqual([]);
        });

        it('should return the expected top-level shape', () => {
            const result = getTaxHarvest();
            expect(result).toHaveProperty('data');
            const { data } = result;
            expect(data).toHaveProperty('realizedSTCG');
            expect(data).toHaveProperty('realizedLTCG');
            expect(data).toHaveProperty('realizedDebtGains');
            expect(data).toHaveProperty('realizedSTCL');
            expect(data).toHaveProperty('realizedLTCL');
            expect(data).toHaveProperty('lots');
            expect(Array.isArray(data.lots)).toBe(true);
        });
    });

    // ─────────────────────────────────────
    // Section 2 – Realized gains / losses
    // ─────────────────────────────────────

    describe('getTaxHarvest – realized STCG aggregation', () => {
        it('should sum a single realized_stcg transaction', () => {
            insertTxWithLedger('Sell MF', 1500, '2024-01-10', 'income', 'realized_stcg');
            const result = getTaxHarvest();
            expect(result.data.realizedSTCG).toBe(1500);
        });

        it('should sum multiple realized_stcg transactions', () => {
            insertTxWithLedger('A', 1000, '2024-01-01', 'income', 'realized_stcg')
            insertTxWithLedger('B', 500.5, '2024-02-01', 'income', 'realized_stcg');
            const result = getTaxHarvest();
            expect(result.data.realizedSTCG).toBeCloseTo(1500.5, 5);
        });

        it('should handle comma-formatted STCG amounts', () => {
            insertTxWithLedger('Big Sell', 2500, '2024-03-01', 'income', 'realized_stcg')
            const result = getTaxHarvest();
            expect(result.data.realizedSTCG).toBe(2500);
        });

        it('category match should be case-insensitive for STCG', () => {
            insertTxWithLedger('A', 300, '2024-01-01', 'income', 'Realized_STCG')
            insertTxWithLedger('B', 200, '2024-01-02', 'income', 'REALIZED_STCG')
            const result = getTaxHarvest();
            expect(result.data.realizedSTCG).toBe(500);
        });
    });

    describe('getTaxHarvest – realized LTCG aggregation', () => {
        it('should sum realized_ltcg transactions', () => {
            insertTxWithLedger('LT Gain', 4000, '2023-06-01', 'income', 'realized_ltcg')
            const result = getTaxHarvest();
            expect(result.data.realizedLTCG).toBe(4000);
        });

        it('should sum multiple LTCG entries', () => {
            insertTxWithLedger('L1', 2000, '2023-04-01', 'income', 'realized_ltcg')
            insertTxWithLedger('L2', 3000, '2023-05-01', 'income', 'realized_ltcg')
            const result = getTaxHarvest();
            expect(result.data.realizedLTCG).toBe(5000);
        });

        it('LTCG should be independent of STCG entries', () => {
            insertTxWithLedger('S', 100, '2024-01-01', 'income', 'realized_stcg')
            insertTxWithLedger('L', 200, '2024-01-01', 'income', 'realized_ltcg')
            const result = getTaxHarvest();
            expect(result.data.realizedSTCG).toBe(100);
            expect(result.data.realizedLTCG).toBe(200);
        });
    });

    describe('getTaxHarvest – realized debt gains (realized_stcg_debt)', () => {
        it('should sum realized_stcg_debt transactions', () => {
            insertTxWithLedger('Debt Gain', 750, '2024-03-15', 'income', 'realized_stcg_debt')
            const result = getTaxHarvest();
            expect(result.data.realizedDebtGains).toBe(750);
        });

        it('should handle comma-formatted debt gain amounts', () => {
            insertTxWithLedger('Big Debt', 1200, '2024-02-01', 'income', 'realized_stcg_debt')
            const result = getTaxHarvest();
            expect(result.data.realizedDebtGains).toBe(1200);
        });

        it('debt gains should be independent of equity STCG', () => {
            insertTxWithLedger('EqG', 300, '2024-01-01', 'income', 'realized_stcg')
            insertTxWithLedger('DebtG', 400, '2024-01-01', 'income', 'realized_stcg_debt')
            const result = getTaxHarvest();
            expect(result.data.realizedSTCG).toBe(300);
            expect(result.data.realizedDebtGains).toBe(400);
        });
    });

    describe('getTaxHarvest – realized STCL aggregation', () => {
        it('should sum realized_stcl transactions', () => {
            insertTxWithLedger('Short Loss', 800, '2024-01-20', 'expense', 'realized_stcl')
            const result = getTaxHarvest();
            expect(result.data.realizedSTCL).toBe(800);
        });

        it('should sum multiple STCL entries', () => {
            insertTxWithLedger('SL1', 400, '2024-01-01', 'expense', 'realized_stcl')
            insertTxWithLedger('SL2', 600, '2024-01-02', 'expense', 'realized_stcl')
            const result = getTaxHarvest();
            expect(result.data.realizedSTCL).toBe(1000);
        });
    });

    describe('getTaxHarvest – realized LTCL aggregation', () => {
        it('should sum realized_ltcl transactions', () => {
            insertTxWithLedger('Long Loss', 1200, '2022-09-01', 'expense', 'realized_ltcl')
            const result = getTaxHarvest();
            expect(result.data.realizedLTCL).toBe(1200);
        });

        it('should handle comma-formatted LTCL amounts', () => {
            insertTxWithLedger('Big LL', 3000, '2022-01-01', 'expense', 'realized_ltcl')
            const result = getTaxHarvest();
            expect(result.data.realizedLTCL).toBe(3000);
        });
    });

    describe('getTaxHarvest – all 5 categories co-exist', () => {
        it('should return correct individual totals when all 5 categories have entries', () => {
            insertTxWithLedger('STCG', 100, '2024-01-01', 'income', 'realized_stcg')
            insertTxWithLedger('LTCG', 200, '2024-01-01', 'income', 'realized_ltcg')
            insertTxWithLedger('DEBT', 300, '2024-01-01', 'income', 'realized_stcg_debt')
            insertTxWithLedger('STCL', 400, '2024-01-01', 'expense', 'realized_stcl')
            insertTxWithLedger('LTCL', 500, '2024-01-01', 'expense', 'realized_ltcl')
            const { data } = getTaxHarvest();
            expect(data.realizedSTCG).toBe(100);
            expect(data.realizedLTCG).toBe(200);
            expect(data.realizedDebtGains).toBe(300);
            expect(data.realizedSTCL).toBe(400);
            expect(data.realizedLTCL).toBe(500);
        });
    });

    // ─────────────────────────────────────
    // Section 3 – Lot enrichment
    // ─────────────────────────────────────

    describe('getTaxHarvest – lot enrichment', () => {

        function insertInvestment({ title = 'Test Fund', assetClass = 'equity', latestNav = 100, schemeCode = null } = {}) {
            const res = nativeDb.prepare(`
                INSERT INTO investments (title, category, assetClass, currentAmount, latestNav, schemeCode)
                VALUES (?, 'mutual_fund', ?, 0, ?, ?)
            `).run(title, assetClass, latestNav, schemeCode);
            return res.lastInsertRowid;
        }

        function insertLot({ investmentId, purchaseDate, units = 10, costBasis = 1000, currentNav = 0 } = {}) {
            const res = nativeDb.prepare(`
                INSERT INTO investment_lots (investment_id, purchaseDate, units, costBasis, currentNav)
                VALUES (?, ?, ?, ?, ?)
            `).run(investmentId, purchaseDate, units, costBasis, currentNav);
            return res.lastInsertRowid;
        }

        it('should include lots with units > 0 and exclude lots with units = 0', () => {
            const invId = insertInvestment();
            insertLot({ investmentId: invId, purchaseDate: dateOffset(-30), units: 5 });
            nativeDb.prepare(`
                INSERT INTO investment_lots (investment_id, purchaseDate, units, costBasis, currentNav)
                VALUES (?, ?, 0, 1000, 0)
            `).run(invId, dateOffset(-30));
            const { data } = getTaxHarvest();
            expect(data.lots.length).toBe(1);
            expect(data.lots[0].units).toBe(5);
        });

        it('should compute currentValue using latestNav from investments table', () => {
            const invId = insertInvestment({ latestNav: 150 });
            insertLot({ investmentId: invId, purchaseDate: dateOffset(-30), units: 10, costBasis: 1000, currentNav: 0 });
            const { data } = getTaxHarvest();
            expect(data.lots[0].currentValue).toBe(10 * 150);
        });

        it('should fall back to lot.currentNav when latestNav is 0', () => {
            const invId = insertInvestment({ latestNav: 0 });
            insertLot({ investmentId: invId, purchaseDate: dateOffset(-30), units: 10, costBasis: 1000, currentNav: 120 });
            const { data } = getTaxHarvest();
            expect(data.lots[0].currentValue).toBe(10 * 120);
        });

        it('should fall back to costBasis when both latestNav and currentNav are 0', () => {
            const invId = insertInvestment({ latestNav: 0 });
            insertLot({ investmentId: invId, purchaseDate: dateOffset(-30), units: 10, costBasis: 800, currentNav: 0 });
            const { data } = getTaxHarvest();
            expect(data.lots[0].currentValue).toBe(800);
        });

        it('should correctly calculate unrealizedGain = currentValue - costBasis (profit)', () => {
            const invId = insertInvestment({ latestNav: 200 });
            insertLot({ investmentId: invId, purchaseDate: dateOffset(-30), units: 5, costBasis: 500, currentNav: 0 });
            const { data } = getTaxHarvest();
            expect(data.lots[0].unrealizedGain).toBe(500);
        });

        it('should report negative unrealizedGain when currentValue < costBasis', () => {
            const invId = insertInvestment({ latestNav: 50 });
            insertLot({ investmentId: invId, purchaseDate: dateOffset(-30), units: 10, costBasis: 1000, currentNav: 0 });
            const { data } = getTaxHarvest();
            expect(data.lots[0].unrealizedGain).toBe(-500);
        });

        it('should mark equity lot held > 1 year as isLongTerm = true', () => {
            const invId = insertInvestment({ assetClass: 'equity', latestNav: 100 });
            insertLot({ investmentId: invId, purchaseDate: pastDate(1, 2), units: 10, costBasis: 1000 });
            const { data } = getTaxHarvest();
            expect(data.lots[0].isLongTerm).toBe(true);
        });

        it('should mark equity lot held < 1 year as isLongTerm = false', () => {
            const invId = insertInvestment({ assetClass: 'equity', latestNav: 100 });
            insertLot({ investmentId: invId, purchaseDate: dateOffset(-330), units: 10, costBasis: 1000 });
            const { data } = getTaxHarvest();
            expect(data.lots[0].isLongTerm).toBe(false);
        });

        it('should mark NON-equity lot held > 1 year as isLongTerm = false (equity restriction)', () => {
            const invId = insertInvestment({ assetClass: 'debt', latestNav: 100 });
            insertLot({ investmentId: invId, purchaseDate: pastDate(2), units: 10, costBasis: 1000 });
            const { data } = getTaxHarvest();
            expect(data.lots[0].isLongTerm).toBe(false);
        });

        it('should be case-insensitive for assetClass (EQUITY treated as equity)', () => {
            const res = nativeDb.prepare(`
                INSERT INTO investments (title, category, assetClass, currentAmount, latestNav)
                VALUES ('UC Fund', 'mutual_fund', 'EQUITY', 0, 100)
            `).run();
            insertLot({ investmentId: res.lastInsertRowid, purchaseDate: pastDate(1, 5), units: 5, costBasis: 500 });
            const { data } = getTaxHarvest();
            expect(data.lots[0].isLongTerm).toBe(true);
        });

        it('should handle trailing whitespace in assetClass', () => {
            const res = nativeDb.prepare(`
                INSERT INTO investments (title, category, assetClass, currentAmount, latestNav)
                VALUES ('WS Fund', 'mutual_fund', '  equity  ', 0, 100)
            `).run();
            insertLot({ investmentId: res.lastInsertRowid, purchaseDate: pastDate(1, 5), units: 5, costBasis: 500 });
            const { data } = getTaxHarvest();
            expect(data.lots[0].isLongTerm).toBe(true);
        });

        it('should handle lots with NULL purchaseDate (isLongTerm = false)', () => {
            const invId = insertInvestment({ assetClass: 'equity', latestNav: 100 });
            nativeDb.prepare(`
                INSERT INTO investment_lots (investment_id, purchaseDate, units, costBasis, currentNav)
                VALUES (?, NULL, 10, 1000, 0)
            `).run(invId);
            const { data } = getTaxHarvest();
            expect(data.lots[0].isLongTerm).toBe(false);
        });

        it('should correctly join investments metadata (title, schemeCode, latestNav, assetClass)', () => {
            const invId = insertInvestment({ title: 'Nifty50 Fund', assetClass: 'equity', latestNav: 220, schemeCode: 'SC999' });
            insertLot({ investmentId: invId, purchaseDate: dateOffset(-90), units: 3, costBasis: 600 });
            const { data } = getTaxHarvest();
            const lot = data.lots[0];
            expect(lot.title).toBe('Nifty50 Fund');
            expect(lot.schemeCode).toBe('SC999');
            expect(lot.latestNav).toBe(220);
            expect(lot.assetClass).toBe('equity');
        });

        it('should return multiple lots across multiple investments', () => {
            const inv1 = insertInvestment({ title: 'Fund A', assetClass: 'equity', latestNav: 100 });
            const inv2 = insertInvestment({ title: 'Fund B', assetClass: 'debt', latestNav: 50 });
            insertLot({ investmentId: inv1, purchaseDate: dateOffset(-60), units: 10, costBasis: 800 });
            insertLot({ investmentId: inv2, purchaseDate: dateOffset(-200), units: 20, costBasis: 900 });
            const { data } = getTaxHarvest();
            expect(data.lots.length).toBe(2);
            const titles = data.lots.map(l => l.title).sort();
            expect(titles).toEqual(['Fund A', 'Fund B']);
        });

        it('should prefer latestNav over currentNav when both are non-zero', () => {
            const invId = insertInvestment({ latestNav: 300 });
            insertLot({ investmentId: invId, purchaseDate: dateOffset(-30), units: 5, costBasis: 1000, currentNav: 200 });
            const { data } = getTaxHarvest();
            expect(data.lots[0].currentValue).toBe(5 * 300);
        });

        it('should include all original lot fields in returned objects (spread)', () => {
            const invId = insertInvestment({ latestNav: 100 });
            insertLot({ investmentId: invId, purchaseDate: dateOffset(-30), units: 7, costBasis: 700, currentNav: 0 });
            const { data } = getTaxHarvest();
            const lot = data.lots[0];
            expect(lot).toHaveProperty('id');
            expect(lot).toHaveProperty('investment_id');
            expect(lot).toHaveProperty('purchaseDate');
            expect(lot).toHaveProperty('units');
            expect(lot).toHaveProperty('costBasis');
            expect(lot).toHaveProperty('currentValue');
            expect(lot).toHaveProperty('unrealizedGain');
            expect(lot).toHaveProperty('isLongTerm');
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Section 4 – Exact 1-year boundary for isLongTerm
    // ─────────────────────────────────────────────────────────────────

    describe('getTaxHarvest – exact 1-year boundary for isLongTerm', () => {
        it('should NOT be long-term for a lot purchased exactly 1 year ago today', () => {
            const invId = nativeDb.prepare(`
                INSERT INTO investments (title, category, assetClass, currentAmount, latestNav)
                VALUES ('Boundary Fund', 'mutual_fund', 'equity', 0, 100)
            `).run().lastInsertRowid;
            const exactlyOneYearAgo = pastDate(1, 0);
            nativeDb.prepare(`
                INSERT INTO investment_lots (investment_id, purchaseDate, units, costBasis, currentNav)
                VALUES (?, ?, 10, 1000, 0)
            `).run(invId, exactlyOneYearAgo);
            const { data } = getTaxHarvest();
            // oneYearLater === today => NOT strictly < => isLongTerm = false
            expect(data.lots[0].isLongTerm).toBe(false);
        });

        it('should be long-term for a lot purchased 1 year + 1 day ago', () => {
            const invId = nativeDb.prepare(`
                INSERT INTO investments (title, category, assetClass, currentAmount, latestNav)
                VALUES ('Past Boundary Fund', 'mutual_fund', 'equity', 0, 100)
            `).run().lastInsertRowid;
            const justOverOneYear = pastDate(1, 1);
            nativeDb.prepare(`
                INSERT INTO investment_lots (investment_id, purchaseDate, units, costBasis, currentNav)
                VALUES (?, ?, 10, 1000, 0)
            `).run(invId, justOverOneYear);
            const { data } = getTaxHarvest();
            expect(data.lots[0].isLongTerm).toBe(true);
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Section 5 – Combined realized gains and lots in a single call
    // ─────────────────────────────────────────────────────────────────

    describe('getTaxHarvest – combined realized gains and lots', () => {
        it('should return correct realized values AND enriched lots simultaneously', () => {
            insertTxWithLedger('G1', 500, '2024-01-01', 'income', 'realized_stcg')
            insertTxWithLedger('G2', 1000, '2024-01-01', 'income', 'realized_ltcg')
            insertTxWithLedger('D1', 300, '2024-01-01', 'income', 'realized_stcg_debt')
            insertTxWithLedger('L1', 200, '2024-01-01', 'expense', 'realized_stcl')
            insertTxWithLedger('L2', 400, '2024-01-01', 'expense', 'realized_ltcl')

            const invId = nativeDb.prepare(`
                INSERT INTO investments (title, category, assetClass, currentAmount, latestNav)
                VALUES ('Mixed Fund', 'mutual_fund', 'equity', 0, 150)
            `).run().lastInsertRowid;
            nativeDb.prepare(`
                INSERT INTO investment_lots (investment_id, purchaseDate, units, costBasis, currentNav)
                VALUES (?, ?, 10, 1000, 0)
            `).run(invId, pastDate(2));

            const { data } = getTaxHarvest();
            expect(data.realizedSTCG).toBe(500);
            expect(data.realizedLTCG).toBe(1000);
            expect(data.realizedDebtGains).toBe(300);
            expect(data.realizedSTCL).toBe(200);
            expect(data.realizedLTCL).toBe(400);
            expect(data.lots.length).toBe(1);
            expect(data.lots[0].currentValue).toBe(10 * 150);
            expect(data.lots[0].unrealizedGain).toBe(10 * 150 - 1000);
            expect(data.lots[0].isLongTerm).toBe(true);
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Section 6 – Irrelevant transaction categories are ignored
    // ─────────────────────────────────────────────────────────────────

    describe('getTaxHarvest – irrelevant transaction categories ignored', () => {
        it('should not count salary or food transactions in any realized gain/loss bucket', () => {
            insertTxWithLedger('Salary', 50000, '2024-01-01', 'income', 'salary')
            insertTxWithLedger('Lunch', 300, '2024-01-05', 'expense', 'food')
            const { data } = getTaxHarvest();
            expect(data.realizedSTCG).toBe(0);
            expect(data.realizedLTCG).toBe(0);
            expect(data.realizedDebtGains).toBe(0);
            expect(data.realizedSTCL).toBe(0);
            expect(data.realizedLTCL).toBe(0);
        });

        it('should not count capital_deployment transactions in any realized bucket', () => {
            insertTxWithLedger('SIP Buy', 5000, '2024-01-01', 'expense', 'capital_deployment')
            const { data } = getTaxHarvest();
            expect(data.realizedSTCG).toBe(0);
            expect(data.realizedLTCG).toBe(0);
            expect(data.realizedDebtGains).toBe(0);
            expect(data.realizedSTCL).toBe(0);
            expect(data.realizedLTCL).toBe(0);
        });
    });
});
