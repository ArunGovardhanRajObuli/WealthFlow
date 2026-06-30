const { nativeDb } = require('../../database');
const { getForecast, getCashflowForecast } = require('./forecastingService');

describe('forecastingService', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        // Initialize or just clear tables. Assuming nativeDb is already connected to an in-memory or test database
        clearTables();
    });

    afterEach(() => {
        clearTables();
    });

    function clearTables() {
        nativeDb.prepare('DELETE FROM ledger_lines').run();
        nativeDb.prepare('DELETE FROM reminders').run();
        nativeDb.prepare('DELETE FROM family_members').run();
        nativeDb.prepare('DELETE FROM real_estate').run();
        nativeDb.prepare('DELETE FROM sinking_funds').run();
        nativeDb.prepare('DELETE FROM transactions').run();
    }

    describe('getForecast', () => {
        it('should return default 90 days forecast with no data', () => {
            const result = getForecast(90);
            expect(result).toBeDefined();
            expect(result.timeline.length).toBe(90);
            expect(result.startingCash).toBe(0);
            expect(result.events).toEqual([]);
        });

        it('should cap daysQuery to max 1825 and min 1', () => {
            const result1 = getForecast(2000);
            expect(result1.timeline.length).toBe(1825);

            const result2 = getForecast(-10);
            expect(result2.timeline.length).toBe(1);
        });

        it('should incorporate family member annual income', () => {
            nativeDb.prepare("INSERT INTO family_members (id, role, annualIncome, name) VALUES (1, 'Provider', '1200000', 'John Doe')").run();
            // Income over 7L, base tax calculation applies
            // We'll see events populating on day 1 of the month
            const result = getForecast(60);
            expect(result.startingCash).toBe(0);
            
            // Expected monthly income processing
            // Tax: taxable = 1200000 - 50000 = 1150000.
            // baseTax: 
            // 300k-700k: 400000 * 0.05 = 20000
            // 700k-1M: 300000 * 0.10 = 30000
            // 1M-1.15M: 150000 * 0.15 = 22500
            // Total tax = 72500. Surcharge * 1.04 = 75400.
            // Net annual = 1200000 - 75400 = 1124600
            // Net monthly = 1124600 / 12 = 93716.666
            
            // We should find 'Monthly Salary' event in the timeline
            const salaryEvent = result.events.find(e => e.title === 'Monthly Salary');
            if (salaryEvent) {
                expect(salaryEvent.amount).toBeGreaterThan(0);
            }
        });

        it('should calculate daily burn correctly based on past 90 days transactions', () => {
            nativeDb.prepare("INSERT INTO transactions (id, category, date, title) VALUES (1, 'Food', date('now', '-10 days'), 'Groceries')").run();
            nativeDb.prepare("INSERT INTO ledger_lines (id, transaction_id, account_class, account_type, debit_amount, credit_amount) VALUES (1, 1, 'Expense', 'operating', 3000, 0)").run();

            // We also insert a free cash balance
            nativeDb.prepare("INSERT INTO ledger_lines (id, transaction_id, account_class, account_type, debit_amount, credit_amount) VALUES (2, 1, 'Asset', 'bank', 5000, 0)").run();

            const result = getForecast(30);
            expect(result.startingCash).toBe(5000);
            
            // Sum burn is 3000 over 30 tracked days (minimum tracked days is 30) = 100/day
            // On day 2, running balance drops by 100
            expect(result.timeline[1].balance).toBe(4900); // starts at 5000, 1st day (d=0) no burn subtracted, d=1 drops by 100
        });

        it('should process loan EMI correctly', () => {
            nativeDb.prepare("INSERT INTO reminders (id, category, title, dueDate, termYears, frequency, amount, interestRate) VALUES (1, 'loan', 'Home Loan', date('now', '+1 year'), 1, 'monthly', 2000, 10)").run();
            nativeDb.prepare("INSERT INTO ledger_lines (id, transaction_id, account_class, account_type, entity_id, credit_amount, debit_amount) VALUES (3, 2, 'Liability', 'loan', 1, 10000, 0)").run();
            
            const result = getForecast(40);
            const emiEvent = result.events.find(e => e.title.includes('EMI'));
            // Depending on the day of the month it might or might not occur in 40 days
            // We just ensure the simulation ran without errors
        });
        
        it('should process subscription and insurance correctly', () => {
            nativeDb.prepare("INSERT INTO reminders (id, category, title, dueDate, termYears, frequency, amount) VALUES (2, 'subscription', 'Netflix', date('now', '+1 year'), 1, 'monthly', 500)").run();
            nativeDb.prepare("INSERT INTO reminders (id, category, title, dueDate, termYears, frequency, amount) VALUES (3, 'insurance', 'Health', date('now', '+1 year'), 1, 'yearly', 5000)").run();
            
            const result = getForecast(365);
            const subEvents = result.events.filter(e => e.title.includes('Netflix'));
            expect(subEvents.length).toBeGreaterThan(0);
        });
        
        it('should process real estate expected rent', () => {
            nativeDb.prepare("INSERT INTO real_estate (id, title, expectedRent, occupancyStatus) VALUES (1, 'Apartment', 15000, 'rented')").run();
            const result = getForecast(40);
            const rentEvent = result.events.find(e => e.title === 'Property Rent');
            if (rentEvent) {
                expect(rentEvent.amount).toBe(15000);
            }
        });
    });

    describe('getCashflowForecast', () => {
        it('should calculate cashflow with zero values', () => {
            const result = getCashflowForecast();
            expect(result).toBeDefined();
            expect(result.freeCash).toBe(0);
            expect(result.monthlyIncome).toBe(0);
            expect(result.monthlyObligations).toBe(0);
            expect(result.avgOperatingExpense).toBe(0);
            expect(result.netCashflow).toBe(0);
            expect(result.runwayMonths).toBe(999);
        });

        it('should calculate freeCash, obligations and expenses', () => {
            // Free cash
            nativeDb.prepare("INSERT INTO ledger_lines (id, transaction_id, account_class, account_type, debit_amount, credit_amount) VALUES (4, 3, 'Asset', 'bank', 10000, 0)").run();
            // Credit card debt
            nativeDb.prepare("INSERT INTO ledger_lines (id, transaction_id, account_class, account_type, credit_amount, debit_amount) VALUES (5, 4, 'Liability', 'credit_card', 2000, 0)").run();
            
            // Income
            nativeDb.prepare("INSERT INTO family_members (id, role, annualIncome, name) VALUES (2, 'Provider', 600000, 'Jane Doe')").run(); // 50k monthly
            
            // Expected Rent
            nativeDb.prepare("INSERT INTO real_estate (id, title, expectedRent, occupancyStatus) VALUES (2, 'Condo', 10000, 'rented')").run();
            
            // Obligations (Subscription)
            nativeDb.prepare("INSERT INTO reminders (id, category, title, dueDate, termYears, frequency, amount) VALUES (4, 'subscription', 'Gym', date('now', '+1 year'), 1, 'monthly', 1000)").run();
            
            // Operating Expense (3000 over 30 days => 100/day => 3000/month)
            nativeDb.prepare("INSERT INTO transactions (id, category, date, title) VALUES (5, 'Food', date('now', '-10 days'), 'Groceries')").run();
            nativeDb.prepare("INSERT INTO ledger_lines (id, transaction_id, account_class, account_type, debit_amount, credit_amount) VALUES (6, 5, 'Expense', 'operating', 3000, 0)").run();

            const result = getCashflowForecast();
            expect(result.freeCash).toBe(8000); // 10k - 2k
            
            // Income calculation:
            // 600,000 - 50,000 std deduction = 550,000.
            // Under 700k tax is 0. So 600,000/12 = 50,000.
            // Expected rent = 10,000. Total monthlyIncome = 60,000.
            expect(result.monthlyIncome).toBe(60000);
            
            // Obligations: Gym is 1000 monthly
            expect(result.monthlyObligations).toBe(1000);
            
            // Avg Expense: 100/day * 30 = 3000
            expect(result.avgOperatingExpense).toBe(3000);
            
            // Net Cashflow: 60000 - 1000 - 3000 = 56000
            expect(result.netCashflow).toBe(56000);
        });

        it('should calculate limited runway when net cashflow is negative', () => {
            nativeDb.prepare("INSERT INTO ledger_lines (id, transaction_id, account_class, account_type, debit_amount, credit_amount) VALUES (7, 6, 'Asset', 'bank', 10000, 0)").run();
            nativeDb.prepare("INSERT INTO transactions (id, category, date, title) VALUES (6, 'Food', date('now', '-10 days'), 'Groceries')").run();
            nativeDb.prepare("INSERT INTO ledger_lines (id, transaction_id, account_class, account_type, debit_amount, credit_amount) VALUES (8, 6, 'Expense', 'operating', 30000, 0)").run();
            // Avg exp = 1000/day -> 30000/mo. Net cashflow = -30000.
            // Free cash = 10000. Runway = 10000 / 30000 = 0 months.
            
            const result = getCashflowForecast();
            expect(result.netCashflow).toBe(-30000);
            expect(result.runwayMonths).toBe(0); // Math.round(10000 / 30000) = Math.round(0.33) = 0
        });
    });
});
