import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportEmployeesModal } from './ImportEmployeesModal';
import { bulkCreateEmployees } from '../api/employees';
import { ApiError } from '../api/client';

jest.mock('../api/employees', () => ({
  bulkCreateEmployees: jest.fn(),
}));

const goodCsv =
  'firstName,lastName,email,jobTitle,department,country,salary,hireDate\n' +
  'Asha,Rao,asha@example.com,SE,Engineering,IN,1500000,2024-03-12\n' +
  'Bob,Lee,bob@example.com,SE,Engineering,IN,1500000,2024-03-12\n';

function asFile(content: string, name = 'test.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

async function upload(file: File): Promise<void> {
  const input = screen.getByLabelText(/csv file/i) as HTMLInputElement;

  fireEvent.change(input, { target: { files: [file] } });
}

describe('ImportEmployeesModal', () => {
  beforeEach(() => {
    (bulkCreateEmployees as jest.Mock).mockReset();
  });

  test('shows the idle state when first opened', () => {
    render(<ImportEmployeesModal open onClose={jest.fn()} onImported={jest.fn()} />);

    expect(screen.getByRole('button', { name: /choose file/i })).toBeInTheDocument();
    expect(screen.getByText(/download.*template/i)).toBeInTheDocument();
  });

  test('valid CSV shows row count and enabled Import button', async () => {
    render(<ImportEmployeesModal open onClose={jest.fn()} onImported={jest.fn()} />);

    await upload(asFile(goodCsv));

    await waitFor(() => expect(screen.getByText(/2 employees ready/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /import 2/i })).toBeEnabled();
  });

  test('FE format error renders error table and does NOT call the API', async () => {
    const badCsv = goodCsv.replace('asha@example.com', 'not-an-email');

    render(<ImportEmployeesModal open onClose={jest.fn()} onImported={jest.fn()} />);
    await upload(asFile(badCsv));

    await waitFor(() => expect(screen.getByText(/import failed/i)).toBeInTheDocument());
    expect(bulkCreateEmployees).not.toHaveBeenCalled();
  });

  test('on Import click, calls API and on success fires onImported + onClose', async () => {
    (bulkCreateEmployees as jest.Mock).mockResolvedValue({ inserted: 2 });

    const onClose    = jest.fn();
    const onImported = jest.fn();

    render(<ImportEmployeesModal open onClose={onClose} onImported={onImported} />);
    await upload(asFile(goodCsv));

    await waitFor(() => expect(screen.getByRole('button', { name: /import 2/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /import 2/i }));

    await waitFor(() => expect(onImported).toHaveBeenCalledWith(2));
    expect(onClose).toHaveBeenCalled();
  });

  test('on 409 EMAIL_TAKEN, renders the BE error table', async () => {
    (bulkCreateEmployees as jest.Mock).mockRejectedValue(
      new ApiError(409, 'EMAIL_TAKEN', 'msg', {
        errors: [{ index: 0, field: 'email', message: 'Email already exists: asha@example.com' }],
      }),
    );

    render(<ImportEmployeesModal open onClose={jest.fn()} onImported={jest.fn()} />);
    await upload(asFile(goodCsv));

    await waitFor(() => expect(screen.getByRole('button', { name: /import 2/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /import 2/i }));

    await waitFor(() =>
      expect(screen.getByText(/Email already exists: asha@example.com/)).toBeInTheDocument(),
    );
  });
});
