import { parseCsv, EXPECTED_HEADERS } from './parseCsv';

const header = EXPECTED_HEADERS.join(',');
const row    = 'Asha,Rao,asha@example.com,Software Engineer,Engineering,IN,1500000,2024-03-12';

function makeFile(content: string, opts: { name?: string; size?: number } = {}): File {
  const file = new File([content], opts.name ?? 'test.csv', { type: 'text/csv' });

  if (opts.size !== undefined) {
    Object.defineProperty(file, 'size', { value: opts.size });
  }

  return file;
}

describe('parseCsv', () => {
  test('returns rows for a well-formed CSV', async () => {
    const result = await parseCsv(makeFile(`${header}\n${row}`));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].email).toBe('asha@example.com');
    }
  });

  test('rejects a missing required column', async () => {
    const shortHeader = 'firstName,lastName,email,jobTitle,department,country,salary';
    const result = await parseCsv(makeFile(`${shortHeader}\nAsha,Rao,a@x.com,SE,Eng,IN,1`));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/missing column.*hireDate/i);
    }
  });

  test('rejects an unknown extra column', async () => {
    const longHeader = `${header},currency`;
    const result = await parseCsv(makeFile(`${longHeader}\n${row},INR`));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/unknown column.*currency/i);
    }
  });

  test('rejects a file larger than 2 MB before parsing', async () => {
    const result = await parseCsv(makeFile(`${header}\n${row}`, { size: 3 * 1024 * 1024 }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/too large/i);
    }
  });

  test('rejects a CSV with zero data rows', async () => {
    const result = await parseCsv(makeFile(header));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/no data rows/i);
    }
  });

  test('rejects a CSV with more than 500 data rows', async () => {
    const rows = Array.from({ length: 501 }, () => row);
    const result = await parseCsv(makeFile(`${header}\n${rows.join('\n')}`));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/maximum is 500/i);
    }
  });
});
