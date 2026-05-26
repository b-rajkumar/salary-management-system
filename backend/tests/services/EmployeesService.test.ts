import { EmployeesService } from '../../src/services/EmployeesService';
import { ConflictError, InFileDuplicateEmailError, NotFoundError } from '../../src/lib/errors';
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

describe('EmployeesService.createBulk', () => {
  let repo: {
    insert: jest.Mock; list: jest.Mock; update: jest.Mock; delete: jest.Mock;
    findExistingEmails: jest.Mock; insertMany: jest.Mock;
  };
  let service: EmployeesService;

  beforeEach(() => {
    repo = {
      insert: jest.fn(), list: jest.fn(), update: jest.fn(), delete: jest.fn(),
      findExistingEmails: jest.fn().mockResolvedValue([]),
      insertMany: jest.fn().mockResolvedValue(0),
    };
    service = new EmployeesService(repo as unknown as EmployeesRepository);
  });

  test('happy path returns { inserted: <count> } and calls insertMany once', async () => {
    repo.insertMany.mockResolvedValue(3);

    const inputs = [
      { ...input, email: 'a@x.com' },
      { ...input, email: 'b@x.com' },
      { ...input, email: 'c@x.com' },
    ];
    const result = await service.createBulk(inputs);

    expect(result).toEqual({ inserted: 3 });
    expect(repo.findExistingEmails).toHaveBeenCalledWith(['a@x.com', 'b@x.com', 'c@x.com']);
    expect(repo.insertMany).toHaveBeenCalledTimes(1);
  });

  test('throws InFileDuplicateEmailError flagging every participating row when two rows share an email', async () => {
    const inputs = [
      { ...input, email: 'a@x.com' },
      { ...input, email: 'b@x.com', firstName: 'B' },
      { ...input, email: 'a@x.com', firstName: 'A2' },
    ];

    await expect(service.createBulk(inputs)).rejects.toMatchObject({
      constructor: InFileDuplicateEmailError,
      code: 'IN_FILE_DUPLICATE_EMAIL',
      status: 400,
      details: {
        errors: expect.arrayContaining([
          expect.objectContaining({ index: 0, field: 'email' }),
          expect.objectContaining({ index: 2, field: 'email' }),
        ]),
      },
    });

    expect(repo.findExistingEmails).not.toHaveBeenCalled();
    expect(repo.insertMany).not.toHaveBeenCalled();
  });

  test('throws ConflictError("EMAIL_TAKEN") flagging every colliding row when DB has matches', async () => {
    repo.findExistingEmails.mockResolvedValue(['b@x.com']);

    const inputs = [
      { ...input, email: 'a@x.com' },
      { ...input, email: 'b@x.com' },
      { ...input, email: 'c@x.com' },
    ];

    await expect(service.createBulk(inputs)).rejects.toMatchObject({
      constructor: ConflictError,
      code: 'EMAIL_TAKEN',
      status: 409,
      details: {
        errors: [expect.objectContaining({ index: 1, field: 'email' })],
      },
    });

    expect(repo.insertMany).not.toHaveBeenCalled();
  });
});
