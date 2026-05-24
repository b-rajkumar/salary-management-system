import { useState } from 'react';
import { Stack, Typography, Button, Alert } from '@mui/material';
import { AddEmployeeModal } from '../components/AddEmployeeModal';
import type { Employee } from '@app/shared';

type Status = { severity: 'success' | 'error'; message: string };

export function EmployeesPage() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Employees</Typography>

      {status && (
        <Alert severity={status.severity} onClose={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}

      <Button
        variant="contained"
        onClick={() => setOpen(true)}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add Employee
      </Button>

      <Alert severity="info">List view arrives with the next slice.</Alert>

      <AddEmployeeModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(e: Employee) => {
          setOpen(false);
          setStatus({ severity: 'success', message: `Added ${e.firstName} ${e.lastName}` });
        }}
      />
    </Stack>
  );
}
