// DOM elements
const statusIndicator = document.getElementById('statusIndicator');
const statusTitle = document.getElementById('statusTitle');
const statusTime = document.getElementById('statusTime');
const durationSelect = document.getElementById('duration');
const durationLabel = document.getElementById('durationLabel');
const startBtn = document.getElementById('startBtn');
const sessionActiveMessage = document.getElementById('sessionActiveMessage');
const sitesList = document.getElementById('sitesList');
const newSiteInput = document.getElementById('newSite');
const addSiteBtn = document.getElementById('addSiteBtn');
const presetButtons = document.querySelectorAll('.preset-btn');
const autocompleteList = document.getElementById('autocompleteList');

// Music player DOM elements
const trackSelectorBtn = document.getElementById('trackSelectorBtn');
const trackDropdown = document.getElementById('trackDropdown');
const playPauseBtn = document.getElementById('playPauseBtn');
const playPauseIcon = document.getElementById('playPauseIcon');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const playbackModeBtn = document.getElementById('playbackModeBtn');
const playbackModeIcon = document.getElementById('playbackModeIcon');
const modeTooltip = document.getElementById('modeTooltip');
const volumeBtn = document.getElementById('volumeBtn');
const volumeIcon = document.getElementById('volumeIcon');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const volumePopup = document.getElementById('volumePopup');
const currentTrackName = document.getElementById('currentTrackName');
const currentTime = document.getElementById('currentTime');
const duration = document.getElementById('audioDuration');
const progressBar = document.getElementById('progressBar');

// Music player state (synced from offscreen via messages)
let currentTrack = null;
let isPlaying = false;
let volume = 50;
let playbackMode = 'order'; // 'loop', 'shuffle', 'order'
let audioCurrentTime = 0;
let audioDuration = 0;

// Common sites for autocomplete
const COMMON_SITES = [
  'youtube.com', 'instagram.com', 'facebook.com', 'twitter.com', 'x.com',
  'tiktok.com', 'reddit.com', 'snapchat.com', 'pinterest.com', 'linkedin.com',
  'netflix.com', 'hulu.com', 'disneyplus.com', 'amazon.com', 'ebay.com',
  'twitch.tv', 'discord.com', 'spotify.com', 'soundcloud.com', 'vimeo.com',
  'dailymotion.com', 'bilibili.com', 'medium.com', 'quora.com', 'stackoverflow.com',
  'github.com', 'gitlab.com', 'bitbucket.org', 'trello.com', 'asana.com',
  'slack.com', 'zoom.us', 'teams.microsoft.com', 'outlook.com', 'gmail.com'
];

// Update preset button active states
function updatePresetButtons() {
  const currentValue = parseFloat(durationSelect.value) || 30;
  presetButtons.forEach(btn => {
    const btnMinutes = parseFloat(btn.dataset.minutes);
    // Use a small epsilon for floating point comparison
    if (Math.abs(btnMinutes - currentValue) < 0.001) {
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
    const minutes = parseFloat(btn.dataset.minutes);
    durationSelect.value = minutes;
    updatePresetButtons();
  });
});

