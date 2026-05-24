import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeesPage } from './EmployeesPage';
import { listEmployees } from '../api/employees';
import type { Employee } from '@app/shared';

jest.mock('../api/employees');

jest.mock('../components/EmployeeDialog', () => ({
  EmployeeDialog: (props: {
    open: boolean;
    intent: 'create' | 'inspect';
    employee?: { id: number; firstName: string; lastName: string; email: string };
    onSaved: (e: { id: number; firstName: string; lastName: string }) => void;
  }) =>
    props.open ? (
      <div data-testid={`mock-dialog-${props.intent}`}>
        {props.intent === 'inspect' && props.employee && (
          <span data-testid="inspect-name">{props.employee.firstName} {props.employee.lastName}</span>
        )}
        <button
          onClick={() => props.onSaved({ id: 1, firstName: 'Asha', lastName: 'Rao' })}
        >
          fire onSaved
        </button>
      </div>
    ) : null,
}));

const mockedList = jest.mocked(listEmployees);

const fakeRow: Employee = {
  id: 1,
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha@example.com',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'IN',
  salary: 1500000,
  hireDate: '2024-01-15',
  createdAt: '2024-01-15T00:00:00.000Z',
  updatedAt: '2024-01-15T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedList.mockResolvedValue({ rows: [], total: 0 });
});

describe('EmployeesPage', () => {
  it('renders rows returned from the API with the slimmed column set', async () => {
    mockedList.mockResolvedValueOnce({ rows: [fakeRow], total: 1 });

    render(<EmployeesPage />);

    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());
    expect(screen.getByText('India')).toBeInTheDocument();
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();

    expect(screen.queryByText('asha@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('Software Engineer')).not.toBeInTheDocument();
    expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
  });

  it('shows an error alert when the API rejects', async () => {
    mockedList.mockReset();
    mockedList.mockRejectedValueOnce(new Error('Failed to load employees'));

    render(<EmployeesPage />);

    expect(await screen.findByText('Failed to load employees')).toBeInTheDocument();
  });

  it('clicking the top-right "Add Employee" opens the dialog in create intent', async () => {
    mockedList.mockResolvedValueOnce({ rows: [fakeRow], total: 1 });
    const user = userEvent.setup();

    render(<EmployeesPage />);

    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());
    expect(screen.queryByTestId('mock-dialog-create')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Employee' }));

    expect(screen.getByTestId('mock-dialog-create')).toBeInTheDocument();
  });

  it('shows an empty-state CTA (no grid) when there are no employees', async () => {
    // default mock returns { rows: [], total: 0 }
    render(<EmployeesPage />);

    expect(await screen.findByText('No employees yet')).toBeInTheDocument();
    expect(screen.getByText(/Add your first employee to get started/i)).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Name' })).not.toBeInTheDocument();
  });

  it('the empty-state Add Employee button opens the create dialog', async () => {
    const user = userEvent.setup();

    render(<EmployeesPage />);
    await screen.findByText('No employees yet');

    await user.click(screen.getByRole('button', { name: 'Add Employee' }));

    expect(screen.getByTestId('mock-dialog-create')).toBeInTheDocument();
  });

  it('hides the empty state once rows arrive', async () => {
    mockedList.mockResolvedValueOnce({ rows: [fakeRow], total: 1 });

    render(<EmployeesPage />);

    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());
    expect(screen.queryByText('No employees yet')).not.toBeInTheDocument();
  });

  it('create onSaved shows a success Alert and refetches the grid', async () => {
    const user = userEvent.setup();

    render(<EmployeesPage />);

    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Add Employee' }));
    await user.click(screen.getByRole('button', { name: 'fire onSaved' }));

    expect(await screen.findByText('Added Asha Rao')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-dialog-create')).not.toBeInTheDocument();
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
  });

  it('clicking the row View button opens the dialog in inspect intent with the row', async () => {
    mockedList.mockResolvedValueOnce({ rows: [fakeRow], total: 1 });
    const user = userEvent.setup();

    render(<EmployeesPage />);

    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /View .*Asha Rao/i }));

    expect(await screen.findByTestId('mock-dialog-inspect')).toBeInTheDocument();
    expect(screen.getByTestId('inspect-name')).toHaveTextContent('Asha Rao');
  });

  it('inspect onSaved (update) shows a success Alert and refetches the grid', async () => {
    mockedList.mockResolvedValueOnce({ rows: [fakeRow], total: 1 });
    const user = userEvent.setup();

    render(<EmployeesPage />);

    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /View .*Asha Rao/i }));
    await user.click(screen.getByRole('button', { name: 'fire onSaved' }));

    expect(await screen.findByText('Updated Asha Rao')).toBeInTheDocument();
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
  });

  it('shows a search input when there are rows', async () => {
    mockedList.mockResolvedValueOnce({ rows: [fakeRow], total: 1 });

    render(<EmployeesPage />);

    expect(await screen.findByPlaceholderText(/Search by name/i)).toBeInTheDocument();
  });

  it('typing in the search box triggers a refetch with q after the debounce', async () => {
    mockedList.mockResolvedValueOnce({ rows: [fakeRow], total: 1 });
    const user = userEvent.setup();

    render(<EmployeesPage />);

    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(1));
    expect(mockedList).toHaveBeenLastCalledWith({ page: 0, pageSize: 50, q: undefined });

    await user.type(screen.getByPlaceholderText(/Search by name/i), 'asha');

    await waitFor(
      () =>
        expect(mockedList).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'asha', page: 0 }),
        ),
      { timeout: 1500 },
    );
  });

  it('renders a "No matches" state when search returns zero results', async () => {
    mockedList.mockResolvedValueOnce({ rows: [fakeRow], total: 1 });
    mockedList.mockResolvedValue({ rows: [], total: 0 });
    const user = userEvent.setup();

    render(<EmployeesPage />);
    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/Search by name/i), 'zzz');

    expect(await screen.findByText(/No matches for/i, {}, { timeout: 1500 }))
      .toBeInTheDocument();

    expect(screen.queryByText('No employees yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Add your first employee to get started.')).not.toBeInTheDocument();
  });

  it('does not show the search bar when the first-run empty state is active', async () => {
    render(<EmployeesPage />);

    await screen.findByText('No employees yet');
    expect(screen.queryByPlaceholderText(/Search by name/i)).not.toBeInTheDocument();
  });
});
