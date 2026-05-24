import {
  Alert, Box, Card, CardContent, Grid, Skeleton, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { COUNTRIES, type CountryInsightsResponse } from '@app/shared';
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
    return <InsightsSkeleton />;
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

  return <InsightsContent data={result.data} />;
}

function InsightsSkeleton() {
  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="60%" height={40} />
              <Skeleton variant="text" width="50%" />
            </CardContent>
          </Card>
        </Grid>
        {[0, 1, 2].map((i) => (
          <Grid item xs={12} sm={4} md={2} key={i}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="60%" height={32} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Card>
        <CardContent>
          <Skeleton variant="text" width="20%" />
          <Skeleton variant="rectangular" height={120} sx={{ mt: 1 }} />
        </CardContent>
      </Card>
    </Stack>
  );
}

function InsightsContent({ data }: { data: CountryInsightsResponse }) {
  return (
    <Stack spacing={3}>
      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} md={6}>
          <SalaryCard data={data} />
        </Grid>
        <Grid item xs={12} sm={4} md={2}>
          <StatCard label="Employees" value={data.count.toLocaleString()} />
        </Grid>
        <Grid item xs={12} sm={4} md={2}>
          <StatCard label="Avg tenure" value={`${data.tenure.avgYears.toFixed(1)} yr`} />
        </Grid>
        <Grid item xs={12} sm={4} md={2}>
          <StatCard
            label="New hires (12 mo)"
            value={data.tenure.newHiresLast12Months.toLocaleString()}
          />
        </Grid>
      </Grid>

      <DepartmentsCard data={data} />
    </Stack>
  );
}

function SalaryCard({ data }: { data: CountryInsightsResponse }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>
            Mean salary
          </Typography>
          <Typography variant="h5" component="h4" sx={{ fontWeight: 500 }}>
            {formatSalary(data.salary.avg, data.currency)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Range: {formatSalary(data.salary.min, data.currency)}
            {' – '}
            {formatSalary(data.salary.max, data.currency)}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 500 }}>
            {value}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function DepartmentsCard({ data }: { data: CountryInsightsResponse }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Departments
        </Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Department</TableCell>
                <TableCell align="right">Headcount</TableCell>
                <TableCell align="right">Avg salary</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.departments.map((row) => (
                <TableRow key={row.department}>
                  <TableCell>{row.department}</TableCell>
                  <TableCell align="right">{row.headcount.toLocaleString()}</TableCell>
                  <TableCell align="right">{formatSalary(row.avgSalary, data.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
}
