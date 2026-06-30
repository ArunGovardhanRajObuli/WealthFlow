const { nativeDb } = require('../../database');
const { getDividendTracker } = require('./dividendService');

describe('Dividend Service - getDividendTracker', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        // Clear tables to start fresh
        nativeDb.prepare('DELETE FROM investments').run();
        nativeDb.prepare('DELETE FROM transactions').run();
    });

    afterEach(() => {
        // Clean up tables after each test
        nativeDb.prepare('DELETE FROM investments').run();
        nativeDb.prepare('DELETE FROM transactions').run();
    });

    test('should return empty result when no investments and no transactions exist', () => {
        const result = getDividendTracker();

        expect(result.investments).toEqual([]);
        expect(result.totalAnnualReturn).toBe(0);
        expect(result.totalMonthlyReturn).toBe(0);
        expect(result.weightedYield).toBe(0);
        expect(result.weightedROI).toBe(0);
        expect(result.history).toEqual([]);
    });

    test('should correctly process investments with positive dividendYield', () => {
        nativeDb.prepare(`
            INSERT INTO investments (title, category, currentAmount, dividendYield) 
            VALUES ('Stock A', 'stocks', 10000, 5.0)
        `).run();
        
        nativeDb.prepare(`
            INSERT INTO investments (title, category, currentAmount, dividendYield) 
            VALUES ('Stock B', 'stocks', 20000, 3.5)
        `).run();

        const result = getDividendTracker();

        expect(result.investments.length).toBe(2);
        
        // Stock A annual return: 10000 * 5% = 500
        // Stock B annual return: 20000 * 3.5% = 700
        expect(result.investments[0].annualReturn).toBeCloseTo(500);
        expect(result.investments[1].annualReturn).toBeCloseTo(700);

        expect(result.totalAnnualReturn).toBeCloseTo(1200); // 500 + 700
        expect(result.totalMonthlyReturn).toBeCloseTo(100); // 1200 / 12
        expect(result.weightedYield).toBe('4.00'); // (1200 / 30000) * 100
        expect(result.weightedROI).toBe('4.00');
    });

    test('should exclude investments with zero or negative dividendYield', () => {
        nativeDb.prepare(`
            INSERT INTO investments (title, category, currentAmount, dividendYield) 
            VALUES ('Stock A', 'stocks', 10000, 0)
        `).run();
        
        nativeDb.prepare(`
            INSERT INTO investments (title, category, currentAmount, dividendYield) 
            VALUES ('Stock B', 'stocks', 20000, -2.5)
        `).run();

        nativeDb.prepare(`
            INSERT INTO investments (title, category, currentAmount, dividendYield) 
            VALUES ('Stock C', 'stocks', 10000, 5)
        `).run();

        const result = getDividendTracker();

        expect(result.investments.length).toBe(1);
        expect(result.investments[0].title).toBe('Stock C');
        expect(result.totalAnnualReturn).toBe(500);
    });

    test('should exclude investments with category "epf" or "ppf" regardless of yield', () => {
        nativeDb.prepare(`
            INSERT INTO investments (title, category, currentAmount, dividendYield) 
            VALUES ('EPF Account', 'epf', 50000, 8.1)
        `).run();
        
        nativeDb.prepare(`
            INSERT INTO investments (title, category, currentAmount, dividendYield) 
            VALUES ('PPF Account', 'ppf', 30000, 7.1)
        `).run();

        nativeDb.prepare(`
            INSERT INTO investments (title, category, currentAmount, dividendYield) 
            VALUES ('Dividend Stock', 'stocks', 10000, 4)
        `).run();

        const result = getDividendTracker();

        expect(result.investments.length).toBe(1);
        expect(result.investments[0].title).toBe('Dividend Stock');
    });

    test('should handle invalid string or null values gracefully', () => {
        nativeDb.prepare(`
            INSERT INTO investments (title, category, currentAmount, dividendYield) 
            VALUES ('Bad Yield', 'stocks', 10000, 'invalid')
        `).run();
        
        nativeDb.prepare(`
            INSERT INTO investments (title, category, currentAmount, dividendYield) 
            VALUES ('Null Yield', 'stocks', 10000, NULL)
        `).run();

        nativeDb.prepare(`
            INSERT INTO investments (title, category, currentAmount, dividendYield) 
            VALUES ('Bad Amount', 'stocks', 'invalid_amount', 5.0)
        `).run();

        const result = getDividendTracker();

        // The first two have invalid yield (parsed as NaN or 0) -> ignored.
        // The third has valid yield (5.0), but bad amount (parsed as NaN -> 0).
        // It should still be included because yield > 0.
        
        expect(result.investments.length).toBe(1);
        expect(result.investments[0].title).toBe('Bad Amount');
        expect(result.investments[0].annualReturn).toBe(0);
        expect(result.totalAnnualReturn).toBe(0);
        expect(result.totalMonthlyReturn).toBe(0);
        expect(result.weightedYield).toBe(0);
    });

    test('should return up to 10 latest transactions with category "dividend"', () => {
        // Insert 12 dividend transactions
        for (let i = 1; i <= 12; i++) {
            // Add leading zero for month/day to ensure correct sorting if string based
            const day = i < 10 ? '0' + i : i.toString();
            insertTxWithLedger(`Div ${i}`, i * 10, `2023-01-${day}`, 'income', 'dividend');
        }

        // Insert a non-dividend transaction
        insertTxWithLedger('Salary', 5000, '2023-02-01', 'income', 'salary');

        const result = getDividendTracker();

        expect(result.history.length).toBe(10);
        // Because of ORDER BY date DESC, the most recent should be Div 12
        expect(result.history[0].title).toBe('Div 12');
        expect(result.history[9].title).toBe('Div 3');
        // 'salary' category should not be included
        const hasSalary = result.history.some(tx => tx.category === 'salary');
        expect(hasSalary).toBe(false);
    });
});
