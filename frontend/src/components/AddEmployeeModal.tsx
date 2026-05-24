import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack,
  MenuItem, InputAdornment, Alert, CircularProgress,
} from '@mui/material';
import {
  employeeCreateSchema, COUNTRIES,
  type EmployeeCreateInput, type Employee, type CountryCode,
} from '@app/shared';
import { z } from 'zod';

// The shared schema expects `salary` as a number, but HTML number inputs
// give string values. This local extension coerces salary from string so
// the zodResolver can validate form inputs correctly in both browser and jsdom.
const modalSchema = employeeCreateSchema.extend({
  salary: z.coerce.number({ invalid_type_error: 'Required' }).int('Whole numbers only').min(1, 'Must be at least 1'),
});
import { createEmployee } from '../api/employees';
import { ApiError } from '../api/client';
import { FormField } from './FormField';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (e: Employee) => void;
};

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  country: CountryCode | '';
  salary: number | '';
  hireDate: string;
};

const emptyDefaults: FormValues = {
  firstName: '', lastName: '', email: '', jobTitle: '', department: '',
  country: '', salary: '', hireDate: '',
};

export function AddEmployeeModal({ open, onClose, onCreated }: Props) {
  const { control, handleSubmit, watch, setError, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(modalSchema) as never,
    mode: 'onBlur',
    defaultValues: emptyDefaults,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const country = watch('country');
  const currency = country ? COUNTRIES[country].currency : undefined;

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);
    try {
      const employee = await createEmployee(data as EmployeeCreateInput);
      reset(emptyDefaults);
      onCreated(employee);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === 'EMAIL_TAKEN') {
        setError('email', { type: 'server', message: 'Email already in use' });
      } else if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Network error — please try again');
      }
    }
  });

  const handleClose = () => {
    if (formState.isSubmitting) return;
    reset(emptyDefaults);
    setSubmitError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Employee</DialogTitle>
      <DialogContent>
        <Stack
          component="form"
          id="add-employee-form"
          onSubmit={onSubmit}
          spacing={2}
          sx={{ pt: 1 }}
          noValidate
        >
          <FormField name="firstName"  control={control} label="First name" />
          <FormField name="lastName"   control={control} label="Last name" />
          <FormField name="email"      control={control} label="Email" type="email" />
          <FormField name="jobTitle"   control={control} label="Job title" />
          <FormField name="department" control={control} label="Department" />
          <FormField name="country" control={control} label="Country" select>
            {Object.entries(COUNTRIES).map(([code, c]) => (
              <MenuItem key={code} value={code}>{c.name} ({code})</MenuItem>
            ))}
          </FormField>
          <FormField
            name="salary"
            control={control}
            label="Salary"
            type="number"
            inputProps={{ min: 1, step: 1 }}
            InputProps={
              currency
                ? { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> }
                : undefined
            }
          />
          <FormField
            name="hireDate"
            control={control}
            label="Hire date"
            type="date"
            InputLabelProps={{ shrink: true }}
          />
          {submitError && <Alert severity="error">{submitError}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={formState.isSubmitting}>Cancel</Button>
        <Button
          type="submit"
          form="add-employee-form"
          variant="contained"
          disabled={formState.isSubmitting}
          startIcon={formState.isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
