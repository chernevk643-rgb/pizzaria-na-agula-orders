// Timer thread for the orders dashboard: workers are not throttled/frozen like page timers.
setInterval(() => postMessage(1), 4000);
