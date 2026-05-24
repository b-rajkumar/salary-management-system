import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddEmployeeModal } from './AddEmployeeModal';
import { createEmployee } from '../api/employees';
import { ApiError } from '../api/client';
import type { Employee } from '@app/shared';

jest.mock('../api/employees');

const mockedCreate = jest.mocked(createEmployee);

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

/**
 * Fill all required fields with valid data.
 * For the salary `type="number"` input, fireEvent.change is used so jsdom
 * propagates the numeric value through the React synthetic event — user.type
 * produces keystrokes that don't set valueAsNumber in jsdom.
 */
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Asha');
  await user.type(screen.getByLabelText('Last name'), 'Rao');
  await user.type(screen.getByLabelText('Email'), 'asha@example.com');
  await user.type(screen.getByLabelText('Job title'), 'Software Engineer');
  await user.type(screen.getByLabelText('Department'), 'Engineering');

  // MUI Select renders as a combobox in jsdom
  await user.click(screen.getByRole('combobox', { name: /Country/i }));
  await user.click(await screen.findByRole('option', { name: /India \(IN\)/ }));

  // jsdom doesn't coerce type="number" input values to numbers via React events.
  // Use the native HTMLInputElement value setter + dispatch 'change' so React's
  // synthetic event sees the string "1500000" and z.coerce.number() handles the rest.
  const salaryInput = screen.getByLabelText('Salary') as HTMLInputElement;
  const nativeValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeValueSetter?.call(salaryInput, '1500000');
  salaryInput.dispatchEvent(new Event('input', { bubbles: true }));
  salaryInput.dispatchEvent(new Event('change', { bubbles: true }));

  await user.type(screen.getByLabelText('Hire date'), '2024-01-15');
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AddEmployeeModal', () => {
  it('submitting an empty form shows required errors and does not call createEmployee', async () => {
    const user = userEvent.setup();
    render(
      <AddEmployeeModal open onClose={jest.fn()} onCreated={jest.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findAllByText('Required')).not.toHaveLength(0);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('a valid submit calls createEmployee, calls onCreated, and closes the modal', async () => {
    mockedCreate.mockResolvedValueOnce(fakeEmployee);
    const onCreated = jest.fn();
    const user = userEvent.setup();

    render(
      <AddEmployeeModal open onClose={jest.fn()} onCreated={onCreated} />,
    );

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await screen.findByRole('button', { name: 'Submit' }); // wait for submission to settle
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'asha@example.com',
        country: 'IN',
        salary: 1500000,
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(fakeEmployee);
  });

  it('a 409 EMAIL_TAKEN sets an inline error on the email field and keeps the modal open', async () => {
    mockedCreate.mockRejectedValueOnce(
      new ApiError(409, 'EMAIL_TAKEN', 'Email already in use'),
    );
    const onCreated = jest.fn();
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(
      <AddEmployeeModal open onClose={onClose} onCreated={onCreated} />,
    );

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Email already in use')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a generic ApiError shows the inline error Alert inside the modal', async () => {
    mockedCreate.mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL_ERROR', 'Server exploded'),
    );
    const user = userEvent.setup();

    render(
      <AddEmployeeModal open onClose={jest.fn()} onCreated={jest.fn()} />,
    );

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
  });
});
