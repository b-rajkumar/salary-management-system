import { useEffect, useState } from 'react';
import { Stack, Typography, Button, Alert, Box, TextField } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { COUNTRIES, type Employee } from '@app/shared';
import { EmployeeDialog } from '../components/EmployeeDialog';
import { SalaryCell } from '../components/SalaryCell';
import { useEmployeesList } from '../hooks/useEmployeesList';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface Status {
  severity: 'success' | 'error';
  message: string;
}

type DialogState =
  | { intent: 'create' }
  | { intent: 'inspect'; employee: Employee }
  | null;

export function EmployeesPage() {
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [searchInput, setSearchInput] = useState('');
  const debouncedQ = useDebouncedValue(searchInput.trim(), 300);

  useEffect(() => {
    setPage(0);
  }, [debouncedQ]);

  const { data, isLoading, error, refresh } = useEmployeesList(page, pageSize, debouncedQ);

  const hasQuery = debouncedQ.length > 0;
  const isFirstRunEmpty = !isLoading && !error && !hasQuery && data.total === 0;
  const isNoMatches    = !isLoading && !error &&  hasQuery && data.total === 0;

  const columns: GridColDef<Employee>[] = [
    {
      field: 'fullName',
      headerName: 'Name',
      flex: 1.4,
      sortable: false,
      valueGetter: (_value, row) => `${row.firstName} ${row.lastName}`,
    },
    {
      field: 'country',
      headerName: 'Country',
      flex: 1,
      sortable: false,
      valueFormatter: (value: string) =>
        COUNTRIES[value as keyof typeof COUNTRIES]?.name ?? value,
    },
    {
      field: 'salary',
      headerName: 'Salary',
      flex: 1,
      sortable: false,
      renderCell: (params) => (
        <SalaryCell amount={params.row.salary} country={params.row.country} />
      ),
    },
    { field: 'hireDate', headerName: 'Hire date', flex: 1, sortable: false },
    {
      field: 'actions',
      headerName: '',
      flex: 0.6,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Button
          size="small"
          onClick={() => setDialogState({ intent: 'inspect', employee: params.row })}
          aria-label={`View ${params.row.firstName} ${params.row.lastName}`}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Employees</Typography>

      {status && (
        <Alert severity={status.severity} onClose={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}

      {!isFirstRunEmpty && (
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search by name, email, role, department, country…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ flex: 1 }}
            inputProps={{ 'aria-label': 'Search employees' }}
          />
          <Button variant="contained" onClick={() => setDialogState({ intent: 'create' })}>
            Add Employee
          </Button>
        </Stack>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {isFirstRunEmpty && (
        <Stack spacing={2} alignItems="center" sx={{ py: 10 }}>
          <Typography variant="h6" color="text.secondary">
            No employees yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add your first employee to get started.
          </Typography>
          <Button variant="contained" onClick={() => setDialogState({ intent: 'create' })}>
            Add Employee
          </Button>
        </Stack>
      )}

      {isNoMatches && (
        <Stack spacing={1} alignItems="center" sx={{ py: 6 }}>
          <Typography variant="h6" color="text.secondary">
            No matches for &ldquo;{debouncedQ}&rdquo;
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try a different search term.
          </Typography>
        </Stack>
      )}

      {!isFirstRunEmpty && !isNoMatches && (
        <Box sx={{ height: 640 }}>
          <DataGrid
            rows={data.rows}
            rowCount={data.total}
            columns={columns}
            getRowId={(row) => row.id}
            paginationMode="server"
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(m) => {
              setPage(m.page);
              setPageSize(m.pageSize);
            }}
            pageSizeOptions={[25, 50, 100]}
            loading={isLoading}
            disableColumnFilter
            disableColumnSorting
            disableColumnMenu
            disableRowSelectionOnClick
          />
        </Box>
      )}

      {dialogState?.intent === 'create' && (
        <EmployeeDialog
          open
          intent="create"
          onClose={() => setDialogState(null)}
          onSaved={(e) => {
            setDialogState(null);
            setStatus({ severity: 'success', message: `Added ${e.firstName} ${e.lastName}` });
            refresh();
          }}
        />
      )}

      {dialogState?.intent === 'inspect' && (
        <EmployeeDialog
          open
          intent="inspect"
          employee={dialogState.employee}
          onClose={() => setDialogState(null)}
          onSaved={(e) => {
            setStatus({ severity: 'success', message: `Updated ${e.firstName} ${e.lastName}` });
            refresh();
            setDialogState({ intent: 'inspect', employee: e });
          }}
        />
      )}
    </Stack>
  );
}
