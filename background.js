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

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.isBlocking || changes.endTime || changes.blockedSites) {
      updateBlockingRules();
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
