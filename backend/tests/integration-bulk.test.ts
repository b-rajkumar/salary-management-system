import request from 'supertest';
import { buildApp } from '../src/app';

const validRow = {
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha@example.com',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'IN',
  salary: 1500000,
  hireDate: '2024-01-15',
};

describe('POST /api/employees/bulk — integration', () => {
  let app: ReturnType<typeof buildApp>['app'];

  beforeEach(() => {
    ({ app } = buildApp(':memory:'));
  });

  test('inserts 50 valid rows and they appear in GET /api/employees', async () => {
    const employees = Array.from({ length: 50 }, (_, i) => ({
      ...validRow,
      email: `user${i}@x.com`,
    }));

    const create = await request(app).post('/api/employees/bulk').send({ employees });

    expect(create.status).toBe(201);
    expect(create.body).toEqual({ inserted: 50 });

    const list = await request(app).get('/api/employees?page=0&pageSize=100');

    expect(list.status).toBe(200);
    expect(list.body.total).toBe(50);
  });

  test('rejects with 409 EMAIL_TAKEN when one row collides with an existing DB row and inserts nothing', async () => {
    await request(app).post('/api/employees').send({ ...validRow, email: 'taken@x.com' });

    const employees = [
      { ...validRow, email: 'new1@x.com' },
      { ...validRow, email: 'taken@x.com' },
      { ...validRow, email: 'new2@x.com' },
    ];
    const res = await request(app).post('/api/employees/bulk').send({ employees });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');

    const list = await request(app).get('/api/employees?page=0&pageSize=100');

    expect(list.body.total).toBe(1);
  });

  test('rejects with 400 IN_FILE_DUPLICATE_EMAIL when two rows share an email and inserts nothing', async () => {
    const employees = [
      { ...validRow, email: 'a@x.com' },
      { ...validRow, email: 'b@x.com' },
      { ...validRow, email: 'a@x.com' },
    ];
    const res = await request(app).post('/api/employees/bulk').send({ employees });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IN_FILE_DUPLICATE_EMAIL');

    const list = await request(app).get('/api/employees?page=0&pageSize=100');

    expect(list.body.total).toBe(0);
  });

  test('treats case-variant emails as the same row both within file and against DB', async () => {
    await request(app).post('/api/employees').send({ ...validRow, email: 'Existing@X.com' });

    const employees = [
      { ...validRow, email: 'EXISTING@x.com' },
      { ...validRow, email: 'b@x.com' },
    ];
    const res = await request(app).post('/api/employees/bulk').send({ employees });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');

    const list = await request(app).get('/api/employees?page=0&pageSize=100');

    expect(list.body.total).toBe(1);
  });
});
