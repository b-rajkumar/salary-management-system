import { COUNTRIES } from '@app/shared';

interface SalaryCellProps {
  amount: number;
  country: string;
}

export function SalaryCell({ amount, country }: SalaryCellProps) {
  const currency = COUNTRIES[country as keyof typeof COUNTRIES]?.currency ?? 'USD';
  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

  return <span>{formatted}</span>;
}
