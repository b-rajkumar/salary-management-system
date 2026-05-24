import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowActions } from './RowActions';
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

describe('RowActions', () => {
  it('renders a kebab trigger labelled by the employee name', () => {
    render(
      <RowActions employee={fakeEmployee} onView={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Actions for Asha Rao/i })).toBeInTheDocument();
  });

  it('reveals View, Edit, Delete menu items when the kebab is clicked', async () => {
    const user = userEvent.setup();

    render(
      <RowActions employee={fakeEmployee} onView={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /Actions for Asha Rao/i }));

    expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('clicking View fires onView with the employee and closes the menu', async () => {
    const user = userEvent.setup();
    const onView = jest.fn();

    render(
      <RowActions employee={fakeEmployee} onView={onView} onEdit={jest.fn()} onDelete={jest.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /Actions for Asha Rao/i }));
    await user.click(screen.getByRole('menuitem', { name: 'View' }));

    expect(onView).toHaveBeenCalledWith(fakeEmployee);
    expect(screen.queryByRole('menuitem', { name: 'View' })).not.toBeInTheDocument();
  });

  it('clicking Edit fires onEdit with the employee', async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();

    render(
      <RowActions employee={fakeEmployee} onView={jest.fn()} onEdit={onEdit} onDelete={jest.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /Actions for Asha Rao/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledWith(fakeEmployee);
  });

  it('clicking Delete fires onDelete with the employee', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();

    render(
      <RowActions employee={fakeEmployee} onView={jest.fn()} onEdit={jest.fn()} onDelete={onDelete} />,
    );

    await user.click(screen.getByRole('button', { name: /Actions for Asha Rao/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledWith(fakeEmployee);
  });
});