// Scroll/wheel support for 1-minute increments
let scrollTimeout;
durationSelect.addEventListener('wheel', (e) => {
  if (durationSelect.disabled) return;
  e.preventDefault();
  const currentValue = parseInt(durationSelect.value) || 30;
  const delta = e.deltaY > 0 ? -1 : 1;
  const newValue = Math.max(1, Math.min(240, currentValue + delta));
  
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
  
  // Load music player state
  await loadMusicPlayerState();
  
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
    startBtn.textContent = 'Add Time to Session';
    startBtn.style.display = 'block';
    sessionActiveMessage.style.display = 'none';
    durationLabel.textContent = 'Add time to session:';
    // Allow time adjustment during session
    durationSelect.disabled = false;
    presetButtons.forEach(btn => btn.disabled = false);
    // Allow adding/removing sites during active session
    newSiteInput.disabled = false;
    addSiteBtn.disabled = false;
    // Re-render sites
    chrome.storage.local.get(['blockedSites'], ({ blockedSites }) => {
      renderSites(blockedSites || []);
    });
  } else {
    statusIndicator.classList.remove('active');
    statusTitle.textContent = 'Ready to focus';
    statusTime.textContent = '';
    startBtn.textContent = 'Start Focus Session';
    startBtn.style.display = 'block';
    sessionActiveMessage.style.display = 'none';
    durationLabel.textContent = 'Block for:';
    durationSelect.disabled = false;
    presetButtons.forEach(btn => btn.disabled = false);
    updatePresetButtons();
    newSiteInput.disabled = false;
    addSiteBtn.disabled = false;
    // Re-render sites
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

// Start focus session or extend current session
startBtn.addEventListener('click', async () => {
  let minutes = parseFloat(durationSelect.value);
  
  // Validate - minimum of 5 minutes
  if (isNaN(minutes) || minutes < 5) {
    minutes = 5;
  } else if (minutes > 240) {
    minutes = 240;
  }
  
  // Update the input value to show the validated value
  durationSelect.value = minutes;
  updatePresetButtons();
  
  const { isBlocking, endTime: currentEndTime } = await chrome.storage.local.get(['isBlocking', 'endTime']);
  
  let newEndTime;
  if (isBlocking && currentEndTime) {
    // Extend current session
    const now = Date.now();
    const remaining = Math.max(0, currentEndTime - now);
    newEndTime = now + remaining + (minutes * 60 * 1000);
  } else {
    // Start new session
    newEndTime = Date.now() + (minutes * 60 * 1000);
  }
  
  await chrome.storage.local.set({
    isBlocking: true,
    endTime: newEndTime
  });
  
  updateUI(true, newEndTime);
  updateTimer();
  setInterval(updateTimer, 1000);
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
  autocompleteList.style.display = 'none';
  selectedAutocompleteIndex = -1;
});

// Autocomplete functionality
let selectedAutocompleteIndex = -1;

function showAutocomplete(input) {
  const value = input.value.toLowerCase().trim();
  if (!value) {
    autocompleteList.innerHTML = '';
    autocompleteList.style.display = 'none';
    selectedAutocompleteIndex = -1;
    return;
  }

  // Filter common sites and existing blocked sites
  chrome.storage.local.get(['blockedSites'], ({ blockedSites }) => {
    const blocked = blockedSites || [];
    const suggestions = COMMON_SITES.filter(site => 
      site.includes(value) && !blocked.includes(site)
    ).slice(0, 5);

    if (suggestions.length === 0) {
      autocompleteList.innerHTML = '';
      autocompleteList.style.display = 'none';
      return;
    }

    autocompleteList.innerHTML = suggestions.map((site, index) => 
      `<div class="autocomplete-item" data-index="${index}" data-site="${site}">${site}</div>`
    ).join('');
    autocompleteList.style.display = 'block';
    selectedAutocompleteIndex = -1;
  });
}

function selectAutocompleteItem(index) {
  const items = autocompleteList.querySelectorAll('.autocomplete-item');
  if (items.length === 0) return;
  
  items.forEach((item, i) => {
    item.classList.toggle('selected', i === index);
  });
  
  if (index >= 0 && index < items.length) {
    selectedAutocompleteIndex = index;
  }
}

function useAutocompleteItem(index) {
  const items = autocompleteList.querySelectorAll('.autocomplete-item');
  if (index >= 0 && index < items.length) {
    const site = items[index].dataset.site;
    newSiteInput.value = site;
    autocompleteList.style.display = 'none';
    selectedAutocompleteIndex = -1;
    addSiteBtn.click();
  }
}

// Autocomplete event listeners
newSiteInput.addEventListener('input', (e) => {
  showAutocomplete(e.target);
});

newSiteInput.addEventListener('keydown', (e) => {
  const items = autocompleteList.querySelectorAll('.autocomplete-item');
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
    selectAutocompleteItem(selectedAutocompleteIndex);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, -1);
    selectAutocompleteItem(selectedAutocompleteIndex);
  } else if (e.key === 'Enter' && selectedAutocompleteIndex >= 0) {
    e.preventDefault();
    useAutocompleteItem(selectedAutocompleteIndex);
  } else if (e.key === 'Escape') {
    autocompleteList.style.display = 'none';
    selectedAutocompleteIndex = -1;
  } else if (e.key === 'Enter' && selectedAutocompleteIndex === -1) {
    // Regular Enter key to add site
    addSiteBtn.click();
  }
});

// Click on autocomplete item
autocompleteList.addEventListener('click', (e) => {
  const item = e.target.closest('.autocomplete-item');
  if (item) {
    const index = parseInt(item.dataset.index);
    useAutocompleteItem(index);
  }
});

