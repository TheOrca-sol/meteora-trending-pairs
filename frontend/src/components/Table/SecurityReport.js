import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Tooltip,
  LinearProgress,
  Chip,
  IconButton,
  Link,
  CircularProgress,
} from '@mui/material';
import {
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  InfoOutlined as InfoIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { getPairXToken } from '../../utils/helpers';

const SecurityIndicator = ({ status, label, description, value, severity }) => {
  const getStatusColor = () => {
    switch (severity) {
      case 'high':
        return {
          bg: 'error.lighter',
          border: 'error.light',
          text: 'error.main',
          icon: <ErrorIcon fontSize="small" />
        };
      case 'medium':
        return {
          bg: 'warning.lighter',
          border: 'warning.light',
          text: 'warning.main',
          icon: <WarningIcon fontSize="small" />
        };
      case 'low':
        return {
          bg: 'success.lighter',
          border: 'success.light',
          text: 'success.main',
          icon: <CheckCircleIcon fontSize="small" />
        };
      default:
        return {
          bg: 'grey.100',
          border: 'grey.300',
          text: 'text.secondary',
          icon: <InfoIcon fontSize="small" />
        };
    }
  };

  const colors = getStatusColor();

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        bgcolor: colors.bg,
        border: 1,
        borderColor: colors.border,
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ color: colors.text }}>
            {colors.icon}
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colors.text }}>
            {label}
          </Typography>
        </Box>
        <Tooltip title={description} arrow placement="top">
          <IconButton size="small" sx={{ color: colors.text }}>
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {status}
      </Typography>
      
      {value !== undefined && (
        <Box sx={{ mt: 1 }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 0.5
          }}>
            <Typography variant="caption" color="text.secondary">
              Risk Score
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 500, color: colors.text }}>
              {value}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={value}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'background.paper',
              '& .MuiLinearProgress-bar': {
                bgcolor: colors.text
              }
            }}
          />
        </Box>
      )}
    </Paper>
  );
};

const SecurityReport = ({ pair }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const pairXToken = getPairXToken(pair);

  useEffect(() => {
    const fetchRugCheckReport = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `https://api.rugcheck.xyz/v1/tokens/${pairXToken?.address}/report/summary`
        );
        setReportData(response.data);
      } catch (err) {
        console.error('Error fetching RugCheck report:', err);
        setError('Failed to fetch security report');
      } finally {
        setLoading(false);
      }
    };

    if (pairXToken?.address) {
      fetchRugCheckReport();
    }
  }, [pairXToken?.address]);

  const getRiskColor = (level) => {
    switch (level) {
      case 'danger':
        return 'error.main';
      case 'warn':
        return 'warning.main';
      default:
        return 'success.main';
    }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
      <CircularProgress size={24} />
    </Box>
  );

  if (error) return (
    <Box sx={{ p: 3, textAlign: 'center', color: 'error.main' }}>
      <ErrorIcon sx={{ mb: 1 }} />
      <Typography>{error}</Typography>
    </Box>
  );

  if (!reportData) return null;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 3
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Security Report
          </Typography>
        </Box>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 1,
          bgcolor: 'background.default',
          px: 1.5,
          py: 0.5,
          borderRadius: 1
        }}>
          <Typography variant="caption" color="text.secondary">
            Score:
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: reportData.score <= 5000 ? 'success.main' : reportData.score <= 20000 ? 'warning.main' : 'error.main'
            }}
          >
            {reportData.score.toLocaleString()}
          </Typography>
        </Box>
      </Box>

      {/* Risk Items */}
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
        {reportData.risks.map((risk, index) => (
          <Paper
            key={index}
            elevation={0}
            sx={{ 
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.default',
              border: 1,
              borderColor: getRiskColor(risk.level),
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1
            }}>
              <Typography 
                variant="subtitle2"
                sx={{ 
                  fontWeight: 600,
                  color: getRiskColor(risk.level)
                }}
              >
                {risk.name}
              </Typography>
              {risk.value && (
                <Typography 
                  variant="caption"
                  sx={{ 
                    fontWeight: 600,
                    color: getRiskColor(risk.level)
                  }}
                >
                  {risk.value}
                </Typography>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {risk.description}
            </Typography>
          </Paper>
        ))}
      </Box>

      
    </Box>
  );
};

export default SecurityReport; 