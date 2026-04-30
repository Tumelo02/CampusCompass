// Vercel Speed Insights - Performance metrics tracking
if (typeof window !== 'undefined') {
  (async function() {
    try {
      const { injectSpeedInsights } = await import('@vercel/speed-insights');
      injectSpeedInsights();
    } catch (error) {
      console.warn('Failed to load Vercel Speed Insights:', error);
    }
  })();
}
