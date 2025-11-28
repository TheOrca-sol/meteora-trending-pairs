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
  Chip,
  Grid
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Autorenew as AutorenewIcon,
  Balance as BalanceIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useWallet } from '@solana/wallet-adapter-react';
import { addLiquidity, calculateBinIds } from '../../services/meteoraLiquidityService';
import BinRangeSelector from './BinRangeSelector';

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
  const [amountTokenX, setAmountTokenX] = useState('');
  const [amountTokenY, setAmountTokenY] = useState('');
  const [distributionStrategy, setDistributionStrategy] = useState('spot'); // spot, curve, bid-ask
  const [selectedStrategy, setSelectedStrategy] = useState(suggestedStrategy || null);
  const [customLowerBound, setCustomLowerBound] = useState('');
  const [customUpperBound, setCustomUpperBound] = useState('');
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
  const [balanceTokenX, setBalanceTokenX] = useState(null);
  const [balanceTokenY, setBalanceTokenY] = useState(null);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Extract token names from pairName (e.g., "SOL - USDC")
  const tokenXName = pairName?.split('-')[0]?.trim() || 'Token X';
  const tokenYName = pairName?.split('-')[1]?.trim() || 'Token Y';

  useEffect(() => {
    if (suggestedStrategy) {
      setSelectedStrategy(suggestedStrategy);
      // Initialize custom bounds with suggested values
      setCustomLowerBound(suggestedStrategy.lowerBound?.toString() || '');
      setCustomUpperBound(suggestedStrategy.upperBound?.toString() || '');
    }
  }, [suggestedStrategy]);

  // Fetch token balances
  const fetchBalances = async () => {
    if (!publicKey || !mintX || !mintY) return;

    setLoadingBalances(true);
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

      // Fetch Token X balance
      const responseX = await fetch(
        `${API_URL}/wallet/token-balance?walletAddress=${publicKey.toString()}&tokenMint=${mintX}`
      );
      const dataX = await responseX.json();
      if (dataX.status === 'success') {
        setBalanceTokenX(dataX.data.balance);
      }

      // Fetch Token Y balance
      const responseY = await fetch(
        `${API_URL}/wallet/token-balance?walletAddress=${publicKey.toString()}&tokenMint=${mintY}`
      );
      const dataY = await responseY.json();
      if (dataY.status === 'success') {
        setBalanceTokenY(dataY.data.balance);
      }
    } catch (err) {
      console.error('Error fetching token balances:', err);
    } finally {
      setLoadingBalances(false);
    }
  };

  useEffect(() => {
    if (open && publicKey && mintX && mintY) {
      fetchBalances();
    }
  }, [open, publicKey, mintX, mintY]);

  const handleAddLiquidity = async () => {
    if (!publicKey || !signTransaction || !signAllTransactions) {
      setError('Please connect your wallet first');
      return;
    }

    // Require at least one token amount
    const hasTokenX = amountTokenX && parseFloat(amountTokenX) > 0;
    const hasTokenY = amountTokenY && parseFloat(amountTokenY) > 0;

    if (!hasTokenX && !hasTokenY) {
      setError('Please enter at least one token amount');
      return;
    }

    if (!selectedStrategy) {
      setError('Please select a liquidity strategy');
      return;
    }

    if (!customLowerBound || !customUpperBound) {
      setError('Please set price range bounds');
      return;
    }

    if (parseFloat(customLowerBound) >= parseFloat(customUpperBound)) {
      setError('Min price must be less than max price');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use custom bounds if set, otherwise use strategy bounds
      const lowerPrice = parseFloat(customLowerBound) || selectedStrategy.lowerBound;
      const upperPrice = parseFloat(customUpperBound) || selectedStrategy.upperBound;

      // Calculate bin IDs from price range using Meteora SDK
      console.log('[Add Liquidity] Calculating bin IDs for range:', { lowerPrice, upperPrice });

      const { lowerBinId, upperBinId, activeBinId } = await calculateBinIds({
        poolAddress,
        lowerPrice,
        upperPrice
      });

      console.log('[Add Liquidity] Bin IDs calculated:', { lowerBinId, upperBinId, activeBinId });

      // Add liquidity using Meteora SDK
      const { signature, positionAddress } = await addLiquidity({
        poolAddress,
        amountX: amountTokenX ? parseFloat(amountTokenX) : 0,
        amountY: amountTokenY ? parseFloat(amountTokenY) : 0,
        lowerBinId,
        upperBinId,
        distributionStrategy, // spot, curve, or bid-ask
        wallet: { signTransaction, signAllTransactions },
        walletPublicKey: publicKey
      });

      console.log('[Add Liquidity] Success:', { signature, positionAddress });

      // Record position in backend database
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

      const positionData = {
        walletAddress: publicKey.toString(),
        poolAddress,
        positionAddress,
        tokenXMint: mintX,
        tokenYMint: mintY,
        tokenXSymbol: tokenXName,
        tokenYSymbol: tokenYName,
        amountX: parseFloat(amountTokenX),
        amountY: parseFloat(amountTokenY),
        liquidityUsd: 0, // Will be calculated by backend based on token amounts
        lowerPrice: lowerPrice,
        upperPrice: upperPrice,
        lowerBinId,
        upperBinId,
        activeBinId,
        strategyName: selectedStrategy.name,
        distributionStrategy, // spot, curve, or bid-ask
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

  const formatBalance = (balance) => {
    if (balance === null) return 'Loading...';
    return balance.toFixed(6);
  };

  const formatPrice = (price) => {
    if (!price || isNaN(price)) return '$0.0000';

    // For very small prices (< 0.00001), use scientific notation or show more decimals
    if (price < 0.00001) {
      // Find the first non-zero digit position
      const priceStr = price.toFixed(20);
      const match = priceStr.match(/0\.0*[1-9]/);
      if (match) {
        const zerosCount = match[0].length - 2; // subtract "0."
        return `$${price.toFixed(zerosCount + 4)}`; // Show 4 significant digits
      }
      return `$${price.toExponential(4)}`;
    }

    // For prices between 0.00001 and 1, use 8 decimals
    if (price < 1) {
      return `$${price.toFixed(8)}`;
    }

    // For prices >= 1, use 4 decimals
    return `$${price.toFixed(4)}`;
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

          {/* Token Amounts Input */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Liquidity Amounts
              </Typography>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={fetchBalances}
                disabled={loadingBalances || !publicKey}
                sx={{ textTransform: 'none' }}
              >
                Refresh Balances
              </Button>
            </Box>

            <Grid container spacing={2}>
              {/* Token X Input */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={`${tokenXName} Amount`}
                  type="number"
                  value={amountTokenX}
                  onChange={(e) => setAmountTokenX(e.target.value)}
                  helperText={
                    publicKey
                      ? `Balance: ${formatBalance(balanceTokenX)} ${tokenXName}`
                      : 'Connect wallet to see balance'
                  }
                  inputProps={{ step: 'any', min: 0 }}
                />
              </Grid>

              {/* Token Y Input */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={`${tokenYName} Amount`}
                  type="number"
                  value={amountTokenY}
                  onChange={(e) => setAmountTokenY(e.target.value)}
                  helperText={
                    publicKey
                      ? `Balance: ${formatBalance(balanceTokenY)} ${tokenYName}`
                      : 'Connect wallet to see balance'
                  }
                  inputProps={{ step: 'any', min: 0 }}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Distribution Strategy Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Distribution Strategy
            </Typography>
            <FormControl component="fieldset">
              <RadioGroup
                row
                value={distributionStrategy}
                onChange={(e) => setDistributionStrategy(e.target.value)}
              >
                <FormControlLabel
                  value="spot"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2">Spot</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Single price point
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="curve"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2">Curve</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Uniform distribution
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="bid-ask"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2">Bid-Ask</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Concentrated edges
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
          </Box>

          {/* Visual Bin Range Selector */}
          {selectedStrategy && liquidityStats?.bins && (
            <Box>
              <BinRangeSelector
                bins={liquidityStats.bins}
                currentPrice={liquidityStats.currentPrice}
                suggestedLowerBound={selectedStrategy.lowerBound}
                suggestedUpperBound={selectedStrategy.upperBound}
                distributionStrategy={distributionStrategy}
                amountTokenX={parseFloat(amountTokenX) || 0}
                amountTokenY={parseFloat(amountTokenY) || 0}
                tokenXName={tokenXName}
                tokenYName={tokenYName}
                onRangeChange={(min, max) => {
                  setCustomLowerBound(min.toString());
                  setCustomUpperBound(max.toString());
                }}
              />
            </Box>
          )}

          {!selectedStrategy && (
            <Alert severity="warning">
              Please select a strategy from the Liquidity Distribution chart above to set your price range
            </Alert>
          )}

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
          disabled={
            loading ||
            !publicKey ||
            (!amountTokenX && !amountTokenY) ||
            !selectedStrategy ||
            !customLowerBound ||
            !customUpperBound
          }
          startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
        >
          {loading ? 'Adding...' : 'Add Liquidity'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddLiquidityModal;
