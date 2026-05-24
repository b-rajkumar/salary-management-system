import { useState } from 'react';
import { Stack, Typography } from '@mui/material';
import { CountrySelector } from '../components/CountrySelector';
import { CountryInsightsCard } from '../components/CountryInsightsCard';

export function InsightsPage() {
  const [country, setCountry] = useState<string | null>(null);

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Insights</Typography>

      <CountrySelector value={country} onChange={setCountry} />

      {country === null ? (
        <Typography variant="body1" color="text.secondary">
          Select a country to see insights.
        </Typography>
      ) : (
        <CountryInsightsCard country={country} />
      )}

      <Typography variant="body2" color="text.secondary">
        Role-in-country insights ship with FR-6.
      </Typography>
    </Stack>
  );
}
