// Vercel Analytics - Load dynamically
if (typeof window !== 'undefined') {
  (async function() {
    try {
      // Dynamic import for analytics
      const analyticsModule = await import('@vercel/analytics');
      analyticsModule.inject();
    } catch (error) {
      console.warn('Failed to load Vercel Analytics:', error);
    }
  })();
}
