import {
  Alert, Box, Card, CardContent, Skeleton, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { COUNTRIES } from '@app/shared';
import { useCountryInsights } from '../hooks/useCountryInsights';
import { formatSalary } from '../lib/formatSalary';

interface CountryInsightsCardProps {
  country: string;
}

export function CountryInsightsCard({ country }: CountryInsightsCardProps) {
  const { result, isLoading, error } = useCountryInsights(country);

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (isLoading || result === null) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Skeleton variant="text" width="40%" height={48} />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="rectangular" height={120} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (result.kind === 'empty') {
    const name = COUNTRIES[country as keyof typeof COUNTRIES]?.name ?? country;

    return (
      <Card>
        <CardContent>
          <Typography variant="body1" color="text.secondary">
            No employees in {name} yet.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const d = result.data;

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Box>
            <Typography variant="caption" color="text.secondary">Mean salary</Typography>
            <Typography variant="h4">{formatSalary(d.salary.avg, d.currency)}</Typography>
            <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Min {formatSalary(d.salary.min, d.currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Max {formatSalary(d.salary.max, d.currency)}
              </Typography>
            </Stack>
          </Box>

          <Stack direction="row" spacing={4}>
            <Box>
              <Typography variant="caption" color="text.secondary">Employees</Typography>
              <Typography variant="body1">{d.count}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Avg tenure</Typography>
              <Typography variant="body1">{d.tenure.avgYears} yr</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">New hires (12 mo)</Typography>
              <Typography variant="body1">{d.tenure.newHiresLast12Months}</Typography>
            </Box>
          </Stack>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Departments
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Department</TableCell>
                  <TableCell align="right">Headcount</TableCell>
                  <TableCell align="right">Avg salary</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {d.departments.map((row) => (
                  <TableRow key={row.department}>
                    <TableCell>{row.department}</TableCell>
                    <TableCell align="right">{row.headcount}</TableCell>
                    <TableCell align="right">{formatSalary(row.avgSalary, d.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
