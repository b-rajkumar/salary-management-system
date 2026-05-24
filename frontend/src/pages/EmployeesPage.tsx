import { useState } from 'react';
import { Stack, Typography, Button, Alert, Box } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { COUNTRIES, type Employee } from '@app/shared';
import { AddEmployeeModal } from '../components/AddEmployeeModal';
import { EmployeeDetailsModal } from '../components/EmployeeDetailsModal';
import { SalaryCell } from '../components/SalaryCell';
import { useEmployeesList } from '../hooks/useEmployeesList';

interface Status {
  severity: 'success' | 'error';
  message: string;
}

export function EmployeesPage() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [detailsEmployee, setDetailsEmployee] = useState<Employee | null>(null);

  const { data, isLoading, error, refresh } = useEmployeesList(page, pageSize);

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
          onClick={() => setDetailsEmployee(params.row)}
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

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={() => setOpen(true)}>
          Add Employee
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

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

      <AddEmployeeModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(e: Employee) => {
          setOpen(false);
          setStatus({ severity: 'success', message: `Added ${e.firstName} ${e.lastName}` });
          refresh();
        }}
      />

      <EmployeeDetailsModal
        open={detailsEmployee !== null}
        employee={detailsEmployee}
        onClose={() => setDetailsEmployee(null)}
      />
    </Stack>
  );
}
