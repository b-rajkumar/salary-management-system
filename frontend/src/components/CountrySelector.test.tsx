import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CountrySelector } from './CountrySelector';

describe('CountrySelector', () => {
  test('renders a combobox with the "Country" label', () => {
    render(<CountrySelector value={null} onChange={() => {}} />);

    expect(screen.getByRole('combobox', { name: /country/i })).toBeInTheDocument();
  });

  test('shows the country name (not the ISO code) as the selected display when a value is set', () => {
    render(<CountrySelector value="IN" onChange={() => {}} />);

    expect(screen.getByRole('combobox', { name: /country/i })).toHaveValue('India');
  });

  test('calls onChange with the ISO code when a country is picked', async () => {
    const onChange = jest.fn();

    render(<CountrySelector value={null} onChange={onChange} />);

    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: /country/i }));
    await user.click(await screen.findByText('India'));

    expect(onChange).toHaveBeenCalledWith('IN');
  });

  test('calls onChange(null) when cleared', async () => {
    const onChange = jest.fn();

    render(<CountrySelector value="IN" onChange={onChange} />);

    const user = userEvent.setup();

    await user.click(screen.getByLabelText(/clear/i));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
