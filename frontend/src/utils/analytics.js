import ReactGA from 'react-ga4';

// Initialize GA4 with your measurement ID
export const initGA = () => {
  ReactGA.initialize('G-XXXXXXXXXX'); // Replace with your GA4 measurement ID
};

// Track page views
export const logPageView = () => {
  ReactGA.send({ hitType: 'pageview', page: window.location.pathname });
};

// Track events
export const logEvent = (category, action, label) => {
  ReactGA.event({
    category,
    action,
    label
  });
};

// Track user interactions
export const trackUserInteraction = {
  filterChange: (filterName, value) => {
    logEvent('Filter', 'Change', `${filterName}: ${value}`);
  },
  sortChange: (column, direction) => {
    logEvent('Sort', 'Change', `${column} ${direction}`);
  },
  pairClick: (pairName) => {
    logEvent('Pair', 'Click', pairName);
  },
  refreshData: (isAuto) => {
    logEvent('Refresh', isAuto ? 'Auto' : 'Manual', 'Data Refresh');
  },
  themeChange: (mode) => {
    logEvent('Theme', 'Change', mode);
  }
}; 