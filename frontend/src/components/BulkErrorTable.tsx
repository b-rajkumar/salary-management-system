import {
  Stack, Typography, Table, TableHead, TableRow, TableCell, TableBody, Paper,
} from '@mui/material';
import type { BulkErrorItem } from '@app/shared';

const MAX_RENDERED = 500;

interface Props {
  errors: BulkErrorItem[];
}

export function BulkErrorTable({ errors }: Props) {
  const rowCount = new Set(errors.map((e) => e.index)).size;
  const visible = errors.slice(0, MAX_RENDERED);
  const truncated = errors.length - visible.length;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="error">
        Import failed — {errors.length} errors in {rowCount} rows. Fix and re-upload.
      </Typography>

      <Paper variant="outlined" sx={{ maxHeight: 320, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 64 }}>Row</TableCell>
              <TableCell sx={{ width: 120 }}>Field</TableCell>
              <TableCell>Problem</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((e, i) => (
              <TableRow key={i}>
                <TableCell>{e.index + 2}</TableCell>
                <TableCell>{e.field}</TableCell>
                <TableCell>{e.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {truncated > 0 && (
        <Typography variant="caption" color="text.secondary">
          … and {truncated} more. Fix these and re-upload to see the rest.
        </Typography>
      )}
    </Stack>
  );
}
