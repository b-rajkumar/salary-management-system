import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeesPage } from './EmployeesPage';
import { listEmployees } from '../api/employees';
import type { Employee } from '@app/shared';

jest.mock('../api/employees');

jest.mock('../components/AddEmployeeModal', () => ({
  AddEmployeeModal: ({
    open,
    onCreated,
  }: {
    open: boolean;
    onCreated: (e: { id: number; firstName: string; lastName: string }) => void;
  }) =>
    open ? (
      <div data-testid="mock-modal">
        <button
          onClick={() => onCreated({ id: 1, firstName: 'Asha', lastName: 'Rao' })}
        >
          fire onCreated
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

  it('clicking the top-right "Add Employee" opens the modal', async () => {
    mockedList.mockResolvedValueOnce({ rows: [fakeRow], total: 1 });
    const user = userEvent.setup();

    render(<EmployeesPage />);

    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());
    expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Employee' }));

    expect(screen.getByTestId('mock-modal')).toBeInTheDocument();
  });

  it('shows an empty-state CTA (no grid) when there are no employees', async () => {
    // default mock returns { rows: [], total: 0 }
    render(<EmployeesPage />);

    expect(await screen.findByText('No employees yet')).toBeInTheDocument();
    expect(screen.getByText(/Add your first employee to get started/i)).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Name' })).not.toBeInTheDocument();
  });

  it('the empty-state Add Employee button opens the modal', async () => {
    const user = userEvent.setup();

    render(<EmployeesPage />);
    await screen.findByText('No employees yet');

    await user.click(screen.getByRole('button', { name: 'Add Employee' }));

    expect(screen.getByTestId('mock-modal')).toBeInTheDocument();
  });

  it('hides the empty state once rows arrive', async () => {
    mockedList.mockResolvedValueOnce({ rows: [fakeRow], total: 1 });

    render(<EmployeesPage />);

    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());
    expect(screen.queryByText('No employees yet')).not.toBeInTheDocument();
  });

  it('onCreated flow shows a success Alert and refetches the grid', async () => {
    const user = userEvent.setup();

    render(<EmployeesPage />);

    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Add Employee' }));
    await user.click(screen.getByRole('button', { name: 'fire onCreated' }));

    expect(await screen.findByText('Added Asha Rao')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
  });

  it('clicking the row View button opens the details modal with full info', async () => {
    mockedList.mockResolvedValueOnce({ rows: [fakeRow], total: 1 });
    const user = userEvent.setup();

    render(<EmployeesPage />);

    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /View .*Asha Rao/i }));

    expect(await screen.findByRole('dialog', { name: /Employee details/i })).toBeInTheDocument();
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Employee details/i })).not.toBeInTheDocument(),
    );
  });
});
