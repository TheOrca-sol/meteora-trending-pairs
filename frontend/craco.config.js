const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add fallbacks for node modules
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        zlib: require.resolve('browserify-zlib'),
        url: require.resolve('url'),
        buffer: require.resolve('buffer'),
        process: require.resolve('process'),
        vm: require.resolve('vm-browserify'),
        assert: false,
        fs: false,
        path: false,
      };

      // Add plugins
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process',
          Buffer: ['buffer', 'Buffer'],
        })
      );

      // Ignore source map warnings
      webpackConfig.ignoreWarnings = [/Failed to parse source map/];

      return webpackConfig;
    },
  },
};
