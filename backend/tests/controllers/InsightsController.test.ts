import express, { type Express } from 'express';
import request from 'supertest';
import { InsightsController } from '../../src/controllers/InsightsController';
import { insightsRouter } from '../../src/routes/insights';
import { errorMiddleware } from '../../src/lib/errorMiddleware';
import { NotFoundError } from '../../src/lib/errors';
import type { InsightsService } from '../../src/services/InsightsService';

const stubResponse = {
  country: 'IN',
  currency: 'INR',
  count: 312,
  salary: { min: 600000, max: 4500000, avg: 1820000 },
  tenure: { avgYears: 3.4, newHiresLast12Months: 47 },
  departments: [
    { department: 'Engineering', headcount: 180, avgSalary: 2100000 },
  ],
};

describe('GET /api/insights/country/:country', () => {
  let service: { byCountry: jest.Mock };
  let app: Express;

  beforeEach(() => {
    service = { byCountry: jest.fn().mockResolvedValue(stubResponse) };
    const controller = new InsightsController(service as unknown as InsightsService);

    app = express();
    app.use(express.json());
    app.use('/api/insights', insightsRouter(controller));
    app.use(errorMiddleware);
  });

  test('200 returns the response and calls service.byCountry with the country code', async () => {
    const res = await request(app).get('/api/insights/country/IN');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(stubResponse);
    expect(service.byCountry).toHaveBeenCalledWith('IN');
  });

  test('400 VALIDATION_ERROR for an unknown country code', async () => {
    const res = await request(app).get('/api/insights/country/XX');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.byCountry).not.toHaveBeenCalled();
  });

  test('400 VALIDATION_ERROR for a lowercase country code (codes are uppercase)', async () => {
    const res = await request(app).get('/api/insights/country/in');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('404 COUNTRY_NOT_FOUND propagates when the service throws NotFoundError', async () => {
    service.byCountry.mockRejectedValueOnce(
      new NotFoundError('COUNTRY_NOT_FOUND', 'No employees in IN'),
    );

    const res = await request(app).get('/api/insights/country/IN');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COUNTRY_NOT_FOUND');
  });
});
