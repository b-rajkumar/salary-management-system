import { formatSalary } from './formatSalary';

describe('formatSalary', () => {
  test('formats an INR amount with the rupee symbol or currency code, preserving the integer value', () => {
    const out = formatSalary(1500000, 'INR');

    expect(out).toMatch(/₹|INR/);
    expect(out.replace(/\D/g, '')).toBe('1500000');
  });

  test('formats a USD amount with the dollar symbol or currency code, preserving the integer value', () => {
    const out = formatSalary(100000, 'USD');

    expect(out).toMatch(/\$|USD/);
    expect(out.replace(/\D/g, '')).toBe('100000');
  });

  test('drops fractional digits', () => {
    const out = formatSalary(100000, 'USD');

    expect(out).not.toMatch(/\.00/);
  });
});
