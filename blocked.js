function updateTimer() {
  chrome.storage.local.get(['endTime', 'isBlocking'], ({ endTime, isBlocking }) => {
    const timerEl = document.getElementById('timer');
    
    if (!isBlocking || !endTime) {
      timerEl.textContent = 'Focus session ended';
      return;
    }
    
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);
    
    if (remaining === 0) {
      timerEl.textContent = 'Focus session ended';
      return;
    }
    
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    if (hours > 0) {
      timerEl.textContent = `Time remaining: ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      timerEl.textContent = `Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  });
}

updateTimer();
setInterval(updateTimer, 1000);
