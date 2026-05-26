import Papa from 'papaparse';

export const EXPECTED_HEADERS = [
  'firstName', 'lastName', 'email', 'jobTitle',
  'department', 'country', 'salary', 'hireDate',
] as const;

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 500;

export interface RawCsvRow {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  country: string;
  salary: string;
  hireDate: string;
}

export type ParseResult =
  | { ok: true; rows: RawCsvRow[] }
  | { ok: false; message: string };

export function parseCsv(file: File): Promise<ParseResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);

    return Promise.resolve({
      ok: false,
      message: `File is too large (${sizeMb} MB). Maximum is 2 MB.`,
    });
  }

  return new Promise((resolve) => {
    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        const missing = EXPECTED_HEADERS.filter((h) => !headers.includes(h));

        if (missing.length > 0) {
          resolve({
            ok: false,
            message: `Missing column: ${missing.join(', ')}. Download the template for the expected format.`,
          });

          return;
        }

        const extra = headers.filter((h) => !(EXPECTED_HEADERS as readonly string[]).includes(h));

        if (extra.length > 0) {
          resolve({
            ok: false,
            message: `Unknown column: ${extra.join(', ')}. Remove it and try again.`,
          });

          return;
        }

        if (result.errors.length > 0) {
          resolve({
            ok: false,
            message: 'Could not parse file as CSV. Make sure it was exported as CSV (not XLSX).',
          });

          return;
        }

        if (result.data.length === 0) {
          resolve({ ok: false, message: 'File has no data rows.' });

          return;
        }

        if (result.data.length > MAX_ROWS) {
          resolve({
            ok: false,
            message: `Too many rows (${result.data.length}). Maximum is 500 per import — split the file.`,
          });

          return;
        }

        resolve({ ok: true, rows: result.data });
      },
    });
  });
}
