const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  const target = process.env.REACT_APP_API_URL || 'http://backend:5000';
  
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      proxyTimeout: 0
    })
  );
  
  app.use(
    '/projects',
    createProxyMiddleware({
      target,
      changeOrigin: true
    })
  );
};
