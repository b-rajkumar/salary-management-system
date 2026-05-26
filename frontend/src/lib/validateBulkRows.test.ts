import { validateBulkRows } from './validateBulkRows';
import type { RawCsvRow } from './parseCsv';

const goodRow: RawCsvRow = {
  firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com',
  jobTitle: 'Software Engineer', department: 'Engineering',
  country: 'IN', salary: '1500000', hireDate: '2024-03-12',
};

describe('validateBulkRows', () => {
  test('returns { ok: true, parsed } for a well-formed batch and coerces salary to number', () => {
    const result = validateBulkRows([goodRow, { ...goodRow, email: 'b@x.com' }]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed).toHaveLength(2);
      expect(result.parsed[0].salary).toBe(1500000);
      expect(typeof result.parsed[0].salary).toBe('number');
    }
  });

  test('returns { ok: false, errors } with one BulkErrorItem per Zod issue', () => {
    const rows: RawCsvRow[] = [
      goodRow,
      { ...goodRow, email: 'not-an-email' },
      { ...goodRow, salary: '-5', country: 'ZZ' },
    ];
    const result = validateBulkRows(rows);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ index: 1, field: 'email' }),
        expect.objectContaining({ index: 2, field: 'salary' }),
        expect.objectContaining({ index: 2, field: 'country' }),
      ]));
    }
  });

  test('flags an unparseable salary as a salary-field error', () => {
    const result = validateBulkRows([{ ...goodRow, salary: 'abc' }]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe('salary');
    }
  });
});
