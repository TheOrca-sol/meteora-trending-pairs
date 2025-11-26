import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  MenuItem,
  Slider,
  Divider,
  Button,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Paper
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  AutoMode as AutoModeIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Autorenew as AutorenewIcon,
  Balance as BalanceIcon,
  Shield as ShieldIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';

const STRATEGIES = [
  'Follow the Herd',
  'Peak Liquidity',
  'Full Imbalance Correction',
  'Liquidity Deficit Targeting',
  'Proportional Range Scaling',
  'Simple Percentage-Based'
];

const AutomationSettings = ({ walletAddress }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Automation settings state
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [defaultStrategy, setDefaultStrategy] = useState('Follow the Herd');

  // Risk management
  const [maxPositionSize, setMaxPositionSize] = useState(10);
  const [minRugCheckScore, setMinRugCheckScore] = useState(50);
  const [autoCloseOnSecurityDrop, setAutoCloseOnSecurityDrop] = useState(true);
  const [securityDropThreshold, setSecurityDropThreshold] = useState(30);

  // Default TP/SL
  const [defaultTakeProfit, setDefaultTakeProfit] = useState(50);
  const [defaultStopLoss, setDefaultStopLoss] = useState(-25);

  // Default compounding
  const [defaultAutoCompound, setDefaultAutoCompound] = useState(true);
  const [defaultCompoundFrequency, setDefaultCompoundFrequency] = useState(24);
  const [defaultCompoundThreshold, setDefaultCompoundThreshold] = useState(10);

  // Default rebalancing
  const [defaultRebalancing, setDefaultRebalancing] = useState(true);

  // Notifications
  const [notifyOnOpen, setNotifyOnOpen] = useState(true);
  const [notifyOnClose, setNotifyOnClose] = useState(true);
  const [notifyOnTakeProfit, setNotifyOnTakeProfit] = useState(true);
  const [notifyOnStopLoss, setNotifyOnStopLoss] = useState(true);
  const [notifyOnCompound, setNotifyOnCompound] = useState(false);
  const [notifyOnRebalance, setNotifyOnRebalance] = useState(true);

  // Fetch current settings
  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    fetchSettings();
  }, [walletAddress]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

      const response = await fetch(
        `${API_URL}/liquidity/automation/config?walletAddress=${walletAddress}`
      );

      if (response.ok) {
        const data = await response.json();
        const config = data.config;

        // Update all state from config
        setAutomationEnabled(config.automation_enabled || false);
        setDefaultStrategy(config.default_strategy || 'Follow the Herd');
        setMaxPositionSize(config.max_position_size_percentage || 10);
        setMinRugCheckScore(config.min_rugcheck_score || 50);
        setAutoCloseOnSecurityDrop(config.auto_close_on_security_drop !== false);
        setSecurityDropThreshold(config.security_drop_threshold || 30);
        setDefaultTakeProfit(config.default_take_profit_percentage || 50);
        setDefaultStopLoss(config.default_stop_loss_percentage || -25);
        setDefaultAutoCompound(config.default_auto_compound !== false);
        setDefaultCompoundFrequency(config.default_compound_frequency_hours || 24);
        setDefaultCompoundThreshold(config.default_compound_threshold_usd || 10);
        setDefaultRebalancing(config.default_rebalancing_enabled !== false);
        setNotifyOnOpen(config.notify_on_open !== false);
        setNotifyOnClose(config.notify_on_close !== false);
        setNotifyOnTakeProfit(config.notify_on_take_profit !== false);
        setNotifyOnStopLoss(config.notify_on_stop_loss !== false);
        setNotifyOnCompound(config.notify_on_compound || false);
        setNotifyOnRebalance(config.notify_on_rebalance !== false);
      }
    } catch (err) {
      console.error('Error fetching automation settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

      const configData = {
        walletAddress,
        automationEnabled,
        defaultStrategy,
        maxPositionSizePercentage: maxPositionSize,
        minRugcheckScore: minRugCheckScore,
        autoCloseOnSecurityDrop,
        securityDropThreshold,
        defaultTakeProfitPercentage: defaultTakeProfit,
        defaultStopLossPercentage: defaultStopLoss,
        defaultAutoCompound,
        defaultCompoundFrequencyHours: defaultCompoundFrequency,
        defaultCompoundThresholdUsd: defaultCompoundThreshold,
        defaultRebalancingEnabled: defaultRebalancing,
        notifyOnOpen,
        notifyOnClose,
        notifyOnTakeProfit,
        notifyOnStopLoss,
        notifyOnCompound,
        notifyOnRebalance
      };

      const response = await fetch(`${API_URL}/liquidity/automation/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      console.error('Error saving automation settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!walletAddress) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <AutoModeIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Connect Wallet to Configure Automation
        </Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
          Wallet connection required to manage automation settings
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <AutoModeIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Liquidity Automation
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure default settings for automated liquidity management. These settings apply to all new automated positions.
      </Typography>

      {/* Master Toggle */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: automationEnabled ? 'success.dark' : 'action.hover' }}>
        <FormControlLabel
          control={
            <Switch
              checked={automationEnabled}
              onChange={(e) => setAutomationEnabled(e.target.checked)}
              color="success"
            />
          }
          label={
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                Enable Automation
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {automationEnabled
                  ? 'Automation is active - positions will be monitored and managed automatically'
                  : 'Automation is disabled - manual management only'}
              </Typography>
            </Box>
          }
        />
      </Paper>

      {/* Strategy Selection */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Default Strategy
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            fullWidth
            select
            label="Preferred Strategy"
            value={defaultStrategy}
            onChange={(e) => setDefaultStrategy(e.target.value)}
            helperText="This strategy will be pre-selected when adding liquidity"
          >
            {STRATEGIES.map((strategy) => (
              <MenuItem key={strategy} value={strategy}>
                {strategy}
              </MenuItem>
            ))}
          </TextField>
        </AccordionDetails>
      </Accordion>

      {/* Risk Management */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <ShieldIcon fontSize="small" color="error" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Risk Management
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Max Position Size */}
            <Box>
              <Typography variant="body2" gutterBottom>
                Max Position Size: {maxPositionSize}% of wallet balance
              </Typography>
              <Slider
                value={maxPositionSize}
                onChange={(e, val) => setMaxPositionSize(val)}
                min={1}
                max={50}
                step={1}
                marks={[
                  { value: 5, label: '5%' },
                  { value: 10, label: '10%' },
                  { value: 25, label: '25%' },
                  { value: 50, label: '50%' }
                ]}
                valueLabelDisplay="auto"
              />
            </Box>

            {/* Min RugCheck Score */}
            <Box>
              <Typography variant="body2" gutterBottom>
                Minimum RugCheck Score: {minRugCheckScore}
              </Typography>
              <Slider
                value={minRugCheckScore}
                onChange={(e, val) => setMinRugCheckScore(val)}
                min={0}
                max={100}
                step={5}
                marks={[
                  { value: 0, label: '0' },
                  { value: 50, label: '50' },
                  { value: 100, label: '100' }
                ]}
                valueLabelDisplay="auto"
              />
            </Box>

            {/* Auto-close on security drop */}
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoCloseOnSecurityDrop}
                    onChange={(e) => setAutoCloseOnSecurityDrop(e.target.checked)}
                  />
                }
                label="Auto-close positions if security score drops"
              />
              {autoCloseOnSecurityDrop && (
                <Box sx={{ ml: 4, mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Close position if score drops below {securityDropThreshold}
                  </Typography>
                  <Slider
                    value={securityDropThreshold}
                    onChange={(e, val) => setSecurityDropThreshold(val)}
                    min={0}
                    max={100}
                    step={5}
                    valueLabelDisplay="auto"
                  />
                </Box>
              )}
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Default Take Profit / Stop Loss */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <TrendingUpIcon fontSize="small" color="success" />
            <TrendingDownIcon fontSize="small" color="error" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Take Profit & Stop Loss Defaults
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Take Profit */}
            <Box>
              <Typography variant="body2" gutterBottom>
                Default Take Profit: +{defaultTakeProfit}%
              </Typography>
              <Slider
                value={defaultTakeProfit}
                onChange={(e, val) => setDefaultTakeProfit(val)}
                min={10}
                max={200}
                step={5}
                marks={[
                  { value: 25, label: '25%' },
                  { value: 50, label: '50%' },
                  { value: 100, label: '100%' }
                ]}
                valueLabelDisplay="auto"
              />
            </Box>

            {/* Stop Loss */}
            <Box>
              <Typography variant="body2" gutterBottom>
                Default Stop Loss: {defaultStopLoss}%
              </Typography>
              <Slider
                value={Math.abs(defaultStopLoss)}
                onChange={(e, val) => setDefaultStopLoss(-val)}
                min={5}
                max={75}
                step={5}
                marks={[
                  { value: 10, label: '-10%' },
                  { value: 25, label: '-25%' },
                  { value: 50, label: '-50%' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(val) => `-${val}%`}
              />
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Auto-Compound Defaults */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <AutorenewIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Auto-Compound Defaults
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={defaultAutoCompound}
                  onChange={(e) => setDefaultAutoCompound(e.target.checked)}
                />
              }
              label="Enable auto-compound by default"
            />

            {defaultAutoCompound && (
              <>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Compound Frequency: Every {defaultCompoundFrequency} hours
                  </Typography>
                  <Slider
                    value={defaultCompoundFrequency}
                    onChange={(e, val) => setDefaultCompoundFrequency(val)}
                    min={6}
                    max={168}
                    step={6}
                    marks={[
                      { value: 6, label: '6h' },
                      { value: 24, label: '24h' },
                      { value: 168, label: '1w' }
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(val) => `${val}h`}
                  />
                </Box>

                <TextField
                  label="Minimum Threshold (USD)"
                  type="number"
                  value={defaultCompoundThreshold}
                  onChange={(e) => setDefaultCompoundThreshold(parseFloat(e.target.value) || 0)}
                  helperText="Only compound if fees exceed this amount"
                  inputProps={{ min: 1, step: 1 }}
                />
              </>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Auto-Rebalancing */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <BalanceIcon fontSize="small" color="warning" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Auto-Rebalancing
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <FormControlLabel
            control={
              <Switch
                checked={defaultRebalancing}
                onChange={(e) => setDefaultRebalancing(e.target.checked)}
              />
            }
            label="Enable auto-rebalancing by default"
          />
          {defaultRebalancing && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Positions will rebalance when: price drifts 10%, imbalance changes 2x, or fees reach $50
            </Alert>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Notifications */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <NotificationsIcon fontSize="small" color="info" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Telegram Notifications
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={<Switch checked={notifyOnOpen} onChange={(e) => setNotifyOnOpen(e.target.checked)} />}
              label="Position opened"
            />
            <FormControlLabel
              control={<Switch checked={notifyOnClose} onChange={(e) => setNotifyOnClose(e.target.checked)} />}
              label="Position closed"
            />
            <FormControlLabel
              control={<Switch checked={notifyOnTakeProfit} onChange={(e) => setNotifyOnTakeProfit(e.target.checked)} />}
              label="Take profit triggered"
            />
            <FormControlLabel
              control={<Switch checked={notifyOnStopLoss} onChange={(e) => setNotifyOnStopLoss(e.target.checked)} />}
              label="Stop loss triggered"
            />
            <FormControlLabel
              control={<Switch checked={notifyOnCompound} onChange={(e) => setNotifyOnCompound(e.target.checked)} />}
              label="Fees compounded"
            />
            <FormControlLabel
              control={<Switch checked={notifyOnRebalance} onChange={(e) => setNotifyOnRebalance(e.target.checked)} />}
              label="Position rebalanced"
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Error/Success Messages */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Settings saved successfully!
        </Alert>
      )}

      {/* Save Button */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </Box>
  );
};

export default AutomationSettings;
