import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, Box,
} from '@mui/material';
import { COUNTRIES, type Employee } from '@app/shared';
import { SalaryCell } from './SalaryCell';

interface Props {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body1">{children}</Typography>
    </Box>
  );
}

export function EmployeeDetailsModal({ open, employee, onClose }: Props) {
  if (!employee) {
    return null;
  }

  const countryEntry = COUNTRIES[employee.country as keyof typeof COUNTRIES];
  const countryDisplay = countryEntry
    ? `${countryEntry.name} (${employee.country})`
    : employee.country;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="employee-details-title">
      <DialogTitle id="employee-details-title">Employee details</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Field label="Name">{`${employee.firstName} ${employee.lastName}`}</Field>
          <Field label="Email">{employee.email}</Field>
          <Field label="Job title">{employee.jobTitle}</Field>
          <Field label="Department">{employee.department}</Field>
          <Field label="Country">{countryDisplay}</Field>
          <Field label="Salary">
            <SalaryCell amount={employee.salary} country={employee.country} />
          </Field>
          <Field label="Hire date">{employee.hireDate}</Field>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
