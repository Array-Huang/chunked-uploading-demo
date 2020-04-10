const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/merged_files',
    createProxyMiddleware({
      target: 'http://localhost',
      changeOrigin: true,
    })
  );
};
