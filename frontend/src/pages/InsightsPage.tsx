import { useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { CountrySelector } from '../components/CountrySelector';
import { JobTitleSelector } from '../components/JobTitleSelector';
import { InsightsCard } from '../components/InsightsCard';

export function InsightsPage() {
  const [country, setCountry] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const handleCountryChange = (next: string | null) => {
    setCountry(next);
    setRole(null);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Insights</Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Box sx={{ width: { xs: '100%', sm: 320 } }}>
          <CountrySelector value={country} onChange={handleCountryChange} />
        </Box>
        <Box sx={{ width: { xs: '100%', sm: 320 } }}>
          <JobTitleSelector country={country} value={role} onChange={setRole} />
        </Box>
      </Stack>

      {country === null ? (
        <Typography variant="body1" color="text.secondary">
          Select a country to see insights.
        </Typography>
      ) : (
        <InsightsCard country={country} role={role} />
      )}
    </Stack>
  );
}
