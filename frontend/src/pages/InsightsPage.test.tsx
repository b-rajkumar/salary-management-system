import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightsPage } from './InsightsPage';
import * as hook from '../hooks/useCountryInsights';

describe('InsightsPage', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(hook, 'useCountryInsights').mockReturnValue({
      result: null, isLoading: false, error: null,
    });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  test('renders the "select a country" hint when no country is picked', () => {
    render(<InsightsPage />);

    expect(screen.getByText(/select a country/i)).toBeInTheDocument();
  });

  test('renders the Section B placeholder for FR-6', () => {
    render(<InsightsPage />);

    expect(screen.getByText(/role-in-country.*FR-6/i)).toBeInTheDocument();
  });

  test('mounts the CountryInsightsCard after a country is picked', async () => {
    render(<InsightsPage />);

    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: /country/i }));
    await user.click(await screen.findByText('India'));

    expect(spy).toHaveBeenCalledWith('IN');
  });
});
