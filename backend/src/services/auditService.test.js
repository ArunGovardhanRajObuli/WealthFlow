const { nativeDb } = require('../../database');
const auditService = require('./auditService');

describe('Audit Service', () => {
const { insertTxWithLedger, decorateTx, getTx } = require('../utils/testHelpers');

    beforeAll(() => {
        nativeDb.prepare('DELETE FROM audit_logs').run();
    });

    afterEach(() => {
        nativeDb.prepare('DELETE FROM audit_logs').run();
    });

    describe('createAuditLog', () => {
        it('should create an audit log successfully', () => {
            auditService.createAuditLog('CREATE', 'Transaction', 1, { amount: 100 });

            const logs = nativeDb.prepare('SELECT * FROM audit_logs').all();
            expect(logs.length).toBe(1);
            expect(logs[0].action).toBe('CREATE');
            expect(logs[0].entity).toBe('Transaction');
            expect(logs[0].entity_id).toBe(1);
            expect(JSON.parse(logs[0].details)).toEqual({ amount: 100 });
            expect(logs[0].timestamp).toBeDefined();
        });

        it('should handle null details by saving an empty object', () => {
            auditService.createAuditLog('UPDATE', 'Transaction', 2, null);

            const logs = nativeDb.prepare('SELECT * FROM audit_logs').all();
            expect(logs.length).toBe(1);
            expect(logs[0].action).toBe('UPDATE');
            expect(logs[0].entity).toBe('Transaction');
            expect(logs[0].entity_id).toBe(2);
            expect(JSON.parse(logs[0].details)).toEqual({});
        });

        it('should handle undefined details by saving an empty object', () => {
            auditService.createAuditLog('DELETE', 'Transaction', 3);

            const logs = nativeDb.prepare('SELECT * FROM audit_logs').all();
            expect(logs.length).toBe(1);
            expect(logs[0].action).toBe('DELETE');
            expect(logs[0].entity).toBe('Transaction');
            expect(logs[0].entity_id).toBe(3);
            expect(JSON.parse(logs[0].details)).toEqual({});
        });

        it('should handle missing entity_id as null or undefined', () => {
            auditService.createAuditLog('SYSTEM_START', 'System', null, { version: '1.0' });

            const logs = nativeDb.prepare('SELECT * FROM audit_logs').all();
            expect(logs.length).toBe(1);
            expect(logs[0].action).toBe('SYSTEM_START');
            expect(logs[0].entity).toBe('System');
            expect(logs[0].entity_id).toBeNull();
            expect(JSON.parse(logs[0].details)).toEqual({ version: '1.0' });
        });
    });

    describe('getAuditLogs', () => {
        it('should return an empty array when there are no logs', () => {
            const result = auditService.getAuditLogs();
            expect(result).toEqual([]);
        });

        it('should return all audit logs ordered by timestamp DESC', () => {
            // Insert dummy data
            const stmt = nativeDb.prepare('INSERT INTO audit_logs (timestamp, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)');
            stmt.run('2023-01-01 10:00:00', 'A', 'E1', 1, '{}');
            stmt.run('2023-01-03 10:00:00', 'C', 'E3', 3, '{}');
            stmt.run('2023-01-02 10:00:00', 'B', 'E2', 2, '{}');

            const result = auditService.getAuditLogs();
            
            expect(result.length).toBe(3);
            // Verify order (DESC)
            expect(result[0].action).toBe('C');
            expect(result[1].action).toBe('B');
            expect(result[2].action).toBe('A');
        });

        it('should limit the results to 100 logs', () => {
            const stmt = nativeDb.prepare('INSERT INTO audit_logs (timestamp, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)');
            
            // Insert 105 logs
            nativeDb.transaction(() => {
                for (let i = 0; i < 105; i++) {
                    // Padding i to ensure proper string sorting if timestamp is identical, 
                    // though we use different seconds
                    const seconds = (i % 60).toString().padStart(2, '0');
                    const minutes = (Math.floor(i / 60)).toString().padStart(2, '0');
                    stmt.run(`2023-01-01 10:${minutes}:${seconds}`, `ACTION_${i}`, 'E', i, '{}');
                }
            })();

            const result = auditService.getAuditLogs();
            
            expect(result.length).toBe(100);
            
            // The latest timestamp should be 10:01:44 (which is i=104)
            // So result[0] should be ACTION_104
            expect(result[0].action).toBe('ACTION_104');
            // The 100th element should be ACTION_5 (105-100 = 5)
            expect(result[99].action).toBe('ACTION_5');
        });
    });
});
