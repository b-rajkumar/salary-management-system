import { render, screen } from '@testing-library/react';
import { BulkErrorTable } from './BulkErrorTable';
import type { BulkErrorItem } from '@app/shared';

describe('BulkErrorTable', () => {
  test('renders one row per error and translates index to CSV row (index + 2)', () => {
    const errors: BulkErrorItem[] = [
      { index: 0, field: 'email',  message: 'Invalid email' },
      { index: 4, field: 'salary', message: 'Expected non-negative integer' },
    ];

    render(<BulkErrorTable errors={errors} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
    expect(screen.getByText('Expected non-negative integer')).toBeInTheDocument();
  });

  test('shows summary with total errors and unique row count', () => {
    const errors: BulkErrorItem[] = [
      { index: 0, field: 'email',   message: 'msg' },
      { index: 0, field: 'salary',  message: 'msg' },
      { index: 4, field: 'country', message: 'msg' },
    ];

    render(<BulkErrorTable errors={errors} />);

    expect(screen.getByText(/3 errors in 2 rows/i)).toBeInTheDocument();
  });

  test('truncates at 500 with an "and N more" footer', () => {
    const errors: BulkErrorItem[] = Array.from({ length: 600 }, (_, i) => ({
      index: i, field: 'email', message: `err ${i}`,
    }));

    render(<BulkErrorTable errors={errors} />);

    expect(screen.getByText(/and 100 more/i)).toBeInTheDocument();
  });
});
