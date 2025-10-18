import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Stack,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { PublicKey } from '@solana/web3.js';

function WhitelistManager({ whitelist, setWhitelist }) {
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');

  // Save whitelist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('tokenWhitelist', JSON.stringify(whitelist));
  }, [whitelist]);

  const handleAddToken = () => {
    try {
      // Validate Solana address
      const pubkey = new PublicKey(tokenInput);
      const address = pubkey.toBase58();

      // Check if already in whitelist
      if (whitelist.includes(address)) {
        setTokenError('Token already in whitelist');
        return;
      }

      setWhitelist([...whitelist, address]);
      setTokenInput('');
      setTokenError('');
    } catch (error) {
      setTokenError('Invalid Solana token address');
    }
  };

  const handleRemoveToken = (address) => {
    setWhitelist(whitelist.filter(token => token !== address));
  };

  const handleClearWhitelist = () => {
    setWhitelist([]);
  };

  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Token Whitelist
        </Typography>
        {whitelist.length > 0 && (
          <Button
            size="small"
            onClick={handleClearWhitelist}
            color="error"
            variant="text"
          >
            Clear All
          </Button>
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" gutterBottom>
        Add token addresses you want to track for rotation opportunities
      </Typography>

      {/* Add Token Input */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2, mb: 3 }}>
        <TextField
          fullWidth
          label="Token Mint Address"
          value={tokenInput}
          onChange={(e) => {
            setTokenInput(e.target.value);
            setTokenError('');
          }}
          error={Boolean(tokenError)}
          helperText={tokenError}
          placeholder="Enter token mint address"
          size="small"
          onKeyPress={(e) => {
            if (e.key === 'Enter' && tokenInput) {
              handleAddToken();
            }
          }}
        />
        <Button
          variant="contained"
          onClick={handleAddToken}
          disabled={!tokenInput}
          startIcon={<AddIcon />}
          sx={{ minWidth: 100 }}
        >
          Add
        </Button>
      </Box>

      {/* Whitelist Display */}
      {whitelist.length === 0 ? (
        <Alert severity="info">
          No tokens in whitelist. Add tokens to discover rotation opportunities.
        </Alert>
      ) : (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Whitelisted Tokens ({whitelist.length}):
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {whitelist.map((address, index) => (
              <Chip
                key={index}
                label={
                  <Tooltip title={address}>
                    <span>{truncateAddress(address)}</span>
                  </Tooltip>
                }
                onDelete={() => handleRemoveToken(address)}
                deleteIcon={<DeleteIcon />}
                color="primary"
                variant="outlined"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.85rem'
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Helper Text */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="caption">
          <strong>Tip:</strong> Add token addresses for assets you're interested in. The system will find the best Meteora pools for these tokens based on your quote token preferences.
        </Typography>
      </Alert>
    </Box>
  );
}

export default WhitelistManager;
