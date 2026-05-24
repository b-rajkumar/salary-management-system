import { render, screen } from '@testing-library/react';
import { SalaryCell } from './SalaryCell';

function digitsOnly(s: string): string {
  return s.replace(/[^\d]/g, '');
}

describe('SalaryCell', () => {
  test('formats an INR salary with the INR currency token and the right digits', () => {
    const { container } = render(<SalaryCell amount={1500000} country="IN" />);
    const text = container.textContent ?? '';

    expect(text).toMatch(/₹|INR/);
    expect(digitsOnly(text)).toBe('1500000');
  });

  test('formats a USD salary with $ and the right digits', () => {
    const { container } = render(<SalaryCell amount={150000} country="US" />);
    const text = container.textContent ?? '';

    expect(text).toContain('$');
    expect(digitsOnly(text)).toBe('150000');
  });

  test('renders an integer (no fractional cents)', () => {
    render(<SalaryCell amount={150000} country="US" />);

    expect(screen.queryByText(/\.00/)).not.toBeInTheDocument();
  });
});
