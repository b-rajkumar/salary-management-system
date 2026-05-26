import { employeeCreateSchema, type EmployeeCreateInput, type BulkErrorItem } from '@app/shared';
import type { RawCsvRow } from './parseCsv';

export type ValidationResult =
  | { ok: true; parsed: EmployeeCreateInput[] }
  | { ok: false; errors: BulkErrorItem[] };

function coerceRow(raw: RawCsvRow): Record<string, unknown> {
  return { ...raw, salary: Number(raw.salary) };
}

export function validateBulkRows(rows: RawCsvRow[]): ValidationResult {
  const errors: BulkErrorItem[] = [];
  const parsed: EmployeeCreateInput[] = [];

  rows.forEach((row, index) => {
    const result = employeeCreateSchema.safeParse(coerceRow(row));

    if (result.success) {
      parsed.push(result.data);
    } else {
      for (const issue of result.error.issues) {
        errors.push({
          index,
          field: typeof issue.path[0] === 'string' ? issue.path[0] : '_row',
          message: issue.message,
        });
      }
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, parsed };
}
