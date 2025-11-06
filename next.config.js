/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Exclude native bindings from client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
      
      // Ignore native modules in client bundle
      config.externals = config.externals || [];
      config.externals.push({
        'onnxruntime-node': 'commonjs onnxruntime-node',
        '@xenova/transformers': 'commonjs @xenova/transformers',
      });
    }
    
    // Ignore .node files in webpack
    config.module.rules.push({
      test: /\.node$/,
      use: 'null-loader',
    });
    
    return config;
  },
}

module.exports = nextConfig

