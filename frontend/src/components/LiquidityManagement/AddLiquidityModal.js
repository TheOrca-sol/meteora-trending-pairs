import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
  Switch,
  Divider,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Autorenew as AutorenewIcon,
  Balance as BalanceIcon
} from '@mui/icons-material';
import { useWallet } from '@solana/wallet-adapter-react';
import { addLiquidity, calculateBinIds } from '../../services/meteoraLiquidityService';

const AddLiquidityModal = ({
  open,
  onClose,
  poolAddress,
  pairName,
  mintX,
  mintY,
  suggestedStrategy,
  liquidityStats
}) => {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();

  // Form state
  const [amountUSD, setAmountUSD] = useState('');
  const [amountTokenX, setAmountTokenX] = useState('');
  const [amountTokenY, setAmountTokenY] = useState('');
  const [inputMode, setInputMode] = useState('usd'); // 'usd', 'tokenX', 'tokenY', 'both'
  const [selectedStrategy, setSelectedStrategy] = useState(suggestedStrategy || null);
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
  const [takeProfitValue, setTakeProfitValue] = useState(50);
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossValue, setStopLossValue] = useState(-25);
  const [autoCompoundEnabled, setAutoCompoundEnabled] = useState(true);
  const [compoundFrequency, setCompoundFrequency] = useState(24);
  const [rebalancingEnabled, setRebalancingEnabled] = useState(false);
  const [rebalanceTriggers, setRebalanceTriggers] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);

  useEffect(() => {
    if (suggestedStrategy) {
      setSelectedStrategy(suggestedStrategy);
    }
  }, [suggestedStrategy]);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicKey) return;

      try {
        const response = await fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/wallet/balance?walletAddress=${publicKey.toString()}`
        );
        const data = await response.json();
        setWalletBalance(data.balanceSOL);
      } catch (err) {
        console.error('Error fetching balance:', err);
      }
    };

    if (open && publicKey) {
      fetchBalance();
    }
  }, [open, publicKey]);

  const handleAddLiquidity = async () => {
    if (!publicKey || !signTransaction || !signAllTransactions) {
      setError('Please connect your wallet first');
      return;
    }

    // Validation based on input mode
    if (inputMode === 'usd') {
      if (!amountUSD || parseFloat(amountUSD) <= 0) {
        setError('Please enter a valid USD amount');
        return;
      }
    } else if (inputMode === 'tokenX') {
      if (!amountTokenX || parseFloat(amountTokenX) <= 0) {
        setError('Please enter a valid Token X amount');
        return;
      }
    } else if (inputMode === 'tokenY') {
      if (!amountTokenY || parseFloat(amountTokenY) <= 0) {
        setError('Please enter a valid Token Y amount');
        return;
      }
    } else if (inputMode === 'both') {
      if ((!amountTokenX || parseFloat(amountTokenX) <= 0) && (!amountTokenY || parseFloat(amountTokenY) <= 0)) {
        setError('Please enter at least one token amount');
        return;
      }
    }

    if (!selectedStrategy) {
      setError('Please select a liquidity strategy');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Calculate bin IDs from price range
      const { lowerBinId, upperBinId, activeBinId } = await calculateBinIds({
        poolAddress,
        lowerPrice: selectedStrategy.lowerBound,
        upperPrice: selectedStrategy.upperBound
      });

      console.log('[Add Liquidity] Bin IDs:', { lowerBinId, upperBinId, activeBinId });

      // Prepare parameters based on input mode
      const params = {
        poolAddress,
        lowerBinId,
        upperBinId,
        wallet: { signTransaction, signAllTransactions },
        walletPublicKey: publicKey
      };

      // Add amount based on input mode
      if (inputMode === 'usd') {
        params.amountUSD = parseFloat(amountUSD);
      } else if (inputMode === 'tokenX') {
        params.amountTokenX = parseFloat(amountTokenX);
      } else if (inputMode === 'tokenY') {
        params.amountTokenY = parseFloat(amountTokenY);
      } else if (inputMode === 'both') {
        if (amountTokenX) params.amountTokenX = parseFloat(amountTokenX);
        if (amountTokenY) params.amountTokenY = parseFloat(amountTokenY);
      }

      // Add liquidity using Meteora SDK
      const { signature, positionAddress } = await addLiquidity(params);

      console.log('[Add Liquidity] Success:', { signature, positionAddress });

      // Record position in backend database
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

      const positionData = {
        walletAddress: publicKey.toString(),
        poolAddress,
        positionAddress,
        tokenXMint: mintX,
        tokenYMint: mintY,
        tokenXSymbol: pairName?.split('-')[0]?.trim(),
        tokenYSymbol: pairName?.split('-')[1]?.trim(),
        amountX: 0, // Will be calculated by backend
        amountY: 0, // Will be calculated by backend
        liquidityUsd: parseFloat(amountUSD),
        lowerPrice: selectedStrategy.lowerBound,
        upperPrice: selectedStrategy.upperBound,
        lowerBinId,
        upperBinId,
        activeBinId,
        strategyName: selectedStrategy.name,
        transactionSignature: signature,
        positionType: 'manual',
        automationRules: {
          takeProfitEnabled,
          takeProfitType: 'percentage',
          takeProfitValue,
          stopLossEnabled,
          stopLossType: 'percentage',
          stopLossValue,
          autoCompoundEnabled,
          compoundFrequencyHours: compoundFrequency,
          compoundMinThresholdUsd: 10.0,
          rebalancingEnabled,
          rebalanceTriggers: rebalancingEnabled ? [
            { type: 'price_drift', value: 10 },
            { type: 'imbalance_change', value: 2.0 },
            { type: 'fee_threshold', value: 50 }
          ] : []
        }
      };

      const response = await fetch(`${API_URL}/liquidity/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(positionData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record position');
      }

      console.log('[Add Liquidity] Position recorded in database');

      // Show success message and close modal
      alert(`Liquidity added successfully!\n\nTransaction: ${signature}\nPosition: ${positionAddress}`);
      onClose();

    } catch (err) {
      console.error('[Add Liquidity] Error:', err);
      setError(err.message || 'Failed to add liquidity');
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentOfBalance = () => {
    if (!walletBalance || !amountUSD) return 0;
    return ((parseFloat(amountUSD) / walletBalance) * 100).toFixed(2);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          borderRadius: 2
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <AddIcon color="primary" />
          <Typography variant="h6">
            Add Liquidity - {pairName}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 2 }}>

          {/* Amount Input Mode Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Liquidity Amount
            </Typography>
            <ButtonGroup fullWidth size="small" sx={{ mb: 2 }}>
              <Button
                variant={inputMode === 'usd' ? 'contained' : 'outlined'}
                onClick={() => setInputMode('usd')}
              >
                USD Value
              </Button>
              <Button
                variant={inputMode === 'tokenX' ? 'contained' : 'outlined'}
                onClick={() => setInputMode('tokenX')}
              >
                Token X Amount
              </Button>
              <Button
                variant={inputMode === 'tokenY' ? 'contained' : 'outlined'}
                onClick={() => setInputMode('tokenY')}
              >
                Token Y Amount
              </Button>
              <Button
                variant={inputMode === 'both' ? 'contained' : 'outlined'}
                onClick={() => setInputMode('both')}
              >
                Both Tokens
              </Button>
            </ButtonGroup>

            {inputMode === 'usd' && (
              <TextField
                fullWidth
                label="Amount (USD)"
                type="number"
                value={amountUSD}
                onChange={(e) => setAmountUSD(e.target.value)}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography>,
                }}
                helperText="Enter total liquidity value in USD"
              />
            )}

            {inputMode === 'tokenX' && (
              <TextField
                fullWidth
                label={`Amount (Token X)`}
                type="number"
                value={amountTokenX}
                onChange={(e) => setAmountTokenX(e.target.value)}
                helperText={`Enter amount of Token X (${mintX?.slice(0, 8)}...)`}
              />
            )}

            {inputMode === 'tokenY' && (
              <TextField
                fullWidth
                label={`Amount (Token Y)`}
                type="number"
                value={amountTokenY}
                onChange={(e) => setAmountTokenY(e.target.value)}
                helperText={`Enter amount of Token Y (${mintY?.slice(0, 8)}...)`}
              />
            )}

            {inputMode === 'both' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Token X Amount"
                  type="number"
                  value={amountTokenX}
                  onChange={(e) => setAmountTokenX(e.target.value)}
                  helperText={`${mintX?.slice(0, 8)}...`}
                />
                <TextField
                  fullWidth
                  label="Token Y Amount"
                  type="number"
                  value={amountTokenY}
                  onChange={(e) => setAmountTokenY(e.target.value)}
                  helperText={`${mintY?.slice(0, 8)}...`}
                />
              </Box>
            )}
          </Box>

          {/* Strategy Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Liquidity Strategy
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              {selectedStrategy
                ? `Selected: ${selectedStrategy.name} (${selectedStrategy.rangePercentage}% range)`
                : 'Select a strategy from the Liquidity Distribution chart above'}
            </Typography>
            {selectedStrategy && (
              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography variant="body2">
                  <strong>{selectedStrategy.name}</strong>: {selectedStrategy.description}
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Range: ${selectedStrategy.lowerBound.toFixed(6)} - ${selectedStrategy.upperBound.toFixed(6)}
                </Typography>
                <Typography variant="caption" display="block">
                  Side: <Chip label={selectedStrategy.side} size="small" color="primary" sx={{ ml: 0.5 }} />
                </Typography>
              </Alert>
            )}
          </Box>

          <Divider />

          {/* Automation Settings */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Position Management (Optional)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

                {/* Take Profit */}
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={takeProfitEnabled}
                        onChange={(e) => setTakeProfitEnabled(e.target.checked)}
                        color="success"
                      />
                    }
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <TrendingUpIcon fontSize="small" color="success" />
                        <Typography variant="body2">Take Profit</Typography>
                      </Box>
                    }
                  />
                  {takeProfitEnabled && (
                    <Box sx={{ ml: 4, mt: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Close position at +{takeProfitValue}% profit
                      </Typography>
                      <Slider
                        value={takeProfitValue}
                        onChange={(e, val) => setTakeProfitValue(val)}
                        min={10}
                        max={200}
                        step={5}
                        marks={[
                          { value: 25, label: '25%' },
                          { value: 50, label: '50%' },
                          { value: 100, label: '100%' },
                          { value: 200, label: '200%' }
                        ]}
                        valueLabelDisplay="on"
                      />
                    </Box>
                  )}
                </Box>

                {/* Stop Loss */}
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={stopLossEnabled}
                        onChange={(e) => setStopLossEnabled(e.target.checked)}
                        color="error"
                      />
                    }
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <TrendingDownIcon fontSize="small" color="error" />
                        <Typography variant="body2">Stop Loss</Typography>
                      </Box>
                    }
                  />
                  {stopLossEnabled && (
                    <Box sx={{ ml: 4, mt: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Close position at {stopLossValue}% loss
                      </Typography>
                      <Slider
                        value={Math.abs(stopLossValue)}
                        onChange={(e, val) => setStopLossValue(-val)}
                        min={5}
                        max={75}
                        step={5}
                        marks={[
                          { value: 10, label: '-10%' },
                          { value: 25, label: '-25%' },
                          { value: 50, label: '-50%' },
                          { value: 75, label: '-75%' }
                        ]}
                        valueLabelDisplay="on"
                        valueLabelFormat={(val) => `-${val}%`}
                      />
                    </Box>
                  )}
                </Box>

                {/* Auto-Compound */}
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoCompoundEnabled}
                        onChange={(e) => setAutoCompoundEnabled(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <AutorenewIcon fontSize="small" color="primary" />
                        <Typography variant="body2">Auto-Compound Fees</Typography>
                      </Box>
                    }
                  />
                  {autoCompoundEnabled && (
                    <Box sx={{ ml: 4, mt: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Compound every {compoundFrequency} hours
                      </Typography>
                      <Slider
                        value={compoundFrequency}
                        onChange={(e, val) => setCompoundFrequency(val)}
                        min={6}
                        max={168}
                        step={6}
                        marks={[
                          { value: 6, label: '6h' },
                          { value: 24, label: '24h' },
                          { value: 72, label: '3d' },
                          { value: 168, label: '1w' }
                        ]}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(val) => `${val}h`}
                      />
                    </Box>
                  )}
                </Box>

                {/* Rebalancing */}
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={rebalancingEnabled}
                        onChange={(e) => setRebalancingEnabled(e.target.checked)}
                        color="warning"
                      />
                    }
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <BalanceIcon fontSize="small" color="warning" />
                        <Typography variant="body2">Auto-Rebalancing</Typography>
                      </Box>
                    }
                  />
                  {rebalancingEnabled && (
                    <Alert severity="info" sx={{ ml: 4, mt: 1 }}>
                      <Typography variant="caption">
                        Position will rebalance when price drifts, imbalance changes, or fee threshold is reached
                      </Typography>
                    </Alert>
                  )}
                </Box>

              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Error Display */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleAddLiquidity}
          disabled={loading || !publicKey ||
            (inputMode === 'usd' && !amountUSD) ||
            (inputMode === 'tokenX' && !amountTokenX) ||
            (inputMode === 'tokenY' && !amountTokenY) ||
            (inputMode === 'both' && !amountTokenX && !amountTokenY) ||
            !selectedStrategy}
          startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
        >
          {loading ? 'Adding...' : 'Add Liquidity'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddLiquidityModal;
