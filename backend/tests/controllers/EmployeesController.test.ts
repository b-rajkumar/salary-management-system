import express, { type Express } from 'express';
import request from 'supertest';
import { EmployeesController } from '../../src/controllers/EmployeesController';
import { employeesRouter } from '../../src/routes/employees';
import { errorMiddleware } from '../../src/lib/errorMiddleware';
import { ConflictError } from '../../src/lib/errors';
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
  let service: { create: jest.Mock };
  let app: Express;

  beforeEach(() => {
    service = { create: jest.fn().mockResolvedValue(createdRow) };
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
});
