import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack,
  MenuItem, InputAdornment, Alert, CircularProgress,
  Box, Typography, Divider,
} from '@mui/material';
import {
  employeeCreateSchema, COUNTRIES,
  type Employee, type EmployeeCreateInput, type EmployeeUpdateInput, type CountryCode,
} from '@app/shared';
import { z } from 'zod';
import { createEmployee, updateEmployee } from '../api/employees';
import { ApiError } from '../api/client';
import { FormField } from './FormField';
import { SalaryCell } from './SalaryCell';

const dialogFormSchema = employeeCreateSchema.extend({
  salary: z.coerce.number({ invalid_type_error: 'Required' }).int('Whole numbers only').min(1, 'Must be at least 1'),
});

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  country: CountryCode | '';
  salary: number | '';
  hireDate: string;
}

const emptyDefaults: FormValues = {
  firstName: '', lastName: '', email: '', jobTitle: '', department: '',
  country: '', salary: '', hireDate: '',
};

function toFormValues(e: Employee): FormValues {
  return {
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    jobTitle: e.jobTitle,
    department: e.department,
    country: e.country as CountryCode,
    salary: e.salary,
    hireDate: e.hireDate,
  };
}

type Props =
  | { open: boolean; intent: 'create'; onClose: () => void; onSaved: (e: Employee) => void }
  | {
      open: boolean;
      intent: 'inspect';
      employee: Employee;
      onClose: () => void;
      onSaved: (e: Employee) => void;
    };

export function EmployeeDialog(props: Props) {
  if (props.intent === 'inspect') {
    return <InspectDialog {...props} />;
  }

  return <CreateDialog {...props} />;
}

function formatTimestamp(s: string): string {
  const iso = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`;
  const d = new Date(iso);

  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 19).replace('T', ' ');
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body1">{children}</Typography>
    </Box>
  );
}

function ViewBody({ employee }: { employee: Employee }) {
  const countryEntry = COUNTRIES[employee.country as CountryCode];
  const countryDisplay = countryEntry
    ? `${countryEntry.name} (${employee.country})`
    : employee.country;

  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <Field label="First name">{employee.firstName}</Field>
      <Field label="Last name">{employee.lastName}</Field>
      <Field label="Email">{employee.email}</Field>
      <Field label="Job title">{employee.jobTitle}</Field>
      <Field label="Department">{employee.department}</Field>
      <Field label="Country">{countryDisplay}</Field>
      <Field label="Salary">
        <SalaryCell amount={employee.salary} country={employee.country} />
      </Field>
      <Field label="Hire date">{employee.hireDate}</Field>
      <Divider />
      <Field label="Created">{formatTimestamp(employee.createdAt)}</Field>
      <Field label="Last updated">{formatTimestamp(employee.updatedAt)}</Field>
    </Stack>
  );
}

function InspectDialog({
  open, employee, onClose, onSaved,
}: Extract<Props, { intent: 'inspect' }>) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [current, setCurrent] = useState<Employee>(employee);
  const initialValues = toFormValues(current);

  const { control, handleSubmit, watch, setValue, setError, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(dialogFormSchema) as never,
    mode: 'onBlur',
    defaultValues: initialValues,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [salaryHelper, setSalaryHelper] = useState<string | null>(null);

  const country = watch('country');
  const currency = country ? COUNTRIES[country as CountryCode].currency : undefined;

  useEffect(() => {
    if (mode !== 'edit') {return;}

    if (country && country !== initialValues.country) {
      setValue('salary', '' as unknown as number, { shouldDirty: true });
      setSalaryHelper(`Salary cleared — re-enter in ${COUNTRIES[country as CountryCode].currency}.`);
    } else {
      setSalaryHelper(null);
    }
  }, [country, mode]);

  const enterEdit = () => {
    reset(toFormValues(current));
    setSubmitError(null);
    setSalaryHelper(null);
    setMode('edit');
  };

  const cancelEdit = () => {
    reset(toFormValues(current));
    setSubmitError(null);
    setSalaryHelper(null);
    setMode('view');
  };

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);
    try {
      const updated = await updateEmployee(current.id, data as EmployeeUpdateInput);

      setCurrent(updated);
      setMode('view');
      onSaved(updated);
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

  if (mode === 'view') {
    return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>{current.firstName} {current.lastName}</DialogTitle>
        <DialogContent>
          <ViewBody employee={current} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
          <Button variant="contained" onClick={enterEdit}>Edit</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit employee</DialogTitle>
      <DialogContent>
        <Stack
          component="form"
          id="employee-dialog-form"
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
            helperText={salaryHelper ?? undefined}
          />
          <FormField
            name="hireDate"
            control={control}
            label="Hire date"
            type="date"
            InputLabelProps={{ shrink: true }}
            helperText="Edit only to correct a typo — hire date is a historical record."
          />
          {submitError && <Alert severity="error">{submitError}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={cancelEdit} disabled={formState.isSubmitting}>Cancel</Button>
        <Button
          type="submit"
          form="employee-dialog-form"
          variant="contained"
          disabled={formState.isSubmitting || !formState.isDirty}
          startIcon={formState.isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CreateDialog({ open, onClose, onSaved }: Extract<Props, { intent: 'create' }>) {
  const { control, handleSubmit, watch, setError, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(dialogFormSchema) as never,
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
      onSaved(employee);
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
    if (formState.isSubmitting) {return;}
    reset(emptyDefaults);
    setSubmitError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Add employee</DialogTitle>
      <DialogContent>
        <Stack
          component="form"
          id="employee-dialog-form"
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
          form="employee-dialog-form"
          variant="contained"
          disabled={formState.isSubmitting}
          startIcon={formState.isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
