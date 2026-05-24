import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobTitleSelector } from './JobTitleSelector';
import * as api from '../api/insights';

describe('JobTitleSelector', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(api, 'getJobTitles').mockResolvedValue(['Designer', 'Software Engineer']);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  test('is disabled when country is null and shows the helper text "Pick a country first"', () => {
    render(<JobTitleSelector country={null} value={null} onChange={() => {}} />);

    const combobox = screen.getByRole('combobox', { name: /role/i });

    expect(combobox).toBeDisabled();
    expect(screen.getByText(/pick a country first/i)).toBeInTheDocument();
  });

  test('is enabled when a country is selected and fetches titles', async () => {
    render(<JobTitleSelector country="IN" value={null} onChange={() => {}} />);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('IN');
    });

    const combobox = screen.getByRole('combobox', { name: /role/i });

    expect(combobox).not.toBeDisabled();
  });

  test('renders "All roles" sentinel and calls onChange(null) when picked', async () => {
    const onChange = jest.fn();

    render(<JobTitleSelector country="IN" value="Software Engineer" onChange={onChange} />);

    await waitFor(() => { expect(spy).toHaveBeenCalled(); });
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: /role/i }));
    await user.click(await screen.findByText('All roles'));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  test('renders fetched titles and calls onChange(title) when picked', async () => {
    const onChange = jest.fn();

    render(<JobTitleSelector country="IN" value={null} onChange={onChange} />);

    await waitFor(() => { expect(spy).toHaveBeenCalled(); });
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: /role/i }));
    await user.click(await screen.findByText('Software Engineer'));

    expect(onChange).toHaveBeenCalledWith('Software Engineer');
  });

  test('shows the "No roles in {country}" helper when the picker returns an empty list', async () => {
    spy.mockResolvedValueOnce([]);
    render(<JobTitleSelector country="IN" value={null} onChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/no roles in india/i)).toBeInTheDocument();
    });
  });
});
