import { EmployeesService } from '../../src/services/EmployeesService';
import { ConflictError } from '../../src/lib/errors';
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
  let repo: { insert: jest.Mock };
  let service: EmployeesService;

  beforeEach(() => {
    repo = { insert: jest.fn() };
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
});
