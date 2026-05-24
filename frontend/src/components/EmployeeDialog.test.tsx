import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeeDialog } from './EmployeeDialog';
import { createEmployee, updateEmployee } from '../api/employees';
import { ApiError } from '../api/client';
import type { Employee } from '@app/shared';

jest.mock('../api/employees');

const mockedCreate = jest.mocked(createEmployee);
const mockedUpdate = jest.mocked(updateEmployee);

const fakeEmployee: Employee = {
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

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Asha');
  await user.type(screen.getByLabelText('Last name'), 'Rao');
  await user.type(screen.getByLabelText('Email'), 'asha@example.com');
  await user.type(screen.getByLabelText('Job title'), 'Software Engineer');
  await user.type(screen.getByLabelText('Department'), 'Engineering');
  await user.click(screen.getByRole('combobox', { name: /Country/i }));
  await user.click(await screen.findByRole('option', { name: /India \(IN\)/ }));
  fireEvent.change(screen.getByLabelText('Salary'), { target: { value: '1500000' } });
  fireEvent.change(screen.getByLabelText('Hire date'), { target: { value: '2024-01-15' } });
}

beforeEach(() => jest.clearAllMocks());

describe('EmployeeDialog — create mode', () => {
  it('renders the create title and Save button', () => {
    render(<EmployeeDialog open intent="create" onClose={jest.fn()} onSaved={jest.fn()} />);

    expect(screen.getByText('Add employee')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('empty submit shows required errors and does not call createEmployee', async () => {
    const user = userEvent.setup();

    render(<EmployeeDialog open intent="create" onClose={jest.fn()} onSaved={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findAllByText('Required')).not.toHaveLength(0);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('valid submit calls createEmployee and fires onSaved with the new row', async () => {
    mockedCreate.mockResolvedValueOnce(fakeEmployee);
    const onSaved = jest.fn();
    const user = userEvent.setup();

    render(<EmployeeDialog open intent="create" onClose={jest.fn()} onSaved={onSaved} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('button', { name: 'Save' });
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'asha@example.com', country: 'IN', salary: 1500000 }),
    );
    expect(onSaved).toHaveBeenCalledWith(fakeEmployee);
  });

  it('409 EMAIL_TAKEN shows inline error on email and keeps the dialog open', async () => {
    mockedCreate.mockRejectedValueOnce(new ApiError(409, 'EMAIL_TAKEN', 'Email already in use'));
    const onSaved = jest.fn();
    const user = userEvent.setup();

    render(<EmployeeDialog open intent="create" onClose={jest.fn()} onSaved={onSaved} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Email already in use')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('EmployeeDialog — view mode', () => {
  it("renders the employee's name as the title and all 8 fields read-only", () => {
    render(
      <EmployeeDialog
        open
        intent="inspect"
        employee={fakeEmployee}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText(/India.*IN/)).toBeInTheDocument();
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
  });

  it('formats createdAt and updatedAt consistently regardless of input format', () => {
    const employee = {
      ...fakeEmployee,
      // SQLite CURRENT_TIMESTAMP format
      createdAt: '2024-01-15 09:12:00',
      // JS Date().toISOString() format
      updatedAt: '2026-05-24T14:32:15.123Z',
    };

    render(
      <EmployeeDialog open intent="inspect" employee={employee} onClose={jest.fn()} onSaved={jest.fn()} onDelete={jest.fn()} />,
    );

    expect(screen.getByText('2024-01-15 09:12:00')).toBeInTheDocument();
    expect(screen.getByText('2026-05-24 14:32:15')).toBeInTheDocument();
    // Raw ISO string must not leak through.
    expect(screen.queryByText('2026-05-24T14:32:15.123Z')).not.toBeInTheDocument();
  });

  it('shows Close, Delete, and Edit buttons (no Cancel / Save in view mode)', () => {
    render(
      <EmployeeDialog
        open
        intent="inspect"
        employee={fakeEmployee}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('Close button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(
      <EmployeeDialog
        open
        intent="inspect"
        employee={fakeEmployee}
        onClose={onClose}
        onSaved={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a Delete button in view mode that fires onDelete with the current employee', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();

    render(
      <EmployeeDialog
        open
        intent="inspect"
        employee={fakeEmployee}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(fakeEmployee);
  });
});

describe('EmployeeDialog — edit mode', () => {
  it('does not show a Delete button in edit mode', async () => {
    const user = userEvent.setup();

    render(
      <EmployeeDialog
        open
        intent="inspect"
        employee={fakeEmployee}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('startInEditMode: true mounts directly in edit mode (form fields visible)', () => {
    render(
      <EmployeeDialog
        open
        intent="inspect"
        employee={fakeEmployee}
        startInEditMode
        onClose={jest.fn()}
        onSaved={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('First name')).toHaveValue('Asha');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('clicking Edit reveals prefilled form inputs', async () => {
    const user = userEvent.setup();

    render(
      <EmployeeDialog
        open
        intent="inspect"
        employee={fakeEmployee}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('First name')).toHaveValue('Asha');
    expect(screen.getByLabelText('Email')).toHaveValue('asha@example.com');
    expect(screen.getByLabelText('Salary')).toHaveValue(1500000);
  });

  it('Save button is disabled while the form is pristine', async () => {
    const user = userEvent.setup();

    render(
      <EmployeeDialog open intent="inspect" employee={fakeEmployee} onClose={jest.fn()} onSaved={jest.fn()} onDelete={jest.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.clear(screen.getByLabelText('First name'));
    await user.type(screen.getByLabelText('First name'), 'Renamed');

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('Cancel returns to view mode with original values', async () => {
    const user = userEvent.setup();

    render(
      <EmployeeDialog open intent="inspect" employee={fakeEmployee} onClose={jest.fn()} onSaved={jest.fn()} onDelete={jest.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('First name'));
    await user.type(screen.getByLabelText('First name'), 'Discarded');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
  });

  it('valid Save calls updateEmployee, transitions to view with updated row, fires onSaved', async () => {
    const updated = { ...fakeEmployee, firstName: 'Asha-Updated', updatedAt: '2026-05-24T10:00:00.000Z' };

    mockedUpdate.mockResolvedValueOnce(updated);
    const onSaved = jest.fn();
    const user = userEvent.setup();

    render(
      <EmployeeDialog open intent="inspect" employee={fakeEmployee} onClose={jest.fn()} onSaved={onSaved} onDelete={jest.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('First name'));
    await user.type(screen.getByLabelText('First name'), 'Asha-Updated');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Asha-Updated Rao');
    expect(mockedUpdate).toHaveBeenCalledWith(
      fakeEmployee.id,
      expect.objectContaining({ firstName: 'Asha-Updated' }),
    );
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it('changing country auto-clears salary and shows the re-enter helper', async () => {
    const user = userEvent.setup();

    render(
      <EmployeeDialog open intent="inspect" employee={fakeEmployee} onClose={jest.fn()} onSaved={jest.fn()} onDelete={jest.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    await user.click(screen.getByRole('combobox', { name: /Country/i }));
    await user.click(await screen.findByRole('option', { name: /United States \(US\)/ }));

    expect(screen.getByLabelText('Salary')).toHaveValue(null);
    expect(screen.getByText(/re-enter in USD/i)).toBeInTheDocument();
  });

  it('hireDate inline note is shown in edit mode', async () => {
    const user = userEvent.setup();

    render(
      <EmployeeDialog open intent="inspect" employee={fakeEmployee} onClose={jest.fn()} onSaved={jest.fn()} onDelete={jest.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText(/historical record/i)).toBeInTheDocument();
  });

  it('409 EMAIL_TAKEN on update shows inline error on email and stays in edit mode', async () => {
    mockedUpdate.mockRejectedValueOnce(new ApiError(409, 'EMAIL_TAKEN', 'Email already in use'));
    const user = userEvent.setup();

    render(
      <EmployeeDialog open intent="inspect" employee={fakeEmployee} onClose={jest.fn()} onSaved={jest.fn()} onDelete={jest.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'taken@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Email already in use')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
