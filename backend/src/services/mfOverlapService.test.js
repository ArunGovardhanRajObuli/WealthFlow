const { nativeDb } = require('../../database');
const mfOverlapService = require('./mfOverlapService');

describe('mfOverlapService', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        // Ensure the table exists and clear it. Wait, the table should already exist if imported from database.
        nativeDb.prepare('DELETE FROM investments').run();
    });

    afterEach(() => {
        nativeDb.prepare('DELETE FROM investments').run();
    });

    const insertInvestment = (overrides = {}) => {
        const stmt = nativeDb.prepare(`
            INSERT INTO investments (title, category, assetClass, currentAmount, roi)
            VALUES (@title, @category, @assetClass, @currentAmount, @roi)
        `);
        stmt.run({
            title: 'Test Fund',
            category: 'mf',
            assetClass: 'equity',
            currentAmount: 1000,
            roi: 10,
            ...overrides
        });
    };

    describe('getMfOverlap', () => {
        it('should return default values when there are no funds', () => {
            const result = mfOverlapService.getMfOverlap();
            expect(result.totalFunds).toBe(0);
            expect(result.totalMFValue).toBe(0);
            expect(result.severity).toBe('clean');
            expect(result.overlapCount).toBe(0);
            expect(result.overlaps.length).toBe(0);
            expect(result.recommendation).toBe('Your mutual fund portfolio is well diversified.');
        });

        it('should only include funds with category sip, mutual_fund, or mf', () => {
            insertInvestment({ category: 'sip', title: 'Fund 1' });
            insertInvestment({ category: 'mutual_fund', title: 'Fund 2' });
            insertInvestment({ category: 'mf', title: 'Fund 3' });
            insertInvestment({ category: 'stocks', title: 'Ignored Fund' }); // Should be ignored

            const result = mfOverlapService.getMfOverlap();
            expect(result.totalFunds).toBe(3);
        });

        it('should handle null/missing values gracefully', () => {
            // Depending on schema, some columns might be null. We mimic null values.
            const stmt = nativeDb.prepare(`
                INSERT INTO investments (title, category, assetClass, currentAmount, roi)
                VALUES (?, ?, ?, ?, ?)
            `);
            stmt.run('Null Fund', 'mf', null, null, null);

            const result = mfOverlapService.getMfOverlap();
            expect(result.totalFunds).toBe(1);
            expect(result.totalMFValue).toBe(0);
            expect(result.overlaps[0].assetClass).toBe('unclassified');
            expect(result.overlaps[0].funds[0].value).toBe(0);
            expect(result.overlaps[0].funds[0].roi).toBe(0);
        });

        it('should calculate totalMFValue correctly', () => {
            insertInvestment({ currentAmount: 1000, assetClass: 'equity' });
            insertInvestment({ currentAmount: 2500, assetClass: 'debt' });
            
            const result = mfOverlapService.getMfOverlap();
            expect(result.totalMFValue).toBe(3500);
        });

        it('should group by assetClass case-insensitively', () => {
            insertInvestment({ assetClass: 'Equity', currentAmount: 1000 });
            insertInvestment({ assetClass: 'equity', currentAmount: 2000 });
            insertInvestment({ assetClass: 'EQUITY', currentAmount: 3000 });

            const result = mfOverlapService.getMfOverlap();
            expect(result.overlaps.length).toBe(1);
            expect(result.overlaps[0].assetClass).toBe('equity');
            expect(result.overlaps[0].fundCount).toBe(3);
            expect(result.totalMFValue).toBe(6000);
            expect(result.overlaps[0].concentration).toBe(100);
            expect(result.overlaps[0].isOverlapping).toBe(true);
        });

        it('should return clean severity when no overlaps exist (max 1 fund per class)', () => {
            insertInvestment({ assetClass: 'equity' });
            insertInvestment({ assetClass: 'debt' });
            insertInvestment({ assetClass: 'hybrid' });

            const result = mfOverlapService.getMfOverlap();
            expect(result.severity).toBe('clean');
            expect(result.overlapCount).toBe(0);
            expect(result.overlaps.every(o => o.isOverlapping === false)).toBe(true);
        });

        it('should return moderate severity when 1 to 2 overlapping asset classes exist', () => {
            // Overlap 1: equity
            insertInvestment({ assetClass: 'equity', title: 'Fund 1' });
            insertInvestment({ assetClass: 'equity', title: 'Fund 2' });
            
            // Overlap 2: debt
            insertInvestment({ assetClass: 'debt', title: 'Fund 3' });
            insertInvestment({ assetClass: 'debt', title: 'Fund 4' });

            // No overlap: hybrid
            insertInvestment({ assetClass: 'hybrid', title: 'Fund 5' });

            const result = mfOverlapService.getMfOverlap();
            expect(result.overlapCount).toBe(2);
            expect(result.severity).toBe('moderate');
            expect(result.recommendation).toContain('Moderate overlap detected');
        });

        it('should return high severity when more than 2 overlapping asset classes exist', () => {
            // Overlap 1: equity
            insertInvestment({ assetClass: 'equity', title: 'Fund 1' });
            insertInvestment({ assetClass: 'equity', title: 'Fund 2' });
            
            // Overlap 2: debt
            insertInvestment({ assetClass: 'debt', title: 'Fund 3' });
            insertInvestment({ assetClass: 'debt', title: 'Fund 4' });

            // Overlap 3: hybrid
            insertInvestment({ assetClass: 'hybrid', title: 'Fund 5' });
            insertInvestment({ assetClass: 'hybrid', title: 'Fund 6' });

            const result = mfOverlapService.getMfOverlap();
            expect(result.overlapCount).toBe(3);
            expect(result.severity).toBe('high');
            expect(result.recommendation).toContain('High overlap detected');
        });

        it('should compute concentration percentages accurately', () => {
            insertInvestment({ assetClass: 'equity', currentAmount: 4000 });
            insertInvestment({ assetClass: 'debt', currentAmount: 6000 });

            const result = mfOverlapService.getMfOverlap();
            
            const equityOverlap = result.overlaps.find(o => o.assetClass === 'equity');
            const debtOverlap = result.overlaps.find(o => o.assetClass === 'debt');

            expect(equityOverlap.concentration).toBe(40); // 4000 / 10000 = 40%
            expect(debtOverlap.concentration).toBe(60);   // 6000 / 10000 = 60%
        });
    });
});
