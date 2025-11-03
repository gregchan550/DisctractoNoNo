// DOM elements
const statusIndicator = document.getElementById('statusIndicator');
const statusTitle = document.getElementById('statusTitle');
const statusTime = document.getElementById('statusTime');
const durationSelect = document.getElementById('duration');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const sitesList = document.getElementById('sitesList');
const newSiteInput = document.getElementById('newSite');
const addSiteBtn = document.getElementById('addSiteBtn');

// Load initial state
async function loadState() {
  const { isBlocking, endTime, blockedSites } = await chrome.storage.local.get(['isBlocking', 'endTime', 'blockedSites']);
  
  updateUI(isBlocking, endTime);
  renderSites(blockedSites || []);
  
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
    stopBtn.style.display = 'block';
    durationSelect.disabled = true;
  } else {
    statusIndicator.classList.remove('active');
    statusTitle.textContent = 'Ready to focus';
    statusTime.textContent = '';
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    durationSelect.disabled = false;
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

function renderSites(sites) {
  if (sites.length === 0) {
    sitesList.innerHTML = '<div class="empty-message">No sites blocked</div>';
    return;
  }
  
  sitesList.innerHTML = sites.map(site => `
    <div class="site-item">
      <span>${site}</span>
      <button data-site="${site}" class="remove-site">Remove</button>
    </div>
  `).join('');
  
  // Add event listeners to remove buttons
  sitesList.querySelectorAll('.remove-site').forEach(btn => {
    btn.addEventListener('click', async (e) => {
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
  const minutes = parseInt(durationSelect.value);
  const endTime = Date.now() + (minutes * 60 * 1000);
  
  await chrome.storage.local.set({
    isBlocking: true,
    endTime: endTime
  });
  
  updateUI(true, endTime);
  updateTimer();
  setInterval(updateTimer, 1000);
});

// Stop focus session
stopBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    isBlocking: false,
    endTime: null
  });
  
  updateUI(false, null);
});

// Add new site
addSiteBtn.addEventListener('click', async () => {
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
