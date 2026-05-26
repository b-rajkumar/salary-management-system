import type { EmployeesRepository } from '../repositories/EmployeesRepository';
import { ConflictError, InFileDuplicateEmailError, NotFoundError } from '../lib/errors';
import type {
  BulkErrorItem,
  Employee,
  EmployeeCreateInput,
  EmployeesListResponse,
} from '@app/shared';

function findInFileDuplicateEmails(inputs: EmployeeCreateInput[]): BulkErrorItem[] {
  const indicesByEmail = new Map<string, number[]>();

  inputs.forEach((row, index) => {
    const indices = indicesByEmail.get(row.email) ?? [];

    indices.push(index);
    indicesByEmail.set(row.email, indices);
  });

  const errors: BulkErrorItem[] = [];

  for (const [email, indices] of indicesByEmail) {
    if (indices.length > 1) {
      for (const index of indices) {
        errors.push({ index, field: 'email', message: `Duplicate within file: ${email}` });
      }
    }
  }

  return errors;
}

export class EmployeesService {
  constructor(private readonly repo: EmployeesRepository) {}

  create(input: EmployeeCreateInput): Promise<Employee> {
    return this.repo.insert(input);
  }

  list(args: { page: number; pageSize: number; q?: string }): Promise<EmployeesListResponse> {
    return this.repo.list(args);
  }

  async update(id: number, input: EmployeeCreateInput): Promise<Employee> {
    const row = await this.repo.update(id, input);

    if (!row) {
      throw new NotFoundError('EMPLOYEE_NOT_FOUND', `Employee ${id} not found`);
    }

    return row;
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.repo.delete(id);

    if (!deleted) {
      throw new NotFoundError('EMPLOYEE_NOT_FOUND', `Employee ${id} not found`);
    }
  }

  async createBulk(inputs: EmployeeCreateInput[]): Promise<{ inserted: number }> {
    const inFileDups = findInFileDuplicateEmails(inputs);

    if (inFileDups.length > 0) {
      const rowCount = new Set(inFileDups.map((e) => e.index)).size;

      throw new InFileDuplicateEmailError(
        { errors: inFileDups },
        `Import rejected: ${rowCount} rows share an email with another row in the file`,
      );
    }

    const emails = inputs.map((r) => r.email);
    const existing = await this.repo.findExistingEmails(emails);

    if (existing.length > 0) {
      const existingSet = new Set(existing);
      const errors: BulkErrorItem[] = inputs.flatMap((row, index) =>
        existingSet.has(row.email)
          ? [{ index, field: 'email', message: `Email already exists: ${row.email}` }]
          : [],
      );

      throw new ConflictError(
        'EMAIL_TAKEN',
        `Import rejected: ${existing.length} emails already exist in the database`,
        { errors },
      );
    }

    const inserted = await this.repo.insertMany(inputs);

    return { inserted };
  }
}
