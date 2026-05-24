import { EmployeesService } from '../../src/services/EmployeesService';
import { ConflictError } from '../../src/lib/errors';
import type { EmployeesRepository } from '../../src/repositories/EmployeesRepository';

const validInput = {
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha@example.com',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'IN',
  salary: 1500000,
  hireDate: '2024-01-15',
};

function buildService(repoOverrides: Partial<EmployeesRepository> = {}) {
  const repo = {
    insert: jest.fn().mockResolvedValue({ id: 1, ...validInput, createdAt: 't', updatedAt: 't' }),
    ...repoOverrides,
  } as unknown as EmployeesRepository;
  return { repo, service: new EmployeesService(repo) };
}

describe('EmployeesService', () => {
  test('create delegates to repo.insert and returns its result', async () => {
    const { repo, service } = buildService();
    const result = await service.create(validInput);
    expect(repo.insert).toHaveBeenCalledWith(validInput);
    expect(result).toMatchObject(validInput);
    expect(result.id).toBe(1);
  });

  test('create propagates ConflictError thrown by the repo', async () => {
    const { service } = buildService({
      insert: jest.fn().mockRejectedValue(new ConflictError('EMAIL_TAKEN', 'taken')),
    } as Partial<EmployeesRepository>);
    await expect(service.create(validInput)).rejects.toBeInstanceOf(ConflictError);
  });
});
