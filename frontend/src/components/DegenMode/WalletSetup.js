import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Button,
  TextField,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  IconButton,
  InputAdornment,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  ContentCopy,
  CheckCircle,
  Warning,
} from '@mui/icons-material';

const WalletSetup = ({ walletAddress, onComplete, onError }) => {
  const [tabValue, setTabValue] = useState(0);
  const [privateKey, setPrivateKey] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedWallet, setGeneratedWallet] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const handleImportWallet = async () => {
    if (!privateKey.trim()) {
      onError('Please enter a private key');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/degen/wallet/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          privateKey: privateKey.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onComplete(data.publicKey);
        onError(''); // Clear any errors
      } else {
        onError(data.message || 'Failed to import wallet');
      }
    } catch (err) {
      onError('Error importing wallet. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWallet = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/degen/wallet/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedWallet({
          publicKey: data.publicKey,
          privateKey: data.privateKey,
        });
        setConfirmDialog(true);
      } else {
        onError(data.message || 'Failed to generate wallet');
      }
    } catch (err) {
      onError('Error generating wallet. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmGenerated = () => {
    setConfirmDialog(false);
    onComplete(generatedWallet.publicKey);
    onError(''); // Clear any errors
  };

  const copyToClipboard = (text, setter) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Step 2: Setup Degen Wallet
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Set up a dedicated wallet for degen mode. You can either import an existing wallet or generate a new one.
        </Typography>

        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            ⚠️ Security Warning
          </Typography>
          <Typography variant="body2">
            This wallet will be used for future automated trading. Only use a wallet with funds you're willing to
            risk. Never import your main wallet!
          </Typography>
        </Alert>

        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Import Wallet" />
          <Tab label="Generate New Wallet" />
        </Tabs>

        {/* Import Tab */}
        {tabValue === 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Enter your private key (base58 format or JSON array). This will be encrypted and stored securely.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Private Key"
              placeholder="Enter your private key..."
              type={showPrivateKey ? 'text' : 'password'}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPrivateKey(!showPrivateKey)} edge="end">
                      {showPrivateKey ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            <Alert severity="info" sx={{ mb: 2 }}>
              Supported formats: Base58 string or JSON array [1,2,3,...]
            </Alert>
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleImportWallet}
              disabled={loading || !privateKey.trim()}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Import Wallet'}
            </Button>
          </Box>
        )}

        {/* Generate Tab */}
        {tabValue === 1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Generate a brand new Solana wallet. You'll need to save the private key and fund the wallet.
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Steps after generation:
              </Typography>
              <Typography variant="body2" component="div">
                1. Save the private key in a secure location
                <br />
                2. Fund the wallet with SOL for trading
                <br />
                3. Never share the private key with anyone
              </Typography>
            </Alert>
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleGenerateWallet}
              disabled={loading}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Generate New Wallet'}
            </Button>
          </Box>
        )}
      </Paper>

      {/* Generated Wallet Dialog */}
      <Dialog open={confirmDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <CheckCircle color="success" />
            <Typography variant="h6">Wallet Generated Successfully</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              ⚠️ SAVE YOUR PRIVATE KEY NOW
            </Typography>
            <Typography variant="body2">
              This is the ONLY time you'll see your private key. Store it in a secure location!
            </Typography>
          </Alert>

          <Box sx={{ mb: 3 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Public Address:
              </Typography>
              <Chip
                label={copiedAddress ? 'Copied!' : 'Copy'}
                size="small"
                icon={copiedAddress ? <CheckCircle /> : <ContentCopy />}
                onClick={() => copyToClipboard(generatedWallet?.publicKey, setCopiedAddress)}
                color={copiedAddress ? 'success' : 'default'}
              />
            </Box>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography
                variant="body2"
                sx={{
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                }}
              >
                {generatedWallet?.publicKey}
              </Typography>
            </Paper>
          </Box>

          <Box>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Private Key (Save this!):
              </Typography>
              <Chip
                label={copiedKey ? 'Copied!' : 'Copy'}
                size="small"
                icon={copiedKey ? <CheckCircle /> : <ContentCopy />}
                onClick={() => copyToClipboard(generatedWallet?.privateKey, setCopiedKey)}
                color={copiedKey ? 'success' : 'default'}
              />
            </Box>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography
                variant="body2"
                sx={{
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                }}
              >
                {generatedWallet?.privateKey}
              </Typography>
            </Paper>
          </Box>

          <Alert severity="warning" sx={{ mt: 3 }}>
            <Typography variant="body2">
              Fund this wallet with SOL before starting monitoring. The wallet will be used for future automated
              trading features.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            variant="contained"
            onClick={handleConfirmGenerated}
            disabled={!copiedKey}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
              },
            }}
          >
            I've Saved My Private Key - Continue
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WalletSetup;
