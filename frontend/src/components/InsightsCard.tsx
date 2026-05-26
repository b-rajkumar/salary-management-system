import {
  Alert, Box, Card, CardContent, CircularProgress, Grid, Skeleton, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { COUNTRIES, type CountryInsightsResponse, type RoleInsightsResponse } from '@app/shared';
import { useCountryInsights } from '../hooks/useCountryInsights';
import { useRoleInsights } from '../hooks/useRoleInsights';
import { useDelayedFlag } from '../hooks/useDelayedFlag';
import { formatSalary } from '../lib/formatSalary';
import { SalaryRangeBar } from './SalaryRangeBar';

interface InsightsCardProps {
  country: string;
  role: string | null;
}

export function InsightsCard({ country, role }: InsightsCardProps) {
  const countryQuery = useCountryInsights(country);
  const roleQuery = useRoleInsights(country, role);
  const isStillLoading = countryQuery.isLoading || countryQuery.result === null;
  const showCountrySpinner = useDelayedFlag(isStillLoading, 200);

  if (countryQuery.error) {
    return <Alert severity="error">{countryQuery.error}</Alert>;
  }

  if (countryQuery.isLoading || countryQuery.result === null) {
    return showCountrySpinner ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    ) : null;
  }

  if (countryQuery.result.kind === 'empty') {
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

  if (roleQuery.error) {
    return <Alert severity="error">{roleQuery.error}</Alert>;
  }

  const countryData = countryQuery.result.data;

  if (role === null) {
    return <CountryView data={countryData} />;
  }

  if (roleQuery.isLoading || roleQuery.result === null) {
    return <RoleSkeleton />;
  }

  if (roleQuery.result.kind === 'empty') {
    const name = COUNTRIES[country as keyof typeof COUNTRIES]?.name ?? country;

    return (
      <Card>
        <CardContent>
          <Typography variant="body1" color="text.secondary">
            No employees with title {role} in {name} yet.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return <RoleView countryData={countryData} roleData={roleQuery.result.data} country={country} />;
}

function CountryView({ data }: { data: CountryInsightsResponse }) {
  return (
    <Stack spacing={3}>
      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} md={6}>
          <SalaryCard
            heading="Mean salary"
            mean={data.salary.avg}
            min={data.salary.min}
            max={data.salary.max}
            currency={data.currency}
          />
        </Grid>
        <StatCells count={data.count} tenureYears={data.tenure.avgYears} newHires={data.tenure.newHiresLast12Months} />
      </Grid>

      <DepartmentsCard data={data} />
    </Stack>
  );
}

function RoleView({
  countryData, roleData, country,
}: {
  countryData: CountryInsightsResponse;
  roleData: RoleInsightsResponse;
  country: string;
}) {
  const countryName = COUNTRIES[country as keyof typeof COUNTRIES]?.name ?? country;
  const delta = countryData.salary.avg === 0
    ? null
    : (roleData.salary.avg - countryData.salary.avg) / countryData.salary.avg;
  const deltaLabel = delta === null
    ? null
    : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)}% vs all roles in ${countryName}`;

  return (
    <Stack spacing={3}>
      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} md={6}>
          <SalaryCard
            heading={`${roleData.jobTitle} in ${countryName}`}
            mean={roleData.salary.avg}
            min={roleData.salary.min}
            max={roleData.salary.max}
            currency={roleData.currency}
            comparison={deltaLabel}
            comparisonNegative={delta !== null && delta < 0}
          />
        </Grid>
        <StatCells count={roleData.count} tenureYears={roleData.tenure.avgYears} newHires={roleData.tenure.newHiresLast12Months} />
      </Grid>
    </Stack>
  );
}

function StatCells({
  count, tenureYears, newHires,
}: {
  count: number; tenureYears: number; newHires: number;
}) {
  return (
    <>
      <Grid item xs={12} sm={4} md={2}>
        <StatCard label="Employees" value={count.toLocaleString()} />
      </Grid>
      <Grid item xs={12} sm={4} md={2}>
        <StatCard label="Avg tenure" value={`${tenureYears.toFixed(1)} yr`} />
      </Grid>
      <Grid item xs={12} sm={4} md={2}>
        <StatCard label="New hires (12 mo)" value={newHires.toLocaleString()} />
      </Grid>
    </>
  );
}

function SalaryCard({
  heading, mean, min, max, currency, comparison, comparisonNegative,
}: {
  heading: string;
  mean: number;
  min: number;
  max: number;
  currency: string;
  comparison?: string | null;
  comparisonNegative?: boolean;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>
            {heading}
          </Typography>
          <Typography variant="h5" component="h4" sx={{ fontWeight: 500 }}>
            {formatSalary(mean, currency)}
          </Typography>
          <SalaryRangeBar min={min} mean={mean} max={max} currency={currency} />
          {comparison && (
            <Typography
              variant="body2"
              sx={{ color: comparisonNegative ? 'error.light' : 'text.secondary' }}
            >
              {comparison}
            </Typography>
          )}
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

function RoleSkeleton() {
  return (
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
  );
}
