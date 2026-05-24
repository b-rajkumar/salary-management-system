import { updateEmployee } from './employees';
import type { Employee, EmployeeUpdateInput } from '@app/shared';

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
  updatedAt: '2026-05-24T00:00:00.000Z',
};

describe('updateEmployee', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => fakeEmployee,
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('PUTs to /api/employees/:id with JSON body and returns parsed employee', async () => {
    const input: EmployeeUpdateInput = {
      firstName: 'Asha',
      lastName: 'Rao',
      email: 'asha@example.com',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
      country: 'IN',
      salary: 1500000,
      hireDate: '2024-01-15',
    };

    const result = await updateEmployee(1, input);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/employees/1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    );
    expect(result).toEqual(fakeEmployee);
  });
});
