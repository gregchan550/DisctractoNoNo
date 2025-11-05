// Default blocked sites
const DEFAULT_BLOCKED_SITES = [
  'youtube.com',
  'instagram.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'reddit.com'
];

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(['blockedSites', 'isBlocking', 'endTime']);
  
  if (!result.blockedSites) {
    await chrome.storage.local.set({ blockedSites: DEFAULT_BLOCKED_SITES });
  }
  
  await updateBlockingRules();
});

// Update blocking rules based on current state
async function updateBlockingRules() {
  const { isBlocking, endTime, blockedSites } = await chrome.storage.local.get(['isBlocking', 'endTime', 'blockedSites']);
  
  // Remove existing rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIds = existingRules.map(rule => rule.id);
  if (ruleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds
    });
  }
  
  // Check if blocking should be active
  const now = Date.now();
  const shouldBlock = isBlocking && endTime && now < endTime;
  
  if (shouldBlock && blockedSites) {
    // Add blocking rules for each site
    const rules = blockedSites.map((site, index) => ({
      id: index + 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: '/blocked.html'
        }
      },
      condition: {
        urlFilter: `*://*.${site}/*`,
        resourceTypes: ['main_frame']
      }
    }));
    
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules
    });
  }
}

// Check if URL matches any blocked site
function isBlockedSite(url, blockedSites) {
  if (!url || !blockedSites) return false;
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    return blockedSites.some(site => hostname.includes(site));
  } catch (e) {
    return false;
  }
}

// Redirect existing tabs that are on blocked sites
async function redirectExistingTabs() {
  const { isBlocking, endTime, blockedSites } = await chrome.storage.local.get(['isBlocking', 'endTime', 'blockedSites']);
  
  if (!isBlocking || !endTime || !blockedSites) return;
  
  const now = Date.now();
  if (now >= endTime) return;
  
  try {
    const tabs = await chrome.tabs.query({});
    const blockedUrl = chrome.runtime.getURL('blocked.html');
    
    for (const tab of tabs) {
      if (tab.url && isBlockedSite(tab.url, blockedSites)) {
        // Only redirect if it's not already the blocked page
        if (!tab.url.includes('blocked.html')) {
          try {
            await chrome.tabs.update(tab.id, { url: blockedUrl });
          } catch (e) {
            // Ignore errors (e.g., chrome:// pages can't be redirected)
            console.log('Could not redirect tab:', tab.url);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error redirecting tabs:', e);
  }
}

// Listen for storage changes
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local') {
    if (changes.isBlocking || changes.endTime || changes.blockedSites) {
      await updateBlockingRules();
      
      // If blocking just started, redirect existing tabs
      if (changes.isBlocking && changes.isBlocking.newValue === true) {
        // Small delay to ensure blocking rules are updated first
        setTimeout(() => {
          redirectExistingTabs();
        }, 100);
      }
    }
  }
});

// Check if blocking period has ended
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkBlockEnd') {
    const { endTime, isBlocking } = await chrome.storage.local.get(['endTime', 'isBlocking']);
    const now = Date.now();
    
    if (isBlocking && endTime && now >= endTime) {
      await chrome.storage.local.set({ isBlocking: false, endTime: null });
      await updateBlockingRules();
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'DistractoNoNo',
        message: 'Your focus time is complete! You can now access blocked sites.'
      });
    }
  }
});

// Periodic check every minute
chrome.alarms.create('checkBlockEnd', { periodInMinutes: 1 });

// Listen for tab updates to catch any navigation to blocked sites
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    const { isBlocking, endTime, blockedSites } = await chrome.storage.local.get(['isBlocking', 'endTime', 'blockedSites']);
    
    if (isBlocking && endTime && blockedSites) {
      const now = Date.now();
      if (now < endTime && isBlockedSite(tab.url, blockedSites)) {
        // Redirect to blocked page
        const blockedUrl = chrome.runtime.getURL('blocked.html');
        try {
          await chrome.tabs.update(tabId, { url: blockedUrl });
        } catch (e) {
          // Ignore errors for pages that can't be redirected
          console.log('Could not redirect tab:', tab.url);
        }
      }
    }
  }
});