// Hide autocomplete when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.autocomplete-wrapper')) {
    autocompleteList.style.display = 'none';
    selectedAutocompleteIndex = -1;
  }
});

// Allow Enter key to add site
newSiteInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && selectedAutocompleteIndex === -1) {
    addSiteBtn.click();
  }
});

// Music player functions
function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTrackNameFromPath(path) {
  if (!path) return 'No track selected';
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  return filename.replace('.mp3', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function updateProgress() {
  // Update UI from current state (synced from offscreen)
  currentTime.textContent = formatTime(audioCurrentTime);
  duration.textContent = formatTime(audioDuration);
  
  if (audioDuration > 0) {
    const percent = (audioCurrentTime / audioDuration) * 100;
    progressBar.value = percent;
  } else {
    progressBar.value = 0;
  }
}

function updatePlayerUI() {
  // Update play/pause button
  if (isPlaying) {
    playPauseIcon.textContent = '⏸';
    playPauseBtn.setAttribute('title', 'Pause');
  } else {
    playPauseIcon.textContent = '▶';
    playPauseBtn.setAttribute('title', 'Play');
  }
  
  // Update current track display
  const trackName = getTrackNameFromPath(currentTrack);
  currentTrackName.textContent = trackName;
  if (isPlaying && currentTrack) {
    currentTrackName.classList.add('playing');
  } else {
    currentTrackName.classList.remove('playing');
  }
  
  // Update selected track in dropdown
  updateSelectedTrackOption();
  
  // Enable/disable play button
  playPauseBtn.disabled = !currentTrack;
}

function setVolume(vol) {
  volume = Math.max(0, Math.min(100, vol));
  volumeSlider.value = volume;
  volumeValue.textContent = `${volume}%`;
  
  // Update volume icon
  if (volume === 0) {
    volumeIcon.textContent = '🔇';
  } else if (volume < 50) {
    volumeIcon.textContent = '🔉';
  } else {
    volumeIcon.textContent = '🔊';
  }
  
  // Send volume change to offscreen
  chrome.runtime.sendMessage({
    command: 'AUDIO_SET_VOLUME',
    volume: volume
  }).catch(() => {});
}

function togglePlaybackMode() {
  // Send command to offscreen - UI will update when state update is received
  chrome.runtime.sendMessage({
    command: 'AUDIO_TOGGLE_PLAYBACK_MODE'
  }).catch(() => {});
}

function updatePlaybackModeUI() {
  if (playbackMode === 'loop') {
    playbackModeIcon.textContent = '🔁';
    modeTooltip.textContent = 'Loop';
    playbackModeBtn.setAttribute('title', 'Loop');
  } else if (playbackMode === 'shuffle') {
    playbackModeIcon.textContent = '🔀';
    modeTooltip.textContent = 'Shuffle';
    playbackModeBtn.setAttribute('title', 'Shuffle');
  } else {
    playbackModeIcon.textContent = '→';
    modeTooltip.textContent = 'In Order';
    playbackModeBtn.setAttribute('title', 'In Order');
  }
}

function getAvailableTracks() {
  const trackOptions = trackDropdown.querySelectorAll('.track-option');
  return Array.from(trackOptions).map(opt => opt.dataset.path);
}

function toggleDropdown() {
  trackDropdown.classList.toggle('show');
  trackSelectorBtn.classList.toggle('active');
}

function closeDropdown() {
  trackDropdown.classList.remove('show');
  trackSelectorBtn.classList.remove('active');
}

function updateSelectedTrackOption() {
  const trackOptions = trackDropdown.querySelectorAll('.track-option');
  trackOptions.forEach(opt => {
    if (opt.dataset.path === currentTrack) {
      opt.classList.add('selected');
    } else {
      opt.classList.remove('selected');
    }
  });
}

function skipToNext() {
  chrome.runtime.sendMessage({
    command: 'AUDIO_NEXT_TRACK'
  }).catch(() => {});
}

function skipToPrevious() {
  chrome.runtime.sendMessage({
    command: 'AUDIO_PREV_TRACK'
  }).catch(() => {});
}

function loadTrack(trackPath) {
  chrome.runtime.sendMessage({
    command: 'AUDIO_LOAD_TRACK',
    trackPath: trackPath
  }).catch(() => {});
}

function playTrack() {
  chrome.runtime.sendMessage({
    command: 'AUDIO_PLAY'
  }).catch(() => {});
}

function pauseTrack() {
  chrome.runtime.sendMessage({
    command: 'AUDIO_PAUSE'
  }).catch(() => {});
}

function togglePlayPause() {
  chrome.runtime.sendMessage({
    command: 'AUDIO_TOGGLE_PLAY_PAUSE'
  }).catch(() => {});
}

async function loadMusicPlayerState() {
  // Request current state from offscreen
  try {
    const response = await chrome.runtime.sendMessage({
      command: 'AUDIO_GET_STATE'
    });
    
    if (response && response.success && response.state) {
      syncUIFromState(response.state);
    } else {
      // Fallback: load from storage if offscreen not ready
      const { musicTrack, musicPlaying, musicVolume, playbackMode: savedMode } = await chrome.storage.local.get([
        'musicTrack',
        'musicPlaying',
        'musicVolume',
        'playbackMode'
      ]);
      
      if (savedMode) {
        playbackMode = savedMode;
      }
      updatePlaybackModeUI();
      
      if (musicVolume !== undefined) {
        volume = musicVolume;
        volumeSlider.value = volume;
        volumeValue.textContent = `${volume}%`;
        updateVolumeIcon();
      } else {
        volume = 50;
        volumeSlider.value = 50;
        volumeValue.textContent = '50%';
        updateVolumeIcon();
      }
      
      if (musicTrack) {
        currentTrack = musicTrack;
      }
      
      updatePlayerUI();
      updateProgress();
    }
  } catch (error) {
    // Offscreen might not be ready yet, use storage fallback
    const { musicTrack, musicVolume, playbackMode: savedMode } = await chrome.storage.local.get([
      'musicTrack',
      'musicVolume',
      'playbackMode'
    ]);
    
    if (savedMode) {
      playbackMode = savedMode;
    }
    updatePlaybackModeUI();
    
    if (musicVolume !== undefined) {
      volume = musicVolume;
      volumeSlider.value = volume;
      volumeValue.textContent = `${volume}%`;
      updateVolumeIcon();
    }
    
    if (musicTrack) {
      currentTrack = musicTrack;
    }
    
    updatePlayerUI();
    updateProgress();
  }
}

function syncUIFromState(state) {
  currentTrack = state.currentTrack || null;
  isPlaying = state.isPlaying || false;
  volume = state.volume || 50;
  playbackMode = state.playbackMode || 'order';
  audioCurrentTime = state.currentTime || 0;
  audioDuration = state.duration || 0;
  
  // Update UI
  volumeSlider.value = volume;
  volumeValue.textContent = `${volume}%`;
  updateVolumeIcon();
  updatePlaybackModeUI();
  updatePlayerUI();
  updateProgress();
  
  // Enable/disable skip buttons
  const tracks = getAvailableTracks();
  prevBtn.disabled = tracks.length <= 1;
  nextBtn.disabled = tracks.length <= 1;
}

function updateVolumeIcon() {
  if (volume === 0) {
    volumeIcon.textContent = '🔇';
  } else if (volume < 50) {
    volumeIcon.textContent = '🔉';
  } else {
    volumeIcon.textContent = '🔊';
  }
}

// Music player event listeners
trackSelectorBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleDropdown();
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.track-selector-wrapper')) {
    closeDropdown();
  }
});

// Handle track option clicks
trackDropdown.addEventListener('click', (e) => {
  const trackOption = e.target.closest('.track-option');
  if (trackOption) {
    const trackPath = trackOption.dataset.path;
    loadTrack(trackPath);
    closeDropdown();
  }
});

playPauseBtn.addEventListener('click', () => {
  togglePlayPause();
});

prevBtn.addEventListener('click', () => {
  skipToPrevious();
});

nextBtn.addEventListener('click', () => {
  skipToNext();
});

playbackModeBtn.addEventListener('click', () => {
  togglePlaybackMode();
});

volumeSlider.addEventListener('input', (e) => {
  setVolume(parseInt(e.target.value));
});

// Progress bar seeking
progressBar.addEventListener('input', (e) => {
  if (audioDuration > 0) {
    const percent = parseFloat(e.target.value);
    const seekPosition = (percent / 100) * audioDuration;
    chrome.runtime.sendMessage({
      command: 'AUDIO_SEEK',
      position: seekPosition
    }).catch(() => {});
  }
});

// Listen for state updates from offscreen
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUDIO_STATE_UPDATE' && message.state) {
    syncUIFromState(message.state);
  }
  return false;
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
