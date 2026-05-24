import { COUNTRIES } from '@app/shared';
import { formatSalary } from '../lib/formatSalary';

interface SalaryCellProps {
  amount: number;
  country: string;
}

export function SalaryCell({ amount, country }: SalaryCellProps) {
  const currency = COUNTRIES[country as keyof typeof COUNTRIES]?.currency ?? 'USD';

  return <span>{formatSalary(amount, currency)}</span>;
}
