// Vercel Web Analytics initialization
// Dynamically loads and initializes Vercel Analytics
(function() {
  // Detect environment based on hostname
  var isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  var mode = isDev ? 'development' : 'production';
  
  // Use dynamic import to load the analytics module
  var script = document.createElement('script');
  script.type = 'module';
  script.textContent = 
    'import { inject } from "/_vercel/analytics/index.mjs";' +
    'inject({ mode: "' + mode + '" });';
  
  document.head.appendChild(script);
})();
