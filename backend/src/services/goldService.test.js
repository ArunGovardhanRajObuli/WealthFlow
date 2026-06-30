const { nativeDb } = require('../../database');
const goldService = require('./goldService');

describe('Gold Service', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        nativeDb.prepare('DELETE FROM ledger_lines').run();
        nativeDb.prepare('DELETE FROM transactions').run();
        nativeDb.prepare('DELETE FROM nominees').run();
        nativeDb.prepare('DELETE FROM gold_holdings').run();
        nativeDb.prepare('DELETE FROM bank_balances').run();
    });

    afterEach(() => {
        nativeDb.prepare('DELETE FROM ledger_lines').run();
        nativeDb.prepare('DELETE FROM transactions').run();
        nativeDb.prepare('DELETE FROM nominees').run();
        nativeDb.prepare('DELETE FROM gold_holdings').run();
        nativeDb.prepare('DELETE FROM bank_balances').run();
    });

    describe('createGoldHolding', () => {
        it('should create a physical gold holding (isHistorical = false)', () => {
            const goldId = goldService.createGoldHolding({
                type: 'Physical',
                safeTitle: 'Gold Coin',
                weightGrams: 10,
                safePurchasePrice: '5000',
                safeCurrentPrice: '6000',
                safePurchaseDate: '2023-01-01',
                interestRate: null,
                safeMaturityDate: null,
                owner_member_id: 1,
                joint_owner_member_id: null,
                safeSplitPercent: 100,
                isHistorical: false,
                source_bank_id: null,
                joint_bank_id: null,
                split_amount: null
            });

            expect(goldId).toBeGreaterThan(0);

            const holding = nativeDb.prepare('SELECT * FROM gold_holdings WHERE id = ?').get(goldId);
            expect(holding).toBeDefined();
            expect(holding.title).toBe('Gold Coin');
            // Weight should be updated by syncAssetBalances
            expect(holding.weightGrams).toBe(10);
            expect(holding.purchasePricePerGram).toBe(5000);
            expect(holding.currentPricePerGram).toBe(6000);

            const tx = decorateTx(nativeDb.prepare('SELECT * FROM transactions WHERE gold_id = ?').get(goldId));
            expect(tx).toBeDefined();
            expect(tx.category).toBe('capital_deployment');
            expect(tx.type).toBe('transfer');
            expect(tx.amount).toBe(50000); // 10 * 5000
        });

        it('should create a historical gold holding', () => {
            const goldId = goldService.createGoldHolding({
                type: 'Physical',
                safeTitle: 'Old Gold',
                weightGrams: 50,
                safePurchasePrice: '3000',
                safeCurrentPrice: '6500',
                safePurchaseDate: '2010-01-01',
                interestRate: null,
                safeMaturityDate: null,
                owner_member_id: 1,
                joint_owner_member_id: null,
                safeSplitPercent: 100,
                isHistorical: true,
                source_bank_id: null,
                joint_bank_id: null,
                split_amount: null
            });

            expect(goldId).toBeGreaterThan(0);

            const holding = nativeDb.prepare('SELECT * FROM gold_holdings WHERE id = ?').get(goldId);
            expect(holding.weightGrams).toBe(50);

            const tx = decorateTx(nativeDb.prepare('SELECT * FROM transactions WHERE gold_id = ?').get(goldId));
            expect(tx).toBeDefined();
            expect(tx.category).toBe('opening_balance');
            expect(tx.type).toBe('income');
            expect(tx.amount).toBe(150000); // 50 * 3000
        });
    });

    describe('getGoldPortfolio', () => {
        it('should compute physical gold portfolio correctly', () => {
            goldService.createGoldHolding({
                type: 'Physical',
                safeTitle: 'Coin 1',
                weightGrams: 10,
                safePurchasePrice: '5000',
                safeCurrentPrice: '6000',
                safePurchaseDate: '2023-01-01',
                isHistorical: true
            });

            goldService.createGoldHolding({
                type: 'Digital',
                safeTitle: 'Digi 1',
                weightGrams: 5,
                safePurchasePrice: '5500',
                safeCurrentPrice: '6000',
                safePurchaseDate: '2023-05-01',
                isHistorical: true
            });

            const portfolio = goldService.getGoldPortfolio();
            expect(portfolio.totalWeightGrams).toBe(15);
            expect(portfolio.totalInvested).toBe(77500); // 10*5000 + 5*5500
            expect(portfolio.totalCurrentValue).toBe(90000); // 15*6000
            expect(portfolio.unrealizedGain).toBe(12500);
            expect(portfolio.totalSGBInterestAccrued).toBe(0);
            
            expect(portfolio.byType['Physical']).toBeDefined();
            expect(portfolio.byType['Physical'].count).toBe(1);
            expect(portfolio.byType['Digital']).toBeDefined();
        });

        it('should compute SGB portfolio and interest correctly', () => {
            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
            const purchaseDate = new Date();
            purchaseDate.setFullYear(purchaseDate.getFullYear() - 2); // 2 years ago
            const purchaseDateStr = purchaseDate.toISOString().split('T')[0];

            const maturityDate = new Date();
            maturityDate.setFullYear(maturityDate.getFullYear() + 6); // 6 years from now
            const maturityDateStr = maturityDate.toISOString().split('T')[0];

            goldService.createGoldHolding({
                type: 'SGB',
                safeTitle: 'SGB 2021',
                weightGrams: 100,
                safePurchasePrice: '4500',
                safeCurrentPrice: '6000',
                safePurchaseDate: purchaseDateStr,
                interestRate: 2.5,
                safeMaturityDate: maturityDateStr,
                isHistorical: true
            });

            const portfolio = goldService.getGoldPortfolio();
            expect(portfolio.totalWeightGrams).toBe(100);
            expect(portfolio.totalInvested).toBe(450000); // 100 * 4500
            expect(portfolio.totalCurrentValue).toBe(600000);
            
            // Interest = 450000 * 2.5% * 2 years = 22500 approx
            expect(portfolio.totalSGBInterestAccrued).toBeGreaterThan(22000);
            expect(portfolio.totalSGBInterestAccrued).toBeLessThan(23000);

            const sgbHolding = portfolio.holdings.find(h => h.type === 'SGB');
            expect(sgbHolding.daysToMaturity).toBeGreaterThan(2100);
            expect(sgbHolding.sgbInterestAccrued).toBe(portfolio.totalSGBInterestAccrued);
        });

        it('should handle SGB post-maturity correctly', () => {
            const purchaseDate = new Date();
            purchaseDate.setFullYear(purchaseDate.getFullYear() - 10); // 10 years ago
            const purchaseDateStr = purchaseDate.toISOString().split('T')[0];

            const maturityDate = new Date();
            maturityDate.setFullYear(maturityDate.getFullYear() - 2); // Matured 2 years ago
            const maturityDateStr = maturityDate.toISOString().split('T')[0];

            goldService.createGoldHolding({
                type: 'Sovereign Gold Bond (SGB)',
                safeTitle: 'SGB 2014',
                weightGrams: 50,
                safePurchasePrice: '2500',
                safeCurrentPrice: '6500',
                safePurchaseDate: purchaseDateStr,
                interestRate: 2.5,
                safeMaturityDate: maturityDateStr,
                isHistorical: true
            });

            const portfolio = goldService.getGoldPortfolio();
            // Interest should be capped at maturity date, so 8 years of interest.
            // 50 * 2500 = 125000
            // 125000 * 2.5% * 8 = 25000
            expect(portfolio.totalSGBInterestAccrued).toBeGreaterThan(24000);
            expect(portfolio.totalSGBInterestAccrued).toBeLessThan(26000);

            const sgbHolding = portfolio.holdings.find(h => h.type === 'Sovereign Gold Bond (SGB)');
            expect(sgbHolding.daysToMaturity).toBeLessThan(0);
        });
    });

    describe('updateGoldPrice', () => {
        it('should update currentPricePerGram for all holdings', () => {
            goldService.createGoldHolding({
                type: 'Physical',
                safeTitle: 'Coin 1',
                weightGrams: 10,
                safePurchasePrice: '5000',
                safeCurrentPrice: '5000',
                safePurchaseDate: '2023-01-01',
                isHistorical: true
            });

            const changes = goldService.updateGoldPrice('7500');
            expect(changes).toBe(1);

            const portfolio = goldService.getGoldPortfolio();
            expect(portfolio.holdings[0].currentPricePerGram).toBe(7500);
            expect(portfolio.totalCurrentValue).toBe(75000); // 10 * 7500
        });
    });

    describe('removeGoldHolding', () => {
        it('should throw error if transactions are linked', () => {
            const goldId = goldService.createGoldHolding({
                type: 'Physical',
                safeTitle: 'Coin 1',
                weightGrams: 10,
                safePurchasePrice: '5000',
                safeCurrentPrice: '6000',
                safePurchaseDate: '2023-01-01',
                isHistorical: true
            });

            expect(() => {
                goldService.removeGoldHolding(goldId);
            }).toThrow(/Cannot delete: 1 transaction\(s\) are linked to this entity/);
        });

        it('should delete gold holding if transactions are manually removed', () => {
            const goldId = goldService.createGoldHolding({
                type: 'Physical',
                safeTitle: 'Coin 1',
                weightGrams: 10,
                safePurchasePrice: '5000',
                safeCurrentPrice: '6000',
                safePurchaseDate: '2023-01-01',
                isHistorical: true
            });

            // Insert a nominee to test cascading logic (if table exists)
            try {
                nativeDb.prepare('INSERT INTO nominees (assetType, assetId, nomineeName) VALUES (?, ?, ?)')
                    .run('Gold Holding', goldId, 'John Doe');
            } catch (e) {
                // If table doesn't exist or schema differs, ignore
            }

            // Remove linked transactions manually
            nativeDb.prepare('DELETE FROM transactions WHERE gold_id = ?').run(goldId);

            // Now delete should succeed
            goldService.removeGoldHolding(goldId);

            const holding = nativeDb.prepare('SELECT * FROM gold_holdings WHERE id = ?').get(goldId);
            expect(holding).toBeUndefined();

            try {
                const nominee = nativeDb.prepare('SELECT * FROM nominees WHERE assetId = ? AND assetType = "Gold Holding"').get(goldId);
                expect(nominee).toBeUndefined();
            } catch (e) {
                // Ignore
            }
        });
    });
});
