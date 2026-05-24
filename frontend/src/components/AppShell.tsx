import type { ReactNode } from 'react';
import { AppBar, Tabs, Tab, Toolbar, Typography, Container, Box } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const value = location.pathname.startsWith('/insights') ? '/insights' : '/';
  return (
    <Box>
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ mr: 4 }}>Salary Management</Typography>
          <Tabs value={value} aria-label="Main navigation">
            <Tab label="Employees" value="/" component={Link} to="/" />
            <Tab label="Insights"  value="/insights" component={Link} to="/insights" />
          </Tabs>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>{children}</Container>
    </Box>
  );
}
