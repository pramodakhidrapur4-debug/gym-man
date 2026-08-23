export const fetchWithRetry = async (url, options = {}, onRetry = null) => {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    // 15 seconds timeout to allow Render backend cold start
    const timeoutDuration = options.timeout || 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Treat 502 Bad Gateway and 503 Service Unavailable as temporary startup errors
      if (!response.ok && [502, 503, 504].includes(response.status) && attempt <= maxRetries) {
        throw new Error(`Server temporarily unavailable: ${response.status}`);
      }
      
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      
      const isRetriable = err.name === "AbortError" || 
                          err.message.includes("fetch") || 
                          err.message.includes("Network") || 
                          err.message.includes("temporarily unavailable") ||
                          err.message.includes("Failed to fetch");

      if (attempt <= maxRetries && isRetriable) {
        // Exponential backoff: ~1.5s, ~3s, ~5s
        const delay = attempt === 1 ? 1500 : attempt === 2 ? 3000 : 5000;
        if (onRetry) onRetry(attempt, maxRetries);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
};
