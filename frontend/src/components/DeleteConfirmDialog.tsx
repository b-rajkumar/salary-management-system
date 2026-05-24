import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Alert, CircularProgress, Stack,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { ApiError } from '../api/client';
import type { Employee } from '@app/shared';

interface DeleteConfirmDialogProps {
  open: boolean;
  employee: Employee | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmDialog({ open, employee, onCancel, onConfirm }: DeleteConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!employee) {return null;}

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Delete employee?</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body1">
            Delete <strong>{employee.firstName} {employee.lastName}</strong> ({employee.email}, {employee.country})?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This cannot be undone.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={submitting} autoFocus>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
