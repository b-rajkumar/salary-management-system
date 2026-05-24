import { render, screen, act } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { FormField } from './FormField';

function Harness({
  exposeSetError,
}: {
  exposeSetError?: (fn: (msg: string) => void) => void;
} = {}) {
  const { control, setError } = useForm<{ name: string }>({
    defaultValues: { name: '' },
  });

  exposeSetError?.((msg) => setError('name', { message: msg }));

  return <FormField name="name" control={control} label="Full name" />;
}

describe('FormField', () => {
  it('renders with the provided label', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
  });

  it('shows the field error from RHF fieldState in helperText', async () => {
    let fail: ((msg: string) => void) | undefined;

    render(<Harness exposeSetError={(fn) => (fail = fn)} />);
    await act(async () => {
      fail!('Custom error here');
    });
    expect(await screen.findByText('Custom error here')).toBeInTheDocument();
  });
});
