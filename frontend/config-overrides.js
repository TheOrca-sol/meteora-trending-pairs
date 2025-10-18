const webpack = require('webpack');

module.exports = function override(config) {
  const fallback = config.resolve.fallback || {};

  Object.assign(fallback, {
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
  });

  config.resolve.fallback = fallback;

  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: 'process',
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(process.env),
    }),
  ]);

  config.ignoreWarnings = [/Failed to parse source map/];
  config.module.parser = {
    javascript: {
      exportsPresence: 'error',
      importExportsPresence: 'error',
    },
  };

  return config;
};
