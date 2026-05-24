import { Autocomplete, TextField } from '@mui/material';
import { COUNTRIES } from '@app/shared';

interface CountrySelectorProps {
  value: string | null;
  onChange: (code: string | null) => void;
}

const OPTIONS = (Object.keys(COUNTRIES) as Array<keyof typeof COUNTRIES>)
  .map((code) => ({ code: code as string, name: COUNTRIES[code].name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function CountrySelector({ value, onChange }: CountrySelectorProps) {
  const selected = OPTIONS.find((o) => o.code === value) ?? null;

  return (
    <Autocomplete
      options={OPTIONS}
      value={selected}
      onChange={(_e, next) => onChange(next?.code ?? null)}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, val) => option.code === val.code}
      renderInput={(params) => <TextField {...params} label="Country" />}
    />
  );
}
