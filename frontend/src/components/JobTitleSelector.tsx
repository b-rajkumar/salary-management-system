import { Autocomplete, TextField } from '@mui/material';
import { COUNTRIES } from '@app/shared';
import { useJobTitles } from '../hooks/useJobTitles';

interface JobTitleSelectorProps {
  country: string | null;
  value: string | null;
  onChange: (jobTitle: string | null) => void;
}

const ALL_ROLES = '__ALL__';

export function JobTitleSelector({ country, value, onChange }: JobTitleSelectorProps) {
  const { titles, isLoading } = useJobTitles(country);

  if (country === null) {
    return (
      <Autocomplete
        disabled
        options={[]}
        value={null}
        onChange={() => {}}
        renderInput={(params) => (
          <TextField {...params} label="Role" helperText="Pick a country first" />
        )}
      />
    );
  }

  if (!isLoading && titles.length === 0) {
    const name = COUNTRIES[country as keyof typeof COUNTRIES]?.name ?? country;

    return (
      <Autocomplete
        disabled
        options={[]}
        value={null}
        onChange={() => {}}
        renderInput={(params) => (
          <TextField {...params} label="Role" helperText={`No roles in ${name}`} />
        )}
      />
    );
  }

  const options = [ALL_ROLES, ...titles];
  const selected = value ?? ALL_ROLES;

  return (
    <Autocomplete
      options={options}
      value={selected}
      onChange={(_e, next) => onChange(next === ALL_ROLES ? null : next)}
      getOptionLabel={(option) => (option === ALL_ROLES ? 'All roles' : option)}
      isOptionEqualToValue={(option, val) => option === val}
      disableClearable
      loading={isLoading}
      renderInput={(params) => <TextField {...params} label="Role" />}
    />
  );
}
