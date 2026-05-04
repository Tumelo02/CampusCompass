// Vercel Speed Insights - Performance metrics tracking
if (typeof window !== 'undefined') {
  (async function() {
    try {
      const { injectSpeedInsights } = await import('@vercel/speed-insights');
      
      // Inject Speed Insights with optimal configuration
      injectSpeedInsights({
        debug: window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1',
      });
    } catch (error) {
      console.warn('Failed to load Vercel Speed Insights:', error);
    }
  })();
}
