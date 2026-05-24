import { Stack, Typography, Alert } from '@mui/material';

export function EmployeesPage() {
  return (
    <Stack spacing={3}>
      <Typography variant="h4">Employees</Typography>
      <Alert severity="info">Add Employee arrives in the next step of FR-1.</Alert>
    </Stack>
  );
}
