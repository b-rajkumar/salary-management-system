import { useState } from 'react';
import {
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { Employee } from '@app/shared';

interface RowActionsProps {
  employee: Employee;
  onView: (e: Employee) => void;
  onEdit: (e: Employee) => void;
  onDelete: (e: Employee) => void;
}

export function RowActions({ employee, onView, onEdit, onDelete }: RowActionsProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const label = `Actions for ${employee.firstName} ${employee.lastName}`;

  const close = () => setAnchorEl(null);

  const fire = (cb: (e: Employee) => void) => () => {
    close();
    cb(employee);
  };

  return (
    <>
      <IconButton
        size="small"
        aria-label={label}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={close}>
        <MenuItem onClick={fire(onView)}>
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
          <ListItemText>View</ListItemText>
        </MenuItem>
        <MenuItem onClick={fire(onEdit)}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={fire(onDelete)} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
