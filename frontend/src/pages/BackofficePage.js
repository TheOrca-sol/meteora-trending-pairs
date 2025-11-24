import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  People as PeopleIcon,
  MonitorHeart as MonitorIcon,
  Storage as StorageIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useWallet } from '@solana/wallet-adapter-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const DEV_WALLET = 'DQMwHbduxUEEW4MPJWF6PbLhcPJBiLm5XTie4pwUPbuV';

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'primary' }) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: `${color}.lighter`,
            color: `${color}.main`
          }}
        >
          <Icon sx={{ fontSize: 32 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.disabled">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const BackofficePage = () => {
  const { publicKey } = useWallet();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isDevWallet = publicKey?.toBase58() === DEV_WALLET;

  useEffect(() => {
    const fetchAdminData = async () => {
      if (!publicKey || !isDevWallet) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(
          `${API_URL}/admin/dashboard?walletAddress=${publicKey.toBase58()}`
        );

        const result = await response.json();

        if (result.status === 'success') {
          setData(result.data);
        } else {
          setError(result.message || 'Failed to load admin data');
        }
      } catch (err) {
        console.error('Error fetching admin data:', err);
        setError('Failed to fetch admin data');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAdminData, 30000);
    return () => clearInterval(interval);
  }, [publicKey, isDevWallet]);

  if (!publicKey) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="warning">
          Please connect your wallet to access the backoffice.
        </Alert>
      </Container>
    );
  }

  if (!isDevWallet) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">
          Unauthorized. This page is only accessible to the dev wallet.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Admin Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          System overview and user management
        </Typography>
      </Box>

      {/* Stats Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={data?.users?.total || 0}
            subtitle={`${data?.users?.with_telegram || 0} with Telegram`}
            icon={PeopleIcon}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Degen Monitors"
            value={data?.degen_mode?.active_monitors || 0}
            subtitle={`${data?.degen_mode?.total_configs || 0} total configs`}
            icon={MonitorIcon}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Capital Monitors"
            value={data?.capital_rotation?.active_monitors || 0}
            subtitle={`${data?.capital_rotation?.total_configs || 0} total configs`}
            icon={MonitorIcon}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Cache Hit Rate"
            value={`${data?.cache?.hit_rate_percent || 0}%`}
            subtitle={`${data?.cache?.total_pools_filtered || 0} pools cached`}
            icon={StorageIcon}
            color="info"
          />
        </Grid>
      </Grid>

      {/* Users Table */}
      <Paper sx={{ mb: 4 }}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Registered Users
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Wallet Address</TableCell>
                <TableCell>Telegram</TableCell>
                <TableCell align="center">Degen Mode</TableCell>
                <TableCell align="center">Capital Rotation</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.users?.list?.map((user) => (
                <TableRow key={user.wallet_address} hover>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                    >
                      {user.wallet_address.slice(0, 4)}...{user.wallet_address.slice(-4)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {user.telegram_connected ? (
                      <Chip
                        label={user.telegram_username || 'Connected'}
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    ) : (
                      <Chip label="Not Connected" size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {user.degen_enabled ? (
                      <Chip
                        label={`${user.degen_threshold}%`}
                        size="small"
                        color="success"
                      />
                    ) : (
                      <Chip label="Off" size="small" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {user.capital_enabled ? (
                      <Chip
                        label={`${user.capital_threshold}%`}
                        size="small"
                        color="warning"
                      />
                    ) : (
                      <Chip label="Off" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : 'N/A'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Scheduler Jobs */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper>
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon color="success" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Degen Mode Jobs
                </Typography>
              </Box>
            </Box>
            <Box sx={{ p: 3 }}>
              {data?.degen_mode?.jobs?.length > 0 ? (
                data.degen_mode.jobs.map((job, idx) => (
                  <Box key={idx} sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {job.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Next run: {job.next_run ? new Date(job.next_run).toLocaleString() : 'N/A'}
                    </Typography>
                    {idx < data.degen_mode.jobs.length - 1 && <Divider sx={{ mt: 2 }} />}
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active jobs
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper>
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon color="warning" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Capital Rotation Jobs
                </Typography>
              </Box>
            </Box>
            <Box sx={{ p: 3 }}>
              {data?.capital_rotation?.jobs?.length > 0 ? (
                data.capital_rotation.jobs.map((job, idx) => (
                  <Box key={idx} sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {job.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Next run: {job.next_run ? new Date(job.next_run).toLocaleString() : 'N/A'}
                    </Typography>
                    {idx < data.capital_rotation.jobs.length - 1 && <Divider sx={{ mt: 2 }} />}
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active jobs
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Cache Stats */}
      <Paper sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Cache Statistics
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">
              Total Requests
            </Typography>
            <Typography variant="h6">{data?.cache?.total_requests || 0}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">
              Cache Hits
            </Typography>
            <Typography variant="h6">{data?.cache?.cache_hits || 0}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">
              Cache Misses
            </Typography>
            <Typography variant="h6">{data?.cache?.cache_misses || 0}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">
              Pools Filtered
            </Typography>
            <Typography variant="h6">{data?.cache?.pools_filtered_out || 0}</Typography>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default BackofficePage;
