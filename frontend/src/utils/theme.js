import { createTheme } from '@mui/material/styles';

const commonComponents = {
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        transition: 'box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms'
      }
    }
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: '1px solid',
        padding: '16px',
        fontSize: '0.875rem'
      },
      head: {
        fontWeight: 600,
        whiteSpace: 'nowrap'
      }
    }
  },
  MuiTableRow: {
    styleOverrides: {
      root: {
        '&:last-child td': {
          borderBottom: 0
        }
      }
    }
  },
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 600
      }
    }
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            '& > fieldset': {
              borderColor: 'currentColor'
            }
          }
        }
      }
    }
  }
};

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      light: '#60a5fa',
      dark: '#1d4ed8'
    },
    secondary: {
      main: '#4f46e5',
      light: '#818cf8',
      dark: '#4338ca'
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff'
    },
    divider: 'rgba(0, 0, 0, 0.08)',
    text: {
      primary: '#1e293b',
      secondary: '#64748b'
    },
    error: {
      main: '#ef4444',
      light: '#fee2e2',
      dark: '#b91c1c'
    },
    success: {
      main: '#22c55e',
      light: '#dcfce7',
      dark: '#15803d'
    },
    warning: {
      main: '#f59e0b',
      light: '#fef3c7',
      dark: '#b45309'
    }
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2rem'
    },
    h2: {
      fontWeight: 700,
      fontSize: '1.75rem'
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.5rem'
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.25rem'
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.125rem'
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem'
    },
    body1: {
      fontSize: '0.9375rem'
    },
    body2: {
      fontSize: '0.875rem'
    },
    caption: {
      fontSize: '0.75rem'
    }
  },
  shape: {
    borderRadius: 8
  },
  components: commonComponents
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#60a5fa',
      light: '#93c5fd',
      dark: '#2563eb'
    },
    secondary: {
      main: '#818cf8',
      light: '#a5b4fc',
      dark: '#4f46e5'
    },
    background: {
      default: '#0f172a',
      paper: '#1e293b'
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8'
    },
    error: {
      main: '#f87171',
      light: '#450a0a',
      dark: '#ef4444'
    },
    success: {
      main: '#4ade80',
      light: '#052e16',
      dark: '#22c55e'
    },
    warning: {
      main: '#fbbf24',
      light: '#451a03',
      dark: '#f59e0b'
    }
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  shape: {
    borderRadius: 8
  },
  components: commonComponents
}); 