import { act, render, screen } from '@testing-library/react';
import { InsightsCard } from './InsightsCard';
import * as countryHook from '../hooks/useCountryInsights';
import * as roleHook from '../hooks/useRoleInsights';

const countryData = {
  country: 'IN', currency: 'INR', count: 312,
  salary: { min: 600000, max: 4500000, avg: 1820000 },
  tenure: { avgYears: 3.4, newHiresLast12Months: 47 },
  departments: [
    { department: 'Engineering', headcount: 180, avgSalary: 2100000 },
    { department: 'Sales',        headcount: 78,  avgSalary: 1400000 },
  ],
};

const roleData = {
  country: 'IN', jobTitle: 'Software Engineer', currency: 'INR', count: 47,
  salary: { min: 1400000, max: 3800000, avg: 2250000 },
  tenure: { avgYears: 2.8, newHiresLast12Months: 9 },
};

describe('InsightsCard', () => {
  let countrySpy: jest.SpyInstance;
  let roleSpy: jest.SpyInstance;

  beforeEach(() => {
    countrySpy = jest.spyOn(countryHook, 'useCountryInsights');
    roleSpy = jest.spyOn(roleHook, 'useRoleInsights');
  });

  afterEach(() => {
    countrySpy.mockRestore();
    roleSpy.mockRestore();
  });

  test('renders nothing during the first 200ms of loading (avoids a flash for fast responses)', () => {
    countrySpy.mockReturnValue({ result: null, isLoading: true, error: null });
    roleSpy.mockReturnValue({ result: null, isLoading: false, error: null });
    const { container } = render(<InsightsCard country="IN" role={null} />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  test('shows a centered spinner once the loading indicator delay elapses', () => {
    jest.useFakeTimers();
    try {
      countrySpy.mockReturnValue({ result: null, isLoading: true, error: null });
      roleSpy.mockReturnValue({ result: null, isLoading: false, error: null });
      render(<InsightsCard country="IN" role={null} />);

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

      act(() => { jest.advanceTimersByTime(250); });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  test('renders an error alert when the country fetch fails', () => {
    countrySpy.mockReturnValue({ result: null, isLoading: false, error: 'boom' });
    roleSpy.mockReturnValue({ result: null, isLoading: false, error: null });

    render(<InsightsCard country="IN" role={null} />);

    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  test('renders the inline empty state when the country has no employees', () => {
    countrySpy.mockReturnValue({ result: { kind: 'empty' }, isLoading: false, error: null });
    roleSpy.mockReturnValue({ result: null, isLoading: false, error: null });

    render(<InsightsCard country="AQ" role={null} />);

    expect(screen.getByText(/no employees/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('renders the country layout (mean salary headline + departments) when role is null', () => {
    countrySpy.mockReturnValue({ result: { kind: 'ok', data: countryData }, isLoading: false, error: null });
    roleSpy.mockReturnValue({ result: null, isLoading: false, error: null });

    render(<InsightsCard country="IN" role={null} />);

    // "Mean salary" overline above the h4 mean number.
    expect(screen.getByText(/mean salary/i)).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 4 });

    expect(heading.textContent?.replace(/\D/g, '')).toBe('1820000');

    expect(screen.getByText('312')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.queryByText(/vs all roles/i)).not.toBeInTheDocument();
  });

  test('renders the role data with comparison delta and HIDES departments when role is selected', () => {
    countrySpy.mockReturnValue({ result: { kind: 'ok', data: countryData }, isLoading: false, error: null });
    roleSpy.mockReturnValue({ result: { kind: 'ok', data: roleData }, isLoading: false, error: null });

    render(<InsightsCard country="IN" role="Software Engineer" />);

    // Role title is the overline above the salary headline.
    expect(screen.getByText(/software engineer in india/i)).toBeInTheDocument();

    // Salary heading shows the role's mean (₹22,50,000), not the country mean.
    const heading = screen.getByRole('heading', { level: 4 });

    expect(heading.textContent?.replace(/\D/g, '')).toContain('2250000');

    // Comparison delta is computed from (2250000 - 1820000) / 1820000 ≈ +0.236 → +24%
    expect(screen.getByText(/\+24% vs all roles/i)).toBeInTheDocument();

    // Role headcount, not country headcount.
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.queryByText('312')).not.toBeInTheDocument();

    // Departments table is hidden in role view.
    expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
  });

  test('renders the inline empty state inside the salary card when the role has no employees', () => {
    countrySpy.mockReturnValue({ result: { kind: 'ok', data: countryData }, isLoading: false, error: null });
    roleSpy.mockReturnValue({ result: { kind: 'empty' }, isLoading: false, error: null });

    render(<InsightsCard country="IN" role="Nope" />);

    expect(screen.getByText(/no employees with title nope in india/i)).toBeInTheDocument();
  });

  test('renders a negative comparison delta in muted red and a minus sign', () => {
    const lowerRole = {
      ...roleData,
      salary: { min: 1, max: 1, avg: 1500000 }, // 1500000 vs country 1820000 → -17%
    };

    countrySpy.mockReturnValue({ result: { kind: 'ok', data: countryData }, isLoading: false, error: null });
    roleSpy.mockReturnValue({ result: { kind: 'ok', data: lowerRole }, isLoading: false, error: null });

    render(<InsightsCard country="IN" role="Software Engineer" />);

    expect(screen.getByText(/-18% vs all roles/i)).toBeInTheDocument();
  });
});
