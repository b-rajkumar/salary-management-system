import express, { type Express } from 'express';
import request from 'supertest';
import { EmployeesController } from '../../src/controllers/EmployeesController';
import { employeesRouter } from '../../src/routes/employees';
import { errorMiddleware } from '../../src/lib/errorMiddleware';
import { ConflictError, NotFoundError } from '../../src/lib/errors';
import type { EmployeesService } from '../../src/services/EmployeesService';

const validBody = {
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha@example.com',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'IN',
  salary: 1500000,
  hireDate: '2024-01-15',
};

const createdRow = { id: 1, ...validBody, createdAt: 't', updatedAt: 't' };

describe('POST /api/employees', () => {
  let service: { create: jest.Mock; list: jest.Mock };
  let app: Express;

  beforeEach(() => {
    service = { create: jest.fn().mockResolvedValue(createdRow), list: jest.fn() };
    const controller = new EmployeesController(service as unknown as EmployeesService);

    app = express();
    app.use(express.json());
    app.use('/api/employees', employeesRouter(controller));
    app.use(errorMiddleware);
  });

  test('201 returns the created employee and calls service.create with the parsed body', async () => {
    const res = await request(app).post('/api/employees').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(createdRow);
    expect(service.create).toHaveBeenCalledWith(validBody);
  });

  test.each([
    ['missing firstName', { ...validBody, firstName: '' }],
    ['malformed email',    { ...validBody, email: 'not-an-email' }],
    ['unknown country',    { ...validBody, country: 'ZZ' }],
    ['salary = 0',         { ...validBody, salary: 0 }],
    ['salary = -1',        { ...validBody, salary: -1 }],
    ['non-integer salary', { ...validBody, salary: 12.5 }],
    ['future hireDate',    { ...validBody, hireDate: '2999-01-01' }],
  ])('400 VALIDATION_ERROR for %s', async (_label, body) => {
    const res = await request(app).post('/api/employees').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.create).not.toHaveBeenCalled();
  });

  test('409 EMAIL_TAKEN when service throws ConflictError', async () => {
    service.create.mockRejectedValue(new ConflictError('EMAIL_TAKEN', 'Email already in use'));
    const res = await request(app).post('/api/employees').send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'EMAIL_TAKEN', message: 'Email already in use' });
  });

  test('lowercases email at the validation boundary so case variants reach the service in canonical form', async () => {
    const res = await request(app)
      .post('/api/employees')
      .send({ ...validBody, email: 'ASHA@Example.COM' });

    expect(res.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'asha@example.com' }),
    );
  });
});

describe('GET /api/employees', () => {
  let service: { create: jest.Mock; list: jest.Mock };
  let app: Express;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      list: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    };
    const controller = new EmployeesController(service as unknown as EmployeesService);

    app = express();
    app.use(express.json());
    app.use('/api/employees', employeesRouter(controller));
    app.use(errorMiddleware);
  });

  test('200 with default page/pageSize when no query params', async () => {
    const res = await request(app).get('/api/employees');

    expect(res.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith({ page: 0, pageSize: 50 });
    expect(res.body).toEqual({ rows: [], total: 0 });
  });

  test('200 with explicit page and pageSize', async () => {
    service.list.mockResolvedValueOnce({ rows: [createdRow], total: 1 });

    const res = await request(app).get('/api/employees?page=2&pageSize=20');

    expect(res.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith({ page: 2, pageSize: 20 });
    expect(res.body.total).toBe(1);
  });

  test.each([
    'page=-1',
    'pageSize=0',
    'pageSize=201',
    'page=abc',
  ])('400 VALIDATION_ERROR for query %s', async (query) => {
    const res = await request(app).get(`/api/employees?${query}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.list).not.toHaveBeenCalled();
  });

  test('200 forwards q through to the service', async () => {
    const res = await request(app).get('/api/employees?q=asha');

    expect(res.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith({ page: 0, pageSize: 50, q: 'asha' });
  });

  test('200 trims q and drops it from the call when empty after trimming', async () => {
    const res = await request(app).get('/api/employees?q=%20%20%20');

    expect(res.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith({ page: 0, pageSize: 50 });
  });

  test('400 VALIDATION_ERROR when q exceeds 100 chars', async () => {
    const longQ = 'a'.repeat(101);
    const res = await request(app).get(`/api/employees?q=${longQ}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.list).not.toHaveBeenCalled();
  });
});

describe('PUT /api/employees/:id', () => {
  let service: { create: jest.Mock; list: jest.Mock; update: jest.Mock };
  let app: Express;

  const updatedRow = { id: 1, ...validBody, firstName: 'Asha-Updated', createdAt: 't', updatedAt: 'u' };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      list: jest.fn(),
      update: jest.fn().mockResolvedValue(updatedRow),
    };
    const controller = new EmployeesController(service as unknown as EmployeesService);

    app = express();
    app.use(express.json());
    app.use('/api/employees', employeesRouter(controller));
    app.use(errorMiddleware);
  });

  test('200 returns the updated employee and calls service.update with id + body', async () => {
    const body = { ...validBody, firstName: 'Asha-Updated' };
    const res = await request(app).put('/api/employees/1').send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updatedRow);
    expect(service.update).toHaveBeenCalledWith(1, body);
  });

  test.each([
    ['missing firstName', { ...validBody, firstName: '' }],
    ['malformed email',   { ...validBody, email: 'not-an-email' }],
    ['unknown country',   { ...validBody, country: 'ZZ' }],
    ['salary = 0',        { ...validBody, salary: 0 }],
    ['future hireDate',   { ...validBody, hireDate: '2999-01-01' }],
  ])('400 VALIDATION_ERROR for %s', async (_label, body) => {
    const res = await request(app).put('/api/employees/1').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.update).not.toHaveBeenCalled();
  });

  test('400 VALIDATION_ERROR when :id is not a positive integer', async () => {
    const res = await request(app).put('/api/employees/abc').send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.update).not.toHaveBeenCalled();
  });

  test('404 EMPLOYEE_NOT_FOUND when service throws NotFoundError', async () => {
    service.update.mockRejectedValueOnce(new NotFoundError('EMPLOYEE_NOT_FOUND', 'Employee 999 not found'));
    const res = await request(app).put('/api/employees/999').send(validBody);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
  });

  test('409 EMAIL_TAKEN when service throws ConflictError', async () => {
    service.update.mockRejectedValueOnce(new ConflictError('EMAIL_TAKEN', 'Email already in use'));
    const res = await request(app).put('/api/employees/1').send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'EMAIL_TAKEN' });
  });
});

describe('DELETE /api/employees/:id', () => {
  let service: { create: jest.Mock; list: jest.Mock; update: jest.Mock; remove: jest.Mock };
  let app: Express;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new EmployeesController(service as unknown as EmployeesService);

    app = express();
    app.use(express.json());
    app.use('/api/employees', employeesRouter(controller));
    app.use(errorMiddleware);
  });

  test('204 with no body and calls service.remove with the id', async () => {
    const res = await request(app).delete('/api/employees/1');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(service.remove).toHaveBeenCalledWith(1);
  });

  test('400 VALIDATION_ERROR when :id is not a positive integer', async () => {
    const res = await request(app).delete('/api/employees/abc');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.remove).not.toHaveBeenCalled();
  });

  test('404 EMPLOYEE_NOT_FOUND when service throws NotFoundError', async () => {
    service.remove.mockRejectedValueOnce(new NotFoundError('EMPLOYEE_NOT_FOUND', 'Employee 999 not found'));
    const res = await request(app).delete('/api/employees/999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
  });
});
