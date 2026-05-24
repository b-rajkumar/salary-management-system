import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeesPage } from './EmployeesPage';

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

describe('EmployeesPage', () => {
  it('clicking "Add Employee" opens the modal', async () => {
    const user = userEvent.setup();

    render(<EmployeesPage />);

    expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Employee' }));

    expect(screen.getByTestId('mock-modal')).toBeInTheDocument();
  });

  it('onCreated flow shows a success Alert with "Added {firstName} {lastName}"', async () => {
    const user = userEvent.setup();

    render(<EmployeesPage />);

    await user.click(screen.getByRole('button', { name: 'Add Employee' }));
    await user.click(screen.getByRole('button', { name: 'fire onCreated' }));

    expect(await screen.findByText('Added Asha Rao')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
  });
});
