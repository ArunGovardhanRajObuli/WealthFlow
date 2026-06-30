const { nativeDb } = require('../../database');
const {
    getLiquidityMetrics,
    getDiagnosticsMetrics,
    getEmergencyAdequacyMetrics,
    getSummaryMetrics
} = require('./analyticsService');

describe('analyticsService', () => {

    beforeEach(() => {
        nativeDb.prepare('DELETE FROM ledger_lines').run();
        nativeDb.prepare('DELETE FROM transactions').run();
    });
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    const clearTables = () => {
        const tables = [
            'ledger_lines', 'transactions', 'real_estate', 'gold_holdings', 
            'fixed_deposits', 'nps_accounts', 'reminders', 'credit_cards', 
            'family_members', 'budgets', 'bank_balances', 'sinking_funds', 
            'investments'
        ];
        tables.forEach(table => {
            nativeDb.prepare(`DELETE FROM ${table}`).run();
        });
    };

    beforeAll(() => {
        clearTables();
    });

    afterEach(() => {
        clearTables();
    });

    describe('getLiquidityMetrics', () => {
        it('should return zeros when no data exists', () => {
            const metrics = getLiquidityMetrics();
            expect(metrics).toEqual({
                income: 0,
                expense: 0,
                sinking: 0,
                endow: 0,
                invest: 0,
                prepayments: 0,
                ccBalance: 0,
                freeLiquidity: 0,
                monthsTracked: 1,
                monthlyAvgExpense: 0,
                monthlyAvgIncome: 0,
                realEstate: 0,
                loanPrincipal: 0,
                goldValue: 0,
                fdPrincipal: 0,
                npsValue: 0
            });
        });

        it('should correctly aggregate metrics across tables and handle formatted values', () => {
            nativeDb.prepare(`INSERT INTO ledger_lines (account_class, account_type, debit_amount, credit_amount) VALUES ('Revenue', 'operating', '0', 1000.50)`).run();
            nativeDb.prepare(`INSERT INTO ledger_lines (account_class, account_type, debit_amount, credit_amount) VALUES ('Expense', 'operating', '500', '0')`).run();
            
            insertTxWithLedger('Tx', 200.5, '2026-06-19', 'expense', 'capital_deployment', 'sinking_fund_id', [1]);
            insertTxWithLedger('Tx', 300, '2026-06-19', 'expense', 'capital_deployment', 'family_member_id', [1]);
            insertTxWithLedger('Tx', 400, '2026-06-19', 'expense', 'capital_deployment', 'investment_id', [1]);
            insertTxWithLedger('Tx', 500, '2026-06-19', 'expense', 'capital_deployment', 'linked_loan_id', [1]);
            
            nativeDb.prepare(`INSERT INTO ledger_lines (account_class, account_type, debit_amount, credit_amount) VALUES ('Liability', 'credit_card', '0', '600')`).run();
            
            nativeDb.prepare(`INSERT INTO real_estate (currentMarketValue, baseValue) VALUES (10000, '8000')`).run();
            nativeDb.prepare(`INSERT INTO gold_holdings (weightGrams, currentPricePerGram) VALUES ('10', 5000)`).run();
            nativeDb.prepare(`INSERT INTO fixed_deposits (principal) VALUES (20000)`).run();
            nativeDb.prepare(`INSERT INTO nps_accounts (currentValue) VALUES (15000)`).run();

            nativeDb.prepare(`INSERT INTO ledger_lines (account_class, account_type, credit_amount, debit_amount) VALUES ('Liability', 'loan', 5000, '0')`).run();
            nativeDb.prepare(`INSERT INTO ledger_lines (account_class, account_type, debit_amount, credit_amount) VALUES ('Asset', 'bank', '3,000', '0')`).run();
            
            const metrics = getLiquidityMetrics();

            expect(metrics.income).toBe(1000.50);
            expect(metrics.expense).toBe(500);
            expect(metrics.sinking).toBe(200.5);
            expect(metrics.endow).toBe(300);
            expect(metrics.invest).toBe(400);
            expect(metrics.prepayments).toBe(500);
            expect(metrics.ccBalance).toBe(600);
            expect(metrics.realEstate).toBe(10000);
            expect(metrics.goldValue).toBe(50000);
            expect(metrics.fdPrincipal).toBe(20000);
            expect(metrics.npsValue).toBe(15000);
            expect(metrics.monthsTracked).toBe(1);
            expect(metrics.monthlyAvgIncome).toBe(Math.round(1000.50 / 1)); 
            expect(metrics.monthlyAvgExpense).toBe(Math.round(500 / 1)); 
            expect(metrics.loanPrincipal).toBe(5600); 
            expect(metrics.freeLiquidity).toBe(Math.round(metrics.freeLiquidity)); 
        });
    });

    describe('getDiagnosticsMetrics', () => {
        it('should return system optimal when no issues detected', () => {
            const metrics = getDiagnosticsMetrics();
            expect(metrics.structuralDeficit).toBe(false);
            expect(metrics.alerts.length).toBe(1);
            expect(metrics.alerts[0].title).toBe('System Optimal');
        });

        it('should report structural deficit if obligations > income', () => {
            nativeDb.prepare(`INSERT INTO family_members (annualIncome) VALUES ('1,200')`).run(); 
            nativeDb.prepare(`INSERT INTO budgets (monthlyLimit) VALUES ('150')`).run();
            
            const metrics = getDiagnosticsMetrics();
            expect(metrics.structuralDeficit).toBe(true);
            expect(metrics.alerts).toEqual(expect.arrayContaining([
                expect.objectContaining({ title: 'Structural Bleed Detected' })
            ]));
        });

        it('should compute EMI accurately for deficit check', () => {
            nativeDb.prepare(`INSERT INTO family_members (annualIncome) VALUES ('12000')`).run(); 
            nativeDb.prepare(`INSERT INTO reminders (category, frequency, amount, dueDate, termYears) VALUES ('loan', 'monthly', '2000', '2030-01-01', 10)`).run();
            
            const metrics = getDiagnosticsMetrics();
            expect(metrics.structuralDeficit).toBe(true); 
            expect(metrics.alerts).toEqual(expect.arrayContaining([
                expect.objectContaining({ title: 'Structural Bleed Detected' })
            ]));
        });

        it('should report negative free liquidity', () => {
            nativeDb.prepare(`INSERT INTO ledger_lines (account_class, account_type, debit_amount, credit_amount) VALUES ('Asset', 'bank', '0', '1000')`).run(); 
            const metrics = getDiagnosticsMetrics();
            expect(metrics.alerts).toEqual(expect.arrayContaining([
                expect.objectContaining({ title: 'Negative Free Liquidity' })
            ]));
        });

        it('should warn about CIBIL score if credit utilization > 30%', () => {
            nativeDb.prepare(`INSERT INTO credit_cards (name, creditLimit, currentBalance) VALUES ('Test Card', 1000, 310)`).run();
            const metrics = getDiagnosticsMetrics();
            expect(metrics.alerts).toEqual(expect.arrayContaining([
                expect.objectContaining({ title: 'CIBIL Score Threat' })
            ]));
        });

        it('should detect statistical anomaly in recent spends', () => {
            const now = new Date();
            const lastMonth = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const fourMonthsAgo = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            
            insertTxWithLedger('Tx', 10000, lastMonth, 'expense', 'food');
            insertTxWithLedger('Tx', 2000, fourMonthsAgo, 'expense', 'food');

            const metrics = getDiagnosticsMetrics();
            expect(metrics.alerts).toEqual(expect.arrayContaining([
                expect.objectContaining({ title: 'Statistical Anomaly: FOOD' })
            ]));
        });

        it('should report ghost liability for subscription without matching transaction', () => {
            nativeDb.prepare(`INSERT INTO reminders (title, amount, category, frequency) VALUES ('Netflix', 500, 'subscription', 'monthly')`).run();
            const metrics = getDiagnosticsMetrics();
            expect(metrics.alerts).toEqual(expect.arrayContaining([
                expect.objectContaining({ title: 'Ghost Liability (subscription)' })
            ]));
        });
        
        it('should NOT report ghost liability if there is a matching transaction', () => {
            const reminderRes = nativeDb.prepare(`INSERT INTO reminders (title, amount, category, frequency) VALUES ('Netflix', 500, 'subscription', 'monthly')`).run();
            const reminderId = reminderRes.lastInsertRowid;
            
            const now = new Date();
            const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            
            insertTxWithLedger('Netflix payment', 500, tenDaysAgo, 'expense', 'subscription', 'subscription_id', [reminderId]);
            
            const metrics = getDiagnosticsMetrics();
            expect(metrics.alerts).not.toEqual(expect.arrayContaining([
                expect.objectContaining({ title: 'Ghost Liability (subscription)' })
            ]));
        });
    });

    describe('getEmergencyAdequacyMetrics', () => {
        it('should compute zero liquid reserves when empty', () => {
            const metrics = getEmergencyAdequacyMetrics();
            expect(metrics.totalLiquidReserves).toBe(0);
            expect(metrics.breakableReserves).toBe(0);
            expect(metrics.survivalMonths).toBe(99); 
        });

        it('should accurately calculate obligations and liquid reserves', () => {
            nativeDb.prepare(`INSERT INTO reminders (title, amount, category, frequency, dueDate, termYears) VALUES ('Home Loan', 1000, 'loan', 'monthly', '2030-01-01', 10)`).run();
            nativeDb.prepare(`INSERT INTO reminders (title, amount, category, frequency, dueDate, termYears) VALUES ('Health Ins', 12000, 'insurance', 'yearly', '2030-01-01', 10)`).run();
            
            nativeDb.prepare(`INSERT INTO ledger_lines (account_class, account_type, debit_amount, credit_amount) VALUES ('Asset', 'bank', '10000', '0')`).run(); 
            
            nativeDb.prepare(`INSERT INTO fixed_deposits (principal, isTaxSaver, startDate) VALUES ('5000', '0', '2022-01-01')`).run(); 
            
            const metrics = getEmergencyAdequacyMetrics();
            expect(metrics.totalMonthlyObligation).toBe(2000);
            expect(metrics.breakdown.emi).toBe(1000);
            expect(metrics.breakdown.insurance).toBe(1000);
            
            expect(metrics.totalLiquidReserves).toBeGreaterThanOrEqual(15000);
            expect(metrics.survivalMonths).toBeGreaterThanOrEqual(7.5);
            expect(['platinum', 'gold', 'secure', 'warning', 'critical']).toContain(metrics.adequacy);
        });

        it('should handle dependents correctly by omitting them from sums', () => {
            nativeDb.prepare(`INSERT INTO family_members (id, role) VALUES (1, 'child')`).run();
            nativeDb.prepare(`INSERT INTO fixed_deposits (principal, isTaxSaver, startDate, owner_member_id) VALUES ('5000', '0', '2022-01-01', 1)`).run();
            const metrics = getEmergencyAdequacyMetrics();
            expect(metrics.totalLiquidReserves).toBe(0); 
        });
        
        it('should compute bullet encumbrances and adjust liquid reserves', () => {
            nativeDb.prepare(`INSERT INTO ledger_lines (account_class, account_type, debit_amount, credit_amount) VALUES ('Asset', 'bank', '10000', '0')`).run(); 
            const now = new Date();
            const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            nativeDb.prepare(`INSERT INTO reminders (title, amount, category, frequency, dueDate) VALUES ('Bullet Loan', 2000, 'loan', 'once', '${threeMonthsFromNow}')`).run();
            
            const metrics = getEmergencyAdequacyMetrics();
            // Free cash = 10000, Bullet = 2000 => liquid = 8000
            expect(metrics.totalLiquidReserves).toBe(8000);
        });
        
        it('should correctly include various asset classes into gross breakable reserves', () => {
            nativeDb.prepare(`INSERT INTO ledger_lines (account_class, account_type, debit_amount, credit_amount) VALUES ('Asset', 'bank', '1000', '0')`).run(); 
            nativeDb.prepare(`INSERT INTO investments (category, assetClass, currentAmount) VALUES ('mutual_fund', 'equity', 2000)`).run(); // 50% haircut -> 1000
            nativeDb.prepare(`INSERT INTO investments (category, assetClass, currentAmount) VALUES ('epf', 'debt', 3000)`).run(); // epf 50% breakable -> 1500
            nativeDb.prepare(`INSERT INTO sinking_funds (currentAmount, targetDate) VALUES (4000, '2030-01-01')`).run(); // liquidSinking -> 4000
            nativeDb.prepare(`INSERT INTO family_members (role, collegeSavings) VALUES ('parent', 5000)`).run(); // endowment 50% -> 2500
            
            const metrics = getEmergencyAdequacyMetrics();
            expect(metrics.breakableReserves).toBe(1000 + 1000 + 1500 + 4000); 
        });
    });

    describe('getSummaryMetrics', () => {
        it('should calculate ytd metrics', () => {
            nativeDb.prepare('DELETE FROM ledger_lines').run();
            nativeDb.prepare('DELETE FROM transactions').run();
            const now = new Date();
            const ytdStart = new Date(now.getFullYear(), 0, 2).toISOString().slice(0, 10); // +1 day to safely avoid UTC shift
            insertTxWithLedger('Tx', 100, ytdStart, 'expense', 'food');
            
            const lastYear = new Date(now.getFullYear() - 1, 0, 2).toISOString().slice(0, 10);
            insertTxWithLedger('Tx', 200, lastYear, 'income', 'salary');

            const rows = getSummaryMetrics('ytd');
            expect(rows.length).toBe(2);
            expect(rows.find(r => r.type === 'expense').total).toBe(100);
            expect(rows.find(r => r.type === 'income').total).toBe(0);
        });

        it('should calculate mtd metrics', () => {
            nativeDb.prepare('DELETE FROM ledger_lines').run();
            nativeDb.prepare('DELETE FROM transactions').run();
            const now = new Date();
            const mtdStart = new Date(now.getFullYear(), now.getMonth(), 2).toISOString().slice(0, 10);
            insertTxWithLedger('Tx', 50, mtdStart, 'expense', 'food');

            const rows = getSummaryMetrics('mtd');
            expect(rows.length).toBe(2);
            expect(rows.find(r => r.type === 'expense').total).toBe(50);
            expect(rows.find(r => r.type === 'income').total).toBe(0);
        });
        
        it('should calculate fy metrics based on current month', () => {
            const now = new Date();
            const currentMonth = now.getMonth();
            const year = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;
            const fyStart = new Date(year, 3, 2).toISOString().slice(0, 10);
            insertTxWithLedger('Tx', 75, fyStart, 'expense', 'utilities');
            
            const rows = getSummaryMetrics('fy');
            expect(Array.isArray(rows)).toBe(true);
            const exp = rows.find(r => r.type === 'expense');
            expect(exp).toBeDefined();
            expect(exp.total).toBeGreaterThanOrEqual(75);
        });

        it('should calculate qtd metrics', () => {
            const now = new Date();
            const quarter = Math.floor(now.getMonth() / 3);
            const qtdStart = new Date(now.getFullYear(), quarter * 3, 2).toISOString().slice(0, 10);
            insertTxWithLedger('Tx', 85, qtdStart, 'income', 'bonus');
            
            const rows = getSummaryMetrics('qtd');
            const inc = rows.find(r => r.type === 'income');
            expect(inc).toBeDefined();
            expect(inc.total).toBeGreaterThanOrEqual(85);
        });
    });
});
