import { Box, Stack, Typography } from '@mui/material';
import { formatSalary } from '../lib/formatSalary';

interface SalaryRangeBarProps {
  min: number;
  mean: number;
  max: number;
  currency: string;
}

export function SalaryRangeBar({ min, mean, max, currency }: SalaryRangeBarProps) {
  const left = computeMarkerPercent(min, mean, max);

  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      <Box
        sx={{
          position: 'relative',
          height: 8,
          borderRadius: 4,
          bgcolor: 'action.hover',
        }}
      >
        <Box
          data-testid="salary-range-marker"
          sx={{
            position: 'absolute',
            top: '50%',
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            transform: 'translate(-50%, -50%)',
          }}
          style={{ left: `${left}%` }}
        />
      </Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">
          {formatSalary(min, currency)}
        </Typography>
        {min !== max && (
          <Typography variant="caption" color="text.secondary">
            {formatSalary(max, currency)}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}

function computeMarkerPercent(min: number, mean: number, max: number): number {
  if (max === min) {
    return 50;
  }

  const ratio = (mean - min) / (max - min);

  return Math.min(100, Math.max(0, ratio * 100));
}
