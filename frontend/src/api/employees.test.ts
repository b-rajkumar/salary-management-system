import { bulkCreateEmployees, deleteEmployee, updateEmployee } from './employees';
import { ApiError } from './client';
import type { BulkCreateEmployeesRequest, Employee, EmployeeUpdateInput } from '@app/shared';

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

describe('deleteEmployee', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('DELETEs /api/employees/:id and resolves on 204', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => null });

    await expect(deleteEmployee(7)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/employees/7',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  test('throws ApiError on 404 with the parsed body code/message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: { code: 'EMPLOYEE_NOT_FOUND', message: 'Employee 999 not found' } }),
    });

    await expect(deleteEmployee(999)).rejects.toMatchObject({
      constructor: ApiError,
      status: 404,
      code: 'EMPLOYEE_NOT_FOUND',
      message: 'Employee 999 not found',
    });
  });
});

describe('bulkCreateEmployees', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const payload: BulkCreateEmployeesRequest = {
    employees: [
      {
        firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com',
        jobTitle: 'Software Engineer', department: 'Engineering',
        country: 'IN', salary: 1500000, hireDate: '2024-01-15',
      },
    ],
  };

  test('POSTs to /api/employees/bulk with the payload and returns the parsed response', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({ inserted: 1 }),
    });

    const result = await bulkCreateEmployees(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/employees/bulk',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
    );
    expect(result).toEqual({ inserted: 1 });
  });

  test('throws ApiError carrying details.errors on non-2xx', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 400, statusText: 'Bad Request',
      json: async () => ({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'msg',
          details: { errors: [{ index: 0, field: 'email', message: 'Invalid email' }] },
        },
      }),
    });

    await expect(bulkCreateEmployees(payload)).rejects.toMatchObject({
      constructor: ApiError,
      status: 400,
      code: 'VALIDATION_ERROR',
      details: { errors: [{ index: 0, field: 'email', message: 'Invalid email' }] },
    });
  });
});
