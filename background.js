// Default blocked sites
const DEFAULT_BLOCKED_SITES = [
  // Social media
  'youtube.com',
  'instagram.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'reddit.com',
  'snapchat.com',
  'pinterest.com',
  'linkedin.com',

  // Streaming and video
  'netflix.com',
  'hulu.com',
  'disneyplus.com',
  'primevideo.com',
  'hbomax.com',
  'max.com',
  'peacocktv.com',
  'peacock.com',
  'appletv.com',
  'tv.apple.com',
  'crunchyroll.com',
  'funimation.com',
  'vrv.co',
  'twitch.tv',

  // Music and audio
  'spotify.com',
  'soundcloud.com',
  'pandora.com',
  'youtube-music.com'
];

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(['blockedSites', 'isBlocking', 'endTime']);

  if (!result.blockedSites) {
    await chrome.storage.local.set({ blockedSites: DEFAULT_BLOCKED_SITES });
  }

  await updateBlockingRules();
  await scheduleBlockEndAlarm();
});

// Update blocking rules based on current state
async function updateBlockingRules() {
  const { isBlocking, endTime, blockedSites } = await chrome.storage.local.get([
    'isBlocking',
    'endTime',
    'blockedSites'
  ]);

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

  if (shouldBlock && blockedSites && blockedSites.length > 0) {
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

// Keep the alarm in sync with the current session end time
async function scheduleBlockEndAlarm() {
  const { isBlocking, endTime } = await chrome.storage.local.get(['isBlocking', 'endTime']);

  // Clear any previous alarm for safety
  await chrome.alarms.clear('checkBlockEnd');

  // If there is an active session, schedule an alarm exactly at endTime
  if (isBlocking && endTime) {
    chrome.alarms.create('checkBlockEnd', { when: endTime });
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

// Store original URL for a tab when redirecting to blocked page
async function storeOriginalUrl(tabId, originalUrl) {
  try {
    const { blockedTabUrls } = await chrome.storage.local.get(['blockedTabUrls']);
    const urls = blockedTabUrls || {};
    urls[tabId] = originalUrl;
    await chrome.storage.local.set({ blockedTabUrls: urls });
  } catch (e) {
    console.error('Error storing original URL:', e);
  }
}

// Restore tabs to their original URLs
async function restoreBlockedTabs() {
  try {
    const { blockedTabUrls } = await chrome.storage.local.get(['blockedTabUrls']);
    if (!blockedTabUrls) return;

    const blockedUrl = chrome.runtime.getURL('blocked.html');
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      if (tab.url && tab.url.includes('blocked.html')) {
        const originalUrl = blockedTabUrls[tab.id];
        if (originalUrl) {
          try {
            await chrome.tabs.update(tab.id, { url: originalUrl });
            // Remove from storage after restoring
            delete blockedTabUrls[tab.id];
          } catch (e) {
            console.log('Could not restore tab:', tab.url);
          }
        }
      }
    }

    // Update storage with cleaned up URLs
    await chrome.storage.local.set({ blockedTabUrls });
  } catch (e) {
    console.error('Error restoring tabs:', e);
  }
}

// Redirect existing tabs that are on blocked sites
async function redirectExistingTabs() {
  const { isBlocking, endTime, blockedSites } = await chrome.storage.local.get([
    'isBlocking',
    'endTime',
    'blockedSites'
  ]);

  if (!isBlocking || !endTime || !blockedSites) return;

  const now = Date.now();
  if (now >= endTime) return;

  try {
    const tabs = await chrome.tabs.query({});
    const blockedUrl = chrome.runtime.getURL('blocked.html');

    for (const tab of tabs) {
      if (tab.url && isBlockedSite(tab.url, blockedSites)) {
        // Only redirect if it is not already the blocked page
        if (!tab.url.includes('blocked.html')) {
          try {
            // Store original URL before redirecting
            await storeOriginalUrl(tab.id, tab.url);
            await chrome.tabs.update(tab.id, { url: blockedUrl });
          } catch (e) {
            // Ignore errors for pages that cannot be redirected
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

      // If blocking just ended, restore tabs
      if (changes.isBlocking && changes.isBlocking.newValue === false) {
        await restoreBlockedTabs();
      }

      // If blocked sites changed during active session, redirect any newly blocked tabs
      if (changes.blockedSites) {
        const { isBlocking, endTime } = await chrome.storage.local.get([
          'isBlocking',
          'endTime'
        ]);
        if (isBlocking && endTime) {
          const now = Date.now();
          if (now < endTime) {
            setTimeout(() => {
              redirectExistingTabs();
            }, 100);
          }
        }
      }

      // Keep alarm synced with any change to state or end time
      if (changes.isBlocking || changes.endTime) {
        await scheduleBlockEndAlarm();
      }
    }
  }
});

// Check if blocking period has ended
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'checkBlockEnd') {
    const { endTime, isBlocking } = await chrome.storage.local.get([
      'endTime',
      'isBlocking'
    ]);
    const now = Date.now();

    if (isBlocking && endTime && now >= endTime) {
      await chrome.storage.local.set({ isBlocking: false, endTime: null });
      await updateBlockingRules();

      // Restore blocked tabs to their original URLs
      await restoreBlockedTabs();

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

// Listen for tab updates to catch any navigation to blocked sites
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    const { isBlocking, endTime, blockedSites } = await chrome.storage.local.get([
      'isBlocking',
      'endTime',
      'blockedSites'
    ]);

    if (isBlocking && endTime && blockedSites) {
      const now = Date.now();
      if (now < endTime && isBlockedSite(tab.url, blockedSites)) {
        // Redirect to blocked page
        const blockedUrl = chrome.runtime.getURL('blocked.html');
        try {
          // Store original URL before redirecting
          await storeOriginalUrl(tabId, tab.url);
          await chrome.tabs.update(tabId, { url: blockedUrl });
        } catch (e) {
          // Ignore errors for pages that cannot be redirected
          console.log('Could not redirect tab:', tab.url);
        }
      }
    }
  }
});

// Clean up stored URLs when tabs are closed
chrome.tabs.onRemoved.addListener(async tabId => {
  try {
    const { blockedTabUrls } = await chrome.storage.local.get(['blockedTabUrls']);
    if (blockedTabUrls && blockedTabUrls[tabId]) {
      delete blockedTabUrls[tabId];
      await chrome.storage.local.set({ blockedTabUrls });
    }
  } catch (e) {
    console.error('Error cleaning up tab URL:', e);
  }
});

// Offscreen document helper
async function ensureOffscreenDocument() {
  try {
    // Try to create offscreen document
    // If it already exists, this will throw an error which we'll catch
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Audio playback for focus sounds'
    });
  } catch (error) {
    // Document already exists or other error - that's okay
    // We can proceed as if it exists
  }
}

// Message routing: Handle audio commands and route them to offscreen document
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle messages from popup (not from offscreen to avoid loops)
  // Offscreen messages have sender.url containing 'offscreen.html'
  if (sender.url && sender.url.includes('offscreen.html')) {
    // This is a message from offscreen - let it pass through (state updates)
    // Don't forward back to offscreen to avoid loops
    return false;
  }
  
  // Only forward AUDIO_* commands that come from popup
  // Check that sender is popup (not background itself or other contexts)
  const isFromPopup = sender.url && (sender.url.includes('popup.html') || sender.url.includes('popup'));
  
  // Handle AUDIO_* commands from popup - route to offscreen
  if (message.command && message.command.startsWith('AUDIO_') && isFromPopup) {
    ensureOffscreenDocument().then(() => {
      // Forward message to offscreen document and relay response back to popup
      chrome.runtime.sendMessage(message, (response) => {
        if (sendResponse) {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(response);
          }
        }
      });
    }).catch((error) => {
      if (sendResponse) {
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // Keep message channel open for async response
  }
  
  // State updates from offscreen will be received by popup directly
  // No need to forward them here
  
  return false;
});
