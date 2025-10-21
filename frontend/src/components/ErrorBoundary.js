import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom error UI
      return (
        <Paper
          elevation={2}
          sx={{
            p: 4,
            m: 2,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'error.main',
          }}
        >
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}>
            <ErrorOutlineIcon
              sx={{
                fontSize: 60,
                color: 'error.main'
              }}
            />
            <Typography variant="h5" color="error" fontWeight={600}>
              Oops! Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" textAlign="center">
              {this.props.errorMessage || 'An unexpected error occurred while rendering this component.'}
            </Typography>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{
                mt: 2,
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                width: '100%',
                maxHeight: 200,
                overflow: 'auto'
              }}>
                <Typography variant="caption" component="pre" sx={{ color: 'error.main' }}>
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.errorInfo?.componentStack}
                </Typography>
              </Box>
            )}

            <Button
              variant="contained"
              color="primary"
              onClick={this.handleReset}
              sx={{ mt: 2 }}
            >
              Try Again
            </Button>
          </Box>
        </Paper>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  errorMessage: PropTypes.string,
};

ErrorBoundary.defaultProps = {
  errorMessage: 'An unexpected error occurred.',
};

export default ErrorBoundary;
