import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack,
  Typography, Alert, CircularProgress, Link, Box,
} from '@mui/material';
import type { BulkErrorItem, EmployeeCreateInput } from '@app/shared';
import { parseCsv } from '../lib/parseCsv';
import { validateBulkRows } from '../lib/validateBulkRows';
import { BulkErrorTable } from './BulkErrorTable';
import { bulkCreateEmployees } from '../api/employees';
import { ApiError } from '../api/client';

type State =
  | { kind: 'idle' }
  | { kind: 'parsing' }
  | { kind: 'ready'; rows: EmployeeCreateInput[] }
  | { kind: 'fe-error'; message: string }
  | { kind: 'row-errors'; errors: BulkErrorItem[]; source: 'fe' | 'be' }
  | { kind: 'uploading'; rows: EmployeeCreateInput[] }
  | { kind: 'be-error'; message: string };

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}

function extractBulkErrors(err: unknown): BulkErrorItem[] | null {
  if (!(err instanceof ApiError) || err.details === undefined) {
    return null;
  }

  const details = err.details as { errors?: unknown };

  if (!Array.isArray(details.errors)) {
    return null;
  }

  return details.errors as BulkErrorItem[];
}

export function ImportEmployeesModal({ open, onClose, onImported }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const close = (): void => {
    setState({ kind: 'idle' });
    onClose();
  };

  const onFile = async (file: File | undefined): Promise<void> => {
    if (!file) {
      return;
    }

    setState({ kind: 'parsing' });

    const parsed = await parseCsv(file);

    if (!parsed.ok) {
      setState({ kind: 'fe-error', message: parsed.message });

      return;
    }

    const validated = validateBulkRows(parsed.rows);

    if (!validated.ok) {
      setState({ kind: 'row-errors', errors: validated.errors, source: 'fe' });

      return;
    }

    setState({ kind: 'ready', rows: validated.parsed });
  };

  const onImport = async (): Promise<void> => {
    if (state.kind !== 'ready') {
      return;
    }

    setState({ kind: 'uploading', rows: state.rows });

    try {
      const result = await bulkCreateEmployees({ employees: state.rows });

      onImported(result.inserted);
      close();
    } catch (err) {
      const errors = extractBulkErrors(err);

      if (errors) {
        setState({ kind: 'row-errors', errors, source: 'be' });
      } else {
        setState({
          kind: 'be-error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  };

  const showFilePicker =
    state.kind === 'idle' || state.kind === 'fe-error' || state.kind === 'be-error';

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md">
      <DialogTitle>Import employees from CSV</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            CSV with header row. Up to 500 employees per import.{' '}
            <Link href="/employees-template.csv" download>Download template</Link>.
          </Typography>

          {showFilePicker && (
            <Box>
              <Button variant="outlined" component="label">
                Choose file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  aria-label="CSV file"
                  onChange={(e) => { void onFile(e.target.files?.[0]); }}
                />
              </Button>
            </Box>
          )}

          {state.kind === 'parsing' && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2">Parsing file…</Typography>
            </Stack>
          )}

          {state.kind === 'ready' && (
            <Alert severity="success">
              {state.rows.length} employees ready to import.
            </Alert>
          )}

          {state.kind === 'fe-error' && (
            <Alert severity="error">{state.message}</Alert>
          )}

          {state.kind === 'be-error' && (
            <Alert severity="error">{state.message}</Alert>
          )}

          {state.kind === 'row-errors' && (
            <Stack spacing={2}>
              <BulkErrorTable errors={state.errors} />
              <Box>
                <Button variant="outlined" component="label">
                  Choose a different file
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    hidden
                    aria-label="CSV file"
                    onChange={(e) => { void onFile(e.target.files?.[0]); }}
                  />
                </Button>
              </Box>
            </Stack>
          )}

          {state.kind === 'uploading' && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2">
                Importing {state.rows.length} employees…
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        {state.kind === 'ready' && (
          <Button variant="contained" onClick={() => { void onImport(); }}>
            Import {state.rows.length} employees
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
