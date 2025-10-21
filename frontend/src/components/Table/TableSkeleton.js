import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  Box,
} from '@mui/material';

const TableSkeleton = ({ rows = 10 }) => {
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Skeleton variant="circular" width={24} height={24} />
            </TableCell>
            <TableCell><Skeleton variant="text" width={120} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={80} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={80} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={100} /></TableCell>
            <TableCell align="right"><Skeleton variant="text" width={80} /></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({ length: rows }).map((_, index) => (
            <TableRow key={index}>
              <TableCell padding="checkbox">
                <Skeleton variant="circular" width={24} height={24} />
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="80%" />
                    <Skeleton variant="text" width="60%" sx={{ fontSize: '0.75rem' }} />
                  </Box>
                </Box>
              </TableCell>
              <TableCell align="right">
                <Skeleton variant="text" width={80} sx={{ ml: 'auto' }} />
              </TableCell>
              <TableCell align="right">
                <Skeleton variant="text" width={80} sx={{ ml: 'auto' }} />
              </TableCell>
              <TableCell align="right">
                <Skeleton variant="text" width={100} sx={{ ml: 'auto' }} />
              </TableCell>
              <TableCell align="right">
                <Skeleton variant="text" width={80} sx={{ ml: 'auto' }} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TableSkeleton;
