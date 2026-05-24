import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightsPage } from './InsightsPage';
import * as countryHook from '../hooks/useCountryInsights';
import * as roleHook from '../hooks/useRoleInsights';
import * as titlesHook from '../hooks/useJobTitles';

const countryData = {
  country: 'IN', currency: 'INR', count: 1,
  salary: { min: 1, max: 1, avg: 1 },
  tenure: { avgYears: 1, newHiresLast12Months: 0 },
  departments: [],
};

describe('InsightsPage', () => {
  let countrySpy: jest.SpyInstance;
  let roleSpy: jest.SpyInstance;
  let titlesSpy: jest.SpyInstance;

  beforeEach(() => {
    countrySpy = jest.spyOn(countryHook, 'useCountryInsights').mockReturnValue({
      result: { kind: 'ok', data: countryData }, isLoading: false, error: null,
    });
    roleSpy = jest.spyOn(roleHook, 'useRoleInsights').mockReturnValue({
      result: null, isLoading: false, error: null,
    });
    titlesSpy = jest.spyOn(titlesHook, 'useJobTitles').mockReturnValue({
      titles: ['Designer', 'Software Engineer'], isLoading: false, error: null,
    });
  });

  afterEach(() => {
    countrySpy.mockRestore();
    roleSpy.mockRestore();
    titlesSpy.mockRestore();
  });

  test('renders the "select a country" hint when no country is picked', () => {
    render(<InsightsPage />);

    expect(screen.getByText(/select a country/i)).toBeInTheDocument();
  });

  test('renders both selectors with the role one initially disabled', () => {
    render(<InsightsPage />);

    expect(screen.getByRole('combobox', { name: /country/i })).toBeInTheDocument();
    const roleCombobox = screen.getByRole('combobox', { name: /role/i });

    expect(roleCombobox).toBeDisabled();
  });

  test('mounts the InsightsCard and enables the role selector after a country is picked', async () => {
    render(<InsightsPage />);

    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: /country/i }));
    await user.click(await screen.findByText('India'));

    await waitFor(() => {
      expect(countrySpy).toHaveBeenCalledWith('IN');
    });

    expect(screen.getByRole('combobox', { name: /role/i })).not.toBeDisabled();
  });

  test('clears the selected role and refetches when the country changes', async () => {
    render(<InsightsPage />);

    const user = userEvent.setup();

    // Pick India
    await user.click(screen.getByRole('combobox', { name: /country/i }));
    await user.click(await screen.findByText('India'));

    // Pick a role
    await user.click(screen.getByRole('combobox', { name: /role/i }));
    await user.click(await screen.findByText('Software Engineer'));

    // The role hook should have been called with the selected role.
    await waitFor(() => {
      expect(roleSpy).toHaveBeenCalledWith('IN', 'Software Engineer');
    });

    // Switch country
    await user.click(screen.getByRole('combobox', { name: /country/i }));
    await user.click(await screen.findByText('United States'));

    // After the country change, the role should reset → useRoleInsights called with role=null
    await waitFor(() => {
      expect(roleSpy).toHaveBeenLastCalledWith('US', null);
    });
  });
});
