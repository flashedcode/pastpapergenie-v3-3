// Vercel Web Analytics initialization
// This file injects Vercel Web Analytics tracking into the application
(function() {
  // Check if analytics is already loaded
  if (window.vai) return;
  
  // Initialize the queue
  window.va = window.va || function () { 
    (window.vaq = window.vaq || []).push(arguments); 
  };
  
  // Mark as initialized
  window.vai = true;
  
  // Set mode based on environment
  // In production (on Vercel), this will send events to the server
  // In development, this will log events to console if debug is enabled
  window.vam = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') 
    ? 'development' 
    : 'production';
  
  // Load the analytics script
  var script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  
  // Append to document head
  var firstScript = document.getElementsByTagName('script')[0];
  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }
})();
