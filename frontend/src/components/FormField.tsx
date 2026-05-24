import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { TextField, type TextFieldProps } from '@mui/material';

type Props<T extends FieldValues> = {
  name: Path<T>;
  control: Control<T>;
  label: string;
} & Omit<TextFieldProps, 'name' | 'error' | 'helperText'>;

export function FormField<T extends FieldValues>({
  name,
  control,
  label,
  children,
  helperText,
  ...rest
}: Props<T> & { helperText?: TextFieldProps['helperText'] }) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...rest}
          {...field}
          label={label}
          fullWidth
          error={!!fieldState.error}
          helperText={fieldState.error?.message ?? helperText}
        >
          {children}
        </TextField>
      )}
    />
  );
}
