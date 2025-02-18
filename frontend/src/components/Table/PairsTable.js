import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  TablePagination,
  Collapse,
  IconButton,
  Box
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { getColumns } from './columns';
import { trackUserInteraction } from '../../utils/analytics';
import ExpandedRow from './ExpandedRow';

const Row = ({ pair, columns }) => {
  const [open, setOpen] = useState(false);

  const handleRowClick = () => {
    setOpen(!open);
    trackUserInteraction.pairClick(pair.pairName);
  };

  return (
    <>
      <TableRow 
        hover
        onClick={handleRowClick}
        sx={{ 
          cursor: 'pointer',
          backgroundColor: pair.is_blacklisted ? 'error.lighter' : 'inherit',
          '&:hover': {
            backgroundColor: pair.is_blacklisted ? 'error.light' : 'action.hover'
          }
        }}
      >
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        {columns.map((column) => (
          <TableCell
            key={column.id}
            align={column.numeric ? 'right' : 'left'}
          >
            {column.render ? column.render(pair) : pair[column.id]}
          </TableCell>
        ))}
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={columns.length + 1}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <ExpandedRow pair={pair} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const PairsTable = ({
  pairs,
  orderBy,
  order,
  page,
  rowsPerPage,
  handleSort,
  handleChangePage,
  handleChangeRowsPerPage,
  totalCount
}) => {
  const columns = getColumns();

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="pairs table">
        <TableHead>
          <TableRow>
            <TableCell style={{ width: 50 }} /> {/* For expand/collapse icon */}
            {columns.map((column) => (
              <TableCell
                key={column.id}
                align={column.numeric ? 'right' : 'left'}
                sortDirection={orderBy === column.id ? order : false}
                onClick={() => handleSort(column.id)}
                sx={{ cursor: 'pointer' }}
              >
                <TableSortLabel
                  active={orderBy === column.id}
                  direction={orderBy === column.id ? order : 'asc'}
                >
                  {column.label}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {pairs.map((pair, index) => (
            <Row key={index} pair={pair} columns={columns} />
          ))}
        </TableBody>
      </Table>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={totalCount}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </TableContainer>
  );
};

export default PairsTable; 