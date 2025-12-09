import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  TrendingUp,
  Security,
  Notifications,
  Speed,
  FilterAlt,
  SwapHoriz,
} from '@mui/icons-material';

const LandingPage = () => {
  const theme = useTheme();

  const features = [
    {
      icon: <TrendingUp sx={{ fontSize: 48 }} />,
      title: 'Real-Time Analytics',
      description: 'Monitor 30m fee rates, 24h volume, APR, and TVL across all Meteora DLMM pools with automatic 60-second updates',
    },
    {
      icon: <SwapHoriz sx={{ fontSize: 48 }} />,
      title: 'Aggregated Liquidity',
      description: 'See combined market depth across all pools for the same token pair. No more checking multiple pools manually',
    },
    {
      icon: <Security sx={{ fontSize: 48 }} />,
      title: 'Built-In Security',
      description: 'Integrated RugCheck scans, holder distribution analysis, and authority checks protect you from scams',
    },
    {
      icon: <TrendingUp sx={{ fontSize: 48 }} />,
      title: 'Capital Rotation',
      description: '24/7 monitoring with Telegram alerts when pools match your criteria. Never miss high-APR opportunities again',
    },
    {
      icon: <FilterAlt sx={{ fontSize: 48 }} />,
      title: 'Advanced Filtering',
      description: 'Find exactly what you need with filters for APR, volume, TVL, fees, and more. Save your favorite searches',
    },
    {
      icon: <Notifications sx={{ fontSize: 48 }} />,
      title: 'Telegram Alerts',
      description: 'Get instant notifications on your phone when trending opportunities appear. Configure your own criteria',
    },
  ];

  const stats = [
    { number: '4K+', label: 'Pools Monitored' },
    { number: '5', label: 'Data Sources' },
    { number: '60s', label: 'Refresh Rate' },
    { number: '24/7', label: 'Automated Alerts' },
  ];
  const pricingPlans = [];
  // const pricingPlans = [
  //   {
  //     name: 'Free',
  //     price: '$0',
  //     period: 'Forever free',
  //     features: [
  //       'Browse all 4,000+ pools',
  //       'Real-time analytics dashboard',
  //       'Basic filtering & sorting',
  //       'Security analysis',
  //       'Manual refresh',
  //       'Read-only access',
  //     ],
  //     buttonText: 'Get Started',
  //     buttonVariant: 'outlined',
  //     link: '/dashboard',
  //   },
  //   {
  //     name: 'Premium',
  //     price: '$24.99',
  //     period: 'per month',
  //     popular: true,
  //     features: [
  //       'Everything in Free',
  //       'Auto-refresh (60s intervals)',
  //       'Telegram alerts & notifications',
  //       'Capital rotation monitoring',
  //       'Aggregated liquidity views',
  //       'Advanced filters & saved searches',
  //       'Degen Mode (1-60min monitoring)',
  //       'Priority support',
  //     ],
  //     buttonText: 'Start 14-Day Trial',
  //     buttonVariant: 'contained',
  //     link: '/dashboard',
  //   },
  //   {
  //     name: 'White Label',
  //     price: 'Custom',
  //     period: 'Contact us',
  //     features: [
  //       'Everything in Premium',
  //       'Custom branding & domain',
  //       'API access',
  //       'Dedicated infrastructure',
  //       'Custom integrations',
  //       'Multi-user accounts',
  //       'SLA guarantees',
  //       'Dedicated support team',
  //     ],
  //     buttonText: 'Contact Sales',
  //     buttonVariant: 'outlined',
  //     link: 'mailto:contact@meteora-trending-pairs.com',
  //   },
  // ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 50%, ${theme.palette.secondary.main} 100%)`,
          color: 'white',
          py: { xs: 8, md: 12 },
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            width: 500,
            height: 500,
            background: alpha(theme.palette.common.white, 0.1),
            borderRadius: '50%',
            top: -250,
            right: -100,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            width: 400,
            height: 400,
            background: alpha(theme.palette.common.white, 0.1),
            borderRadius: '50%',
            bottom: -200,
            left: -100,
          },
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box textAlign="center" mb={6}>
            <Chip
              label="✨ REVOLUTIONARY PLATFORM ✨"
              sx={{
                bgcolor: theme.palette.warning.main,
                color: theme.palette.text.primary,
                fontWeight: 'bold',
                mb: 3,
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
              }}
            />
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2rem', sm: '3rem', md: '3.5rem' },
                fontWeight: 800,
                mb: 2,
              }}
            >
              Find Alpha in Meteora's 4,000+ verified DLMM Pools
            </Typography>
            <Typography
              variant="h5"
              sx={{
                mb: 4,
                opacity: 0.95,
                fontSize: { xs: '1rem', sm: '1.25rem' },
              }}
            >
              Real-time analytics, security checks, and automated alerts for Solana's most dynamic liquidity market
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                component={RouterLink}
                to="/dashboard"
                variant="contained"
                size="large"
                sx={{
                  bgcolor: 'white',
                  color: theme.palette.primary.main,
                  px: 4,
                  py: 1.5,
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.common.white, 0.9),
                    transform: 'translateY(-3px)',
                    boxShadow: `0 6px 30px ${alpha(theme.palette.common.white, 0.4)}`,
                  },
                  transition: 'all 0.3s',
                }}
              >
                Start Free Today
              </Button>
              <Button
                href="#features"
                variant="outlined"
                size="large"
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  px: 4,
                  py: 1.5,
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: 'white',
                    color: theme.palette.primary.main,
                    borderColor: 'white',
                  },
                }}
              >
                Learn More
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Stats Section */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          py: 4,
          boxShadow: `0 -5px 30px ${alpha(theme.palette.common.black, 0.05)}`,
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            {stats.map((stat, index) => (
              <Grid item xs={6} md={3} key={index}>
                <Box textAlign="center">
                  <Typography
                    variant="h2"
                    sx={{
                      fontSize: { xs: '2rem', md: '3rem' },
                      fontWeight: 'bold',
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {stat.number}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box id="features" sx={{ py: { xs: 6, md: 10 }, bgcolor: 'background.default' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2rem', md: '2.5rem' },
                fontWeight: 800,
                mb: 2,
              }}
            >
              Everything You Need to Trade Smarter
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
              Powerful analytics and automation tools designed for liquidity providers
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {features.map((feature, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    transition: 'all 0.3s',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: 4,
                      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    },
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: `0 8px 30px ${alpha(theme.palette.primary.main, 0.15)}`,
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        color: theme.palette.primary.main,
                        mb: 2,
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Typography variant="h5" gutterBottom fontWeight={700}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Pricing Section */}
      <Box id="pricing" sx={{ py: { xs: 6, md: 10 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2rem', md: '2.5rem' },
                fontWeight: 800,
                mb: 2,
              }}
            >
              Simple, Transparent Pricing (To be determined)
            </Typography>
            
          </Box>

          <Grid container spacing={3} alignItems="stretch">
            {pricingPlans.map((plan, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    border: plan.popular ? `2px solid ${theme.palette.primary.main}` : `2px solid ${theme.palette.divider}`,
                    background: plan.popular
                      ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`
                      : 'background.paper',
                    color: plan.popular ? 'white' : 'text.primary',
                    position: 'relative',
                    transition: 'all 0.3s',
                    transform: plan.popular ? 'scale(1.05)' : 'scale(1)',
                    '&:hover': {
                      transform: plan.popular ? 'scale(1.08) translateY(-10px)' : 'translateY(-10px)',
                      boxShadow: 6,
                    },
                  }}
                >
                  {plan.popular && (
                    <Chip
                      label="⭐ MOST POPULAR"
                      sx={{
                        position: 'absolute',
                        top: -15,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        bgcolor: theme.palette.warning.main,
                        color: theme.palette.text.primary,
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                      }}
                    />
                  )}
                  <CardContent sx={{ flexGrow: 1, p: 4, textAlign: 'center' }}>
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                      {plan.name}
                    </Typography>
                    <Typography variant="h2" fontWeight={800} sx={{ my: 2 }}>
                      {plan.price}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 3, opacity: 0.8 }}>
                      {plan.period}
                    </Typography>
                    <Box sx={{ textAlign: 'left', mb: 3 }}>
                      {plan.features.map((feature, idx) => (
                        <Typography
                          key={idx}
                          variant="body2"
                          sx={{
                            py: 1,
                            borderBottom: `1px solid ${alpha(plan.popular ? theme.palette.common.white : theme.palette.common.black, 0.1)}`,
                            '&::before': {
                              content: '"✓"',
                              color: plan.popular ? theme.palette.warning.main : theme.palette.primary.main,
                              fontWeight: 'bold',
                              mr: 1,
                            },
                          }}
                        >
                          {feature}
                        </Typography>
                      ))}
                    </Box>
                    <Button
                      component={plan.link.startsWith('mailto') ? 'a' : RouterLink}
                      href={plan.link.startsWith('mailto') ? plan.link : undefined}
                      to={plan.link.startsWith('mailto') ? undefined : plan.link}
                      variant={plan.buttonVariant}
                      fullWidth
                      size="large"
                      sx={{
                        py: 1.5,
                        fontWeight: 'bold',
                        ...(plan.popular
                          ? {
                              bgcolor: 'white',
                              color: theme.palette.primary.main,
                              '&:hover': {
                                bgcolor: theme.palette.warning.main,
                                color: theme.palette.text.primary,
                              },
                            }
                          : {
                              borderColor: theme.palette.primary.main,
                              color: theme.palette.primary.main,
                              '&:hover': {
                                bgcolor: theme.palette.primary.main,
                                color: 'white',
                              },
                            }),
                      }}
                    >
                      {plan.buttonText}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          color: 'white',
          py: { xs: 6, md: 8 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '2rem', md: '2.5rem' },
              fontWeight: 800,
              mb: 2,
            }}
          >
            Ready to Find Your Next 100x?
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.95 }}>
            Join LPs using real-time data to discover alpha in Meteora DLMM pools
          </Typography>
          <Button
            component={RouterLink}
            to="/dashboard"
            variant="contained"
            size="large"
            sx={{
              bgcolor: 'white',
              color: theme.palette.primary.main,
              px: 5,
              py: 2,
              fontSize: '1.125rem',
              fontWeight: 'bold',
              '&:hover': {
                bgcolor: alpha(theme.palette.common.white, 0.9),
                transform: 'translateY(-3px)',
                boxShadow: `0 6px 30px ${alpha(theme.palette.common.white, 0.4)}`,
              },
              transition: 'all 0.3s',
            }}
          >
            Start Free Today - No Credit Card Required
          </Button>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;
