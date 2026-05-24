import { EmployeesService } from '../../src/services/EmployeesService';
import { ConflictError, NotFoundError } from '../../src/lib/errors';
import type { EmployeesRepository } from '../../src/repositories/EmployeesRepository';

const input = {
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha@example.com',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'IN',
  salary: 1500000,
  hireDate: '2024-01-15',
};

describe('EmployeesService', () => {
  let repo: { insert: jest.Mock; list: jest.Mock; update: jest.Mock; delete: jest.Mock };
  let service: EmployeesService;

  beforeEach(() => {
    repo = { insert: jest.fn(), list: jest.fn(), update: jest.fn(), delete: jest.fn() };
    service = new EmployeesService(repo as unknown as EmployeesRepository);
  });

  test('create delegates to repo.insert and returns its result', async () => {
    const row = { id: 1, ...input, createdAt: 't', updatedAt: 't' };

    repo.insert.mockResolvedValue(row);

    const result = await service.create(input);

    expect(repo.insert).toHaveBeenCalledWith(input);
    expect(result).toBe(row);
  });

  test('create propagates ConflictError thrown by the repo', async () => {
    repo.insert.mockRejectedValue(new ConflictError('EMAIL_TAKEN', 'taken'));
    await expect(service.create(input)).rejects.toBeInstanceOf(ConflictError);
  });

  test('list delegates to repo.list and returns its result', async () => {
    const payload = { rows: [{ id: 1, firstName: 'A' } as unknown], total: 1 };

    repo.list.mockResolvedValue(payload);

    const result = await service.list({ page: 2, pageSize: 25 });

    expect(repo.list).toHaveBeenCalledWith({ page: 2, pageSize: 25 });
    expect(result).toBe(payload);
  });

  test('list forwards q through to repo.list', async () => {
    repo.list.mockResolvedValue({ rows: [], total: 0 });

    await service.list({ page: 0, pageSize: 50, q: 'asha' });

    expect(repo.list).toHaveBeenCalledWith({ page: 0, pageSize: 50, q: 'asha' });
  });

  test('update delegates to repo.update and returns its result', async () => {
    const row = { id: 1, ...input, createdAt: 't', updatedAt: 'u' };

    repo.update.mockResolvedValue(row);

    const result = await service.update(1, input);

    expect(repo.update).toHaveBeenCalledWith(1, input);
    expect(result).toBe(row);
  });

  test('update throws NotFoundError when repo.update returns null', async () => {
    repo.update.mockResolvedValue(null);

    await expect(service.update(999, input)).rejects.toMatchObject({
      constructor: NotFoundError,
      code: 'EMPLOYEE_NOT_FOUND',
    });
  });

  test('update propagates ConflictError thrown by the repo', async () => {
    repo.update.mockRejectedValue(new ConflictError('EMAIL_TAKEN', 'taken'));

    await expect(service.update(1, input)).rejects.toBeInstanceOf(ConflictError);
  });

  test('remove delegates to repo.delete and resolves when a row was removed', async () => {
    repo.delete.mockResolvedValue(true);

    await expect(service.remove(1)).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith(1);
  });

  test('remove throws NotFoundError when repo.delete returns false', async () => {
    repo.delete.mockResolvedValue(false);

    await expect(service.remove(999)).rejects.toMatchObject({
      constructor: NotFoundError,
      code: 'EMPLOYEE_NOT_FOUND',
    });
  });
});
