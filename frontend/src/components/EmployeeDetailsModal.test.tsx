import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeeDetailsModal } from './EmployeeDetailsModal';
import type { Employee } from '@app/shared';

const employee: Employee = {
  id: 42,
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha.rao@example.com',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'IN',
  salary: 1500000,
  hireDate: '2024-01-15',
  createdAt: '2024-01-15T00:00:00.000Z',
  updatedAt: '2024-01-15T00:00:00.000Z',
};

describe('EmployeeDetailsModal', () => {
  it('renders all employee fields with first/last name split when open', () => {
    render(<EmployeeDetailsModal open employee={employee} onClose={jest.fn()} />);

    expect(screen.getByRole('dialog', { name: /Employee details/i })).toBeInTheDocument();
    expect(screen.getByText('First name')).toBeInTheDocument();
    expect(screen.getByText('Asha')).toBeInTheDocument();
    expect(screen.getByText('Last name')).toBeInTheDocument();
    expect(screen.getByText('Rao')).toBeInTheDocument();
    expect(screen.getByText('asha.rao@example.com')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText(/India/)).toBeInTheDocument();
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();

    const salaryText = screen.getByText(/₹|INR/).textContent ?? '';

    expect(salaryText.replace(/[^\d]/g, '')).toBe('1500000');
  });

  it('does not render when closed', () => {
    render(<EmployeeDetailsModal open={false} employee={employee} onClose={jest.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not render when employee is null', () => {
    render(<EmployeeDetailsModal open employee={null} onClose={jest.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when the Close button is clicked', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(<EmployeeDetailsModal open employee={employee} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
