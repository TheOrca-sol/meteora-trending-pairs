import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  Chip,
  Stack
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

function PreferencesPanel({ quotePreferences, setQuotePreferences }) {
  // Save preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('quotePreferences', JSON.stringify(quotePreferences));
  }, [quotePreferences]);

  const handleToggleSol = (event) => {
    // Ensure at least one is selected
    if (!event.target.checked && !quotePreferences.usdc) {
      return;
    }
    setQuotePreferences({
      ...quotePreferences,
      sol: event.target.checked
    });
  };

  const handleToggleUsdc = (event) => {
    // Ensure at least one is selected
    if (!event.target.checked && !quotePreferences.sol) {
      return;
    }
    setQuotePreferences({
      ...quotePreferences,
      usdc: event.target.checked
    });
  };

  const activePreferences = [];
  if (quotePreferences.sol) activePreferences.push('SOL');
  if (quotePreferences.usdc) activePreferences.push('USDC');

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
        Quote Token Preferences
      </Typography>

      <Typography variant="body2" color="text.secondary" gutterBottom>
        Select which quote tokens you prefer for pool opportunities
      </Typography>

      <FormGroup sx={{ mt: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={quotePreferences.sol}
              onChange={handleToggleSol}
              color="primary"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography>SOL Pairs</Typography>
              {quotePreferences.sol && (
                <CheckCircleIcon fontSize="small" color="success" />
              )}
            </Box>
          }
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={quotePreferences.usdc}
              onChange={handleToggleUsdc}
              color="primary"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography>USDC Pairs</Typography>
              {quotePreferences.usdc && (
                <CheckCircleIcon fontSize="small" color="success" />
              )}
            </Box>
          }
        />
      </FormGroup>

      {/* Active Preferences Display */}
      <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Active Preferences:
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          {activePreferences.map((pref) => (
            <Chip
              key={pref}
              label={pref}
              color="primary"
              size="small"
              icon={<CheckCircleIcon />}
            />
          ))}
        </Stack>
      </Box>

      {/* Helper Text */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="caption">
          <strong>How it works:</strong> The system will search for the best pools that use your selected quote tokens. Selecting both SOL and USDC will give you more opportunities.
        </Typography>
      </Alert>

      {/* Warning if only one selected */}
      {(quotePreferences.sol && !quotePreferences.usdc) ||  (!quotePreferences.sol && quotePreferences.usdc) ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="caption">
            You've selected only one quote token. Consider enabling both SOL and USDC for more opportunities.
          </Typography>
        </Alert>
      ) : null}
    </Box>
  );
}

export default PreferencesPanel;
