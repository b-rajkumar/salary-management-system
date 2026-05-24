import { render, screen } from '@testing-library/react';
import { CountryInsightsCard } from './CountryInsightsCard';
import * as hook from '../hooks/useCountryInsights';

const successData = {
  country: 'IN', currency: 'INR', count: 312,
  salary: { min: 600000, max: 4500000, avg: 1820000 },
  tenure: { avgYears: 3.4, newHiresLast12Months: 47 },
  departments: [
    { department: 'Engineering', headcount: 180, avgSalary: 2100000 },
    { department: 'Sales',        headcount: 78,  avgSalary: 1400000 },
  ],
};

describe('CountryInsightsCard', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(hook, 'useCountryInsights');
  });

  afterEach(() => {
    spy.mockRestore();
  });

  test('renders skeletons while loading', () => {
    spy.mockReturnValue({ result: null, isLoading: true, error: null });
    const { container } = render(<CountryInsightsCard country="IN" />);

    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  test('renders an error alert on hard error', () => {
    spy.mockReturnValue({ result: null, isLoading: false, error: 'boom' });

    render(<CountryInsightsCard country="IN" />);

    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  test('renders the inline empty state for the empty branch (not an alert)', () => {
    spy.mockReturnValue({ result: { kind: 'empty' }, isLoading: false, error: null });

    render(<CountryInsightsCard country="AQ" />);

    expect(screen.getByText(/no employees/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('renders mean salary as the headline, formatted in the response currency', () => {
    spy.mockReturnValue({ result: { kind: 'ok', data: successData }, isLoading: false, error: null });

    render(<CountryInsightsCard country="IN" />);

    const heading = screen.getByRole('heading', { level: 4 });

    expect(heading.textContent?.replace(/\D/g, '')).toBe('1820000');
    expect(heading.textContent).toMatch(/₹|INR/);
  });

  test('renders min and max as supporting captions', () => {
    spy.mockReturnValue({ result: { kind: 'ok', data: successData }, isLoading: false, error: null });

    render(<CountryInsightsCard country="IN" />);

    expect(screen.getByText(/^Min/i).textContent?.replace(/\D/g, '')).toBe('600000');
    expect(screen.getByText(/^Max/i).textContent?.replace(/\D/g, '')).toBe('4500000');
  });

  test('renders the headcount, avg tenure and new-hires stats', () => {
    spy.mockReturnValue({ result: { kind: 'ok', data: successData }, isLoading: false, error: null });

    render(<CountryInsightsCard country="IN" />);

    expect(screen.getByText('312')).toBeInTheDocument();
    expect(screen.getByText(/3\.4/)).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
  });

  test('renders departments rows in the order returned by the api', () => {
    spy.mockReturnValue({ result: { kind: 'ok', data: successData }, isLoading: false, error: null });

    render(<CountryInsightsCard country="IN" />);

    const rows = screen.getAllByRole('row');
    // header + 2 data rows
    expect(rows.length).toBe(3);
    expect(rows[1].textContent).toMatch(/Engineering.*180/);
    expect(rows[2].textContent).toMatch(/Sales.*78/);
  });
});
