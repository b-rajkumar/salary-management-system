import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { ApiError } from '../api/client';
import type { Employee } from '@app/shared';

const fakeEmployee: Employee = {
  id: 7,
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

describe('DeleteConfirmDialog', () => {
  it('renders the employee name, email, and country code', () => {
    render(
      <DeleteConfirmDialog open employee={fakeEmployee} onCancel={jest.fn()} onConfirm={jest.fn()} />,
    );

    expect(screen.getByText(/Asha Rao/)).toBeInTheDocument();
    expect(screen.getByText(/asha@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/IN/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('Cancel fires onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();

    render(
      <DeleteConfirmDialog open employee={fakeEmployee} onCancel={onCancel} onConfirm={jest.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('Delete calls onConfirm and disables both buttons while the promise is pending', async () => {
    const user = userEvent.setup();
    let resolveConfirm: () => void = () => {};
    const onConfirm = jest.fn(() => new Promise<void>((r) => { resolveConfirm = r; }));

    render(
      <DeleteConfirmDialog open employee={fakeEmployee} onCancel={jest.fn()} onConfirm={onConfirm} />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolveConfirm();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
  });

  it('shows an inline alert and re-enables buttons when onConfirm rejects with ApiError', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn().mockRejectedValue(new ApiError(500, 'INTERNAL', 'Server exploded'));

    render(
      <DeleteConfirmDialog open employee={fakeEmployee} onCancel={jest.fn()} onConfirm={onConfirm} />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('renders nothing meaningful when employee is null', () => {
    render(
      <DeleteConfirmDialog open={false} employee={null} onCancel={jest.fn()} onConfirm={jest.fn()} />,
    );

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
