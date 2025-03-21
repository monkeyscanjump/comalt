const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    APP_ENV: process.env.NODE_ENV,
    POLKADOT_API_URL: process.env.POLKADOT_API_URL || 'https://rpc.polkadot.io',
  },
  swcMinify: true,
  // Enable styled-components for all environments
  compiler: {
    styledComponents: true,
  },
  // Keep your existing transpile packages
  transpilePackages: [
    '@polkadot/api',
    '@polkadot/extension-dapp',
    '@polkadot/util-crypto',
    '@polkadot/util',
    '@subwallet/wallet-connect'
  ],
  // Enhanced webpack config with CSS fixes
  webpack: (config, { isServer, dev }) => {
    // Add fallbacks for node-specific modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        path: require.resolve('path-browserify'),
        fs: false,
        net: false,
        tls: false,
        http: false,
        https: false,
      };
    }

    // Fix CSS processing between development and production
    if (!isServer) {
      // Find the CSS rule
      const cssRule = config.module.rules.find(
        rule => rule.oneOf && Array.isArray(rule.oneOf)
      );

      if (cssRule && cssRule.oneOf) {
        cssRule.oneOf.forEach(rule => {
          // Only target global CSS files (not CSS modules)
          if (rule.test &&
              rule.test.toString().includes('css') &&
              !rule.test.toString().includes('module')) {

            // Ensure CSS is processed with consistent options
            if (Array.isArray(rule.use)) {
              rule.use.forEach(loader => {
                if (loader.loader && loader.loader.includes('css-loader') && loader.options) {
                  // Force consistent CSS processing options
                  loader.options.importLoaders = 1;
                  loader.options.sourceMap = true;

                  // IMPORTANT: Force CSS modules mode to 'global' for globals.css
                  loader.options.modules = false;

                  // Remove any PostCSS validation that might be causing issues
                  if (!dev) {
                    // Make production mode more lenient like development
                    if (loader.options.postcss) {
                      const postcssOptions = loader.options.postcss;
                      if (typeof postcssOptions === 'object' && postcssOptions.plugins) {
                        // Filter out strict validation plugins in production
                        postcssOptions.plugins = postcssOptions.plugins.filter(plugin =>
                          !plugin.postcssPlugin ||
                          !plugin.postcssPlugin.includes('cssnano')
                        );
                      }
                    }
                  }
                }

                // For PostCSS loader, ensure consistent options
                if (loader.loader && loader.loader.includes('postcss-loader') && loader.options) {
                  // Make sure postcss doesn't apply strict validation in production mode
                  if (!dev && loader.options.postcssOptions) {
                    loader.options.postcssOptions.plugins = (plugins = []) => {
                      return plugins.filter(plugin =>
                        typeof plugin !== 'string' ||
                        !plugin.includes('cssnano')
                      );
                    };
                  }
                }
              });
            }
          }
        });
      }
    }

    // Keep your existing aliases
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    config.resolve.alias['@styles'] = path.join(__dirname, 'src/styles');

    // Ignore optional dependencies that cause warnings
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'osx-temperature-sensor': false,
    };

    return config;
  },

  // Specifically disable CSS modules for global files
  experimental: {
    forceSwcTransforms: true,
  },

  // FIXED: Removed invalid postcss top-level option

  // Rest of your config stays the same
  async redirects() {
    return [
      {
        source: '/old-path',
        destination: '/new-path',
        permanent: true,
      },
    ];
  },

  // FIXED: Added proper array return for headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          }
        ],
      },
    ];
  },

  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
  }
};

module.exports = nextConfig;
