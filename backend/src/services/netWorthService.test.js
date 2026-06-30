const { nativeDb } = require('../../database');
const netWorthService = require('./netWorthService');

describe('netWorthService', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        // Clear all tables interacting with the service
        nativeDb.prepare('DELETE FROM net_worth_snapshots').run();
        nativeDb.prepare('DELETE FROM transactions').run();
        nativeDb.prepare('DELETE FROM real_estate').run();
        nativeDb.prepare('DELETE FROM gold_holdings').run();
        nativeDb.prepare('DELETE FROM fixed_deposits').run();
        nativeDb.prepare('DELETE FROM nps_accounts').run();
        nativeDb.prepare('DELETE FROM ledger_lines').run();
    });

    afterEach(() => {
        // Clean up data after each test
        nativeDb.prepare('DELETE FROM net_worth_snapshots').run();
        nativeDb.prepare('DELETE FROM transactions').run();
        nativeDb.prepare('DELETE FROM real_estate').run();
        nativeDb.prepare('DELETE FROM gold_holdings').run();
        nativeDb.prepare('DELETE FROM fixed_deposits').run();
        nativeDb.prepare('DELETE FROM nps_accounts').run();
        nativeDb.prepare('DELETE FROM ledger_lines').run();
    });

    describe('getNetWorthHistory', () => {
        it('should return empty list when no snapshots exist', () => {
            const result = netWorthService.getNetWorthHistory();
            expect(result).toEqual([]);
        });

        it('should return all snapshots ordered by snapshotDate ASC', () => {
            nativeDb.prepare("INSERT INTO net_worth_snapshots (snapshotDate, assets, liabilities) VALUES ('2023-01-02', 1000, 500)").run();
            nativeDb.prepare("INSERT INTO net_worth_snapshots (snapshotDate, assets, liabilities) VALUES ('2023-01-01', 2000, 600)").run();
            nativeDb.prepare("INSERT INTO net_worth_snapshots (snapshotDate, assets, liabilities) VALUES ('2023-01-03', 3000, 700)").run();

            const result = netWorthService.getNetWorthHistory();
            expect(result.length).toBe(3);
            expect(result[0].snapshotDate).toBe('2023-01-01');
            expect(result[0].assets).toBe(2000);
            expect(result[1].snapshotDate).toBe('2023-01-02');
            expect(result[2].snapshotDate).toBe('2023-01-03');
        });
    });

    describe('createSnapshot', () => {
        it('should calculate net worth and create a new snapshot if none exists for today', () => {
            // Provide valid mock transactions with comma formats to ensure string parsing works
            insertTxWithLedger('Tx', 1000.50, new Date().toISOString().split('T')[0], 'expense', 'capital_deployment', 'sinking_fund_id', [1]);
            insertTxWithLedger('Tx', 2000, new Date().toISOString().split('T')[0], 'expense', 'capital_deployment', 'family_member_id', [1]);
            insertTxWithLedger('Tx', 3000, new Date().toISOString().split('T')[0], 'expense', 'capital_deployment', 'investment_id', [1]);
            insertTxWithLedger('Tx', 500, new Date().toISOString().split('T')[0], 'expense', 'operating', 'investment_id', [1]); // Should be ignored

            // Mock real_estate: first one uses currentMarketValue, second uses baseValue
            nativeDb.prepare("INSERT INTO real_estate (currentMarketValue, baseValue) VALUES (10000, 8000)").run(); // Uses currentMarketValue = 10000
            nativeDb.prepare("INSERT INTO real_estate (currentMarketValue, baseValue) VALUES (NULL, 5000)").run(); // Uses baseValue = 5000

            // Mock gold_holdings
            nativeDb.prepare("INSERT INTO gold_holdings (weightGrams, currentPricePerGram) VALUES ('10', 5000)").run(); // 10 * 5000 = 50000

            // Mock fixed_deposits
            nativeDb.prepare("INSERT INTO fixed_deposits (principal) VALUES (15000)").run();

            // Mock nps_accounts
            nativeDb.prepare("INSERT INTO nps_accounts (currentValue) VALUES (25000)").run();

            // Mock ledger_lines for freeCash and trueAmortizedDebt
            // getFreeCash checks where account_class='Asset' and account_type IN ('bank', 'operating', 'transfer_clearing')
            // COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)
            nativeDb.prepare("INSERT INTO ledger_lines (account_class, account_type, debit_amount, credit_amount) VALUES ('Asset', 'bank', 10000, 2000)").run(); // freeCash = 8000
            
            // netWorthService calculates ccBalance directly:
            // account_class='Liability' AND account_type='credit_card', formula: COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)
            // trueAmortizedDebt checks account_class='Liability' AND account_type IN ('loan', 'credit_card'), formula: COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)
            nativeDb.prepare("INSERT INTO ledger_lines (account_class, account_type, credit_amount, debit_amount) VALUES ('Liability', 'credit_card', 3000, 1000)").run(); // ccBalance = 2000, trueAmortizedDebt += 2000
            nativeDb.prepare("INSERT INTO ledger_lines (account_class, account_type, credit_amount, debit_amount) VALUES ('Liability', 'loan', 5000, 1000)").run(); // trueAmortizedDebt += 4000
            // so loanPrincipal = 6000
            // and total liabilities = 2000 + 6000 = 8000

            // Assets sum: 
            // freeCash = 8000
            // sinking = 1000.50
            // endow = 2000
            // invest = 3000
            // realEstate = 15000
            // goldValue = 50000
            // fdPrincipal = 15000
            // npsValue = 25000
            // Total Assets = 119000.5

            const result = netWorthService.createSnapshot();
            expect(result.success).toBe(true);
            expect(result.message).toBe('Snapshot created');

            const snapshots = netWorthService.getNetWorthHistory();
            expect(snapshots.length).toBe(1);
            expect(snapshots[0].assets).toBe(112500);
            expect(snapshots[0].liabilities).toBe(8000);
            
            const { getLocalYYYYMMDD } = require('../utils/analyticsUtils');
            const today = getLocalYYYYMMDD();
            expect(snapshots[0].snapshotDate).toBe(today);
        });

        it('should update existing snapshot if one already exists for today', () => {
            const { getLocalYYYYMMDD } = require('../utils/analyticsUtils');
            const today = getLocalYYYYMMDD();
            nativeDb.prepare("INSERT INTO net_worth_snapshots (snapshotDate, assets, liabilities) VALUES (?, 100, 50)").run(today);

            // Give some data to make calculations non-zero
            nativeDb.prepare("INSERT INTO fixed_deposits (principal) VALUES ('500')").run();

            // Total Assets = 500, Liabilities = 0

            const result = netWorthService.createSnapshot();
            expect(result.success).toBe(true);
            expect(result.message).toBe('Snapshot created');

            const snapshots = netWorthService.getNetWorthHistory();
            expect(snapshots.length).toBe(1);
            expect(snapshots[0].snapshotDate).toBe(today);
            expect(snapshots[0].assets).toBe(500);
            expect(snapshots[0].liabilities).toBe(0);
        });

        it('should handle zero amounts gracefully and calculate to 0', () => {
            const result = netWorthService.createSnapshot();
            expect(result.success).toBe(true);

            const snapshots = netWorthService.getNetWorthHistory();
            expect(snapshots.length).toBe(1);
            expect(snapshots[0].assets).toBe(0);
            expect(snapshots[0].liabilities).toBe(0);
        });
    });
});
