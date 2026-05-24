import { render, screen } from '@testing-library/react';
import { SalaryRangeBar } from './SalaryRangeBar';

describe('SalaryRangeBar', () => {
  test('positions the marker at the percentage corresponding to mean within [min, max]', () => {
    render(<SalaryRangeBar min={100} mean={200} max={500} currency="INR" />);

    const marker = screen.getByTestId('salary-range-marker');

    // (200 - 100) / (500 - 100) = 0.25
    expect(marker.style.left).toBe('25%');
  });

  test('positions the marker at 50% when mean === min === max', () => {
    render(<SalaryRangeBar min={100} mean={100} max={100} currency="INR" />);

    const marker = screen.getByTestId('salary-range-marker');

    expect(marker.style.left).toBe('50%');
  });

  test('clamps the marker to 0% when mean is below min', () => {
    render(<SalaryRangeBar min={200} mean={100} max={500} currency="INR" />);

    const marker = screen.getByTestId('salary-range-marker');

    expect(marker.style.left).toBe('0%');
  });

  test('clamps the marker to 100% when mean is above max', () => {
    render(<SalaryRangeBar min={100} mean={600} max={500} currency="INR" />);

    const marker = screen.getByTestId('salary-range-marker');

    expect(marker.style.left).toBe('100%');
  });

  test('renders min and max captions formatted in the given currency', () => {
    render(<SalaryRangeBar min={1400000} mean={2250000} max={3800000} currency="INR" />);

    // Some space/character variations exist in Intl output across platforms — match the digits.
    expect(screen.getByText(/14,00,000|1,400,000/)).toBeInTheDocument();
    expect(screen.getByText(/38,00,000|3,800,000/)).toBeInTheDocument();
  });
});
