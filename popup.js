// DOM elements
const statusIndicator = document.getElementById('statusIndicator');
const statusTitle = document.getElementById('statusTitle');
const statusTime = document.getElementById('statusTime');
const durationSelect = document.getElementById('duration');
const startBtn = document.getElementById('startBtn');
const sessionActiveMessage = document.getElementById('sessionActiveMessage');
const sitesList = document.getElementById('sitesList');
const newSiteInput = document.getElementById('newSite');
const addSiteBtn = document.getElementById('addSiteBtn');
const presetButtons = document.querySelectorAll('.preset-btn');

// Update preset button active states
function updatePresetButtons() {
  const currentValue = parseInt(durationSelect.value) || 30;
  presetButtons.forEach(btn => {
    const btnMinutes = parseInt(btn.dataset.minutes);
    if (btnMinutes === currentValue) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Preset button click handlers
presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (durationSelect.disabled) return; // Don't allow changes during active session
    const minutes = parseInt(btn.dataset.minutes);
    durationSelect.value = minutes;
    updatePresetButtons();
  });
});

// Scroll/wheel support for 5-minute increments
let scrollTimeout;
durationSelect.addEventListener('wheel', (e) => {
  if (durationSelect.disabled) return;
  e.preventDefault();
  const currentValue = parseInt(durationSelect.value) || 30;
  const delta = e.deltaY > 0 ? -5 : 5;
  const newValue = Math.max(5, Math.min(480, currentValue + delta));
  
  // Add visual feedback
  durationSelect.classList.add('scrolling');
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    durationSelect.classList.remove('scrolling');
  }, 150);
  
  durationSelect.value = newValue;
  updatePresetButtons();
});

// Update preset buttons when input changes
durationSelect.addEventListener('input', updatePresetButtons);

// Load initial state
async function loadState() {
  const { isBlocking, endTime, blockedSites } = await chrome.storage.local.get(['isBlocking', 'endTime', 'blockedSites']);
  
  updateUI(isBlocking, endTime);
  renderSites(blockedSites || []);
  updatePresetButtons();
  
  // Update timer every second if blocking is active
  if (isBlocking && endTime) {
    updateTimer();
    setInterval(updateTimer, 1000);
  }
}

function updateUI(isBlocking, endTime) {
  if (isBlocking && endTime) {
    statusIndicator.classList.add('active');
    statusTitle.textContent = 'Focus session active';
    startBtn.style.display = 'none';
    sessionActiveMessage.style.display = 'block';
    durationSelect.disabled = true;
    // Disable preset buttons during active session
    presetButtons.forEach(btn => btn.disabled = true);
    // Disable adding/removing sites during active session
    newSiteInput.disabled = true;
    addSiteBtn.disabled = true;
    // Re-render sites to apply disabled state
    chrome.storage.local.get(['blockedSites'], ({ blockedSites }) => {
      renderSites(blockedSites || []);
    });
  } else {
    statusIndicator.classList.remove('active');
    statusTitle.textContent = 'Ready to focus';
    statusTime.textContent = '';
    startBtn.style.display = 'block';
    sessionActiveMessage.style.display = 'none';
    durationSelect.disabled = false;
    // Re-enable preset buttons
    presetButtons.forEach(btn => btn.disabled = false);
    updatePresetButtons();
    // Re-enable adding/removing sites
    newSiteInput.disabled = false;
    addSiteBtn.disabled = false;
    // Re-render sites to remove disabled state
    chrome.storage.local.get(['blockedSites'], ({ blockedSites }) => {
      renderSites(blockedSites || []);
    });
  }
}

function updateTimer() {
  chrome.storage.local.get(['endTime', 'isBlocking'], ({ endTime, isBlocking }) => {
    if (!isBlocking || !endTime) {
      updateUI(false, null);
      return;
    }
    
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);
    
    if (remaining === 0) {
      updateUI(false, null);
      return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    statusTime.textContent = `Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
  });
}

async function renderSites(sites) {
  if (sites.length === 0) {
    sitesList.innerHTML = '<div class="empty-message">No sites blocked</div>';
    return;
  }
  
  // Check if blocking is active
  const { isBlocking } = await chrome.storage.local.get(['isBlocking']);
  const disabled = isBlocking ? 'disabled' : '';
  
  sitesList.innerHTML = sites.map(site => `
    <div class="site-item">
      <span>${site}</span>
      <button data-site="${site}" class="remove-site" ${disabled}>Remove</button>
    </div>
  `).join('');
  
  // Add event listeners to remove buttons
  sitesList.querySelectorAll('.remove-site').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      // Prevent removal during active session
      const { isBlocking } = await chrome.storage.local.get(['isBlocking']);
      if (isBlocking) {
        return;
      }
      
      const siteToRemove = e.target.dataset.site;
      const { blockedSites } = await chrome.storage.local.get(['blockedSites']);
      const updated = blockedSites.filter(s => s !== siteToRemove);
      await chrome.storage.local.set({ blockedSites: updated });
      renderSites(updated);
    });
  });
}

// Start focus session
startBtn.addEventListener('click', async () => {
  let minutes = parseInt(durationSelect.value);
  
  // Validate and round to nearest 5 minutes
  if (isNaN(minutes) || minutes < 5) {
    minutes = 5;
  } else if (minutes > 480) {
    minutes = 480;
  } else {
    // Round to nearest 5-minute increment
    minutes = Math.round(minutes / 5) * 5;
  }
  
  // Update the input value to show the rounded value
  durationSelect.value = minutes;
  updatePresetButtons();
  
  const endTime = Date.now() + (minutes * 60 * 1000);
  
  await chrome.storage.local.set({
    isBlocking: true,
    endTime: endTime
  });
  
  updateUI(true, endTime);
  updateTimer();
  setInterval(updateTimer, 1000);
});

// Add new site
addSiteBtn.addEventListener('click', async () => {
  // Prevent adding during active session
  const { isBlocking } = await chrome.storage.local.get(['isBlocking']);
  if (isBlocking) {
    return;
  }
  
  const site = newSiteInput.value.trim().toLowerCase();
  
  if (!site) {
    return;
  }
  
  // Remove protocol and www if present
  const cleanSite = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  
  if (!cleanSite) {
    return;
  }
  
  const { blockedSites } = await chrome.storage.local.get(['blockedSites']);
  const updated = [...new Set([...blockedSites, cleanSite])];
  await chrome.storage.local.set({ blockedSites: updated });
  
  renderSites(updated);
  newSiteInput.value = '';
});

// Allow Enter key to add site
newSiteInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addSiteBtn.click();
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.blockedSites) {
      renderSites(changes.blockedSites.newValue);
    }
    if (changes.isBlocking || changes.endTime) {
      loadState();
    }
  }
});

// Initialize
loadState();
