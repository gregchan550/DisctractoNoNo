// Audio player state
let audioPlayer = null;
let currentTrack = null;
let isPlaying = false;
let volume = 50;
let playbackMode = 'order'; // 'loop', 'shuffle', 'order'
let progressUpdateInterval = null;

// Available tracks list (must match popup.html)
const AVAILABLE_TRACKS = [
  'sounds/ambient/museum-cafe.mp3',
  'sounds/nature/calm-sea.mp3',
  'sounds/focus/triple-binaurial.ogg'
];

// Helper function to send state updates
function sendStateUpdate() {
  const state = {
    type: 'AUDIO_STATE_UPDATE',
    state: {
      currentTrack,
      isPlaying,
      volume,
      playbackMode,
      currentTime: audioPlayer ? audioPlayer.currentTime : 0,
      duration: audioPlayer ? audioPlayer.duration : 0
    }
  };
  
  // Send to background, which will forward to popup
  chrome.runtime.sendMessage(state).catch(() => {
    // Popup might not be open, that's okay
  });
  
  // Also write to storage
  chrome.storage.local.set({
    musicTrack: currentTrack,
    musicPlaying: isPlaying,
    musicVolume: volume,
    playbackMode: playbackMode
  });
}

function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateProgress() {
  sendStateUpdate();
}

function startProgressTracking() {
  if (progressUpdateInterval) {
    clearInterval(progressUpdateInterval);
  }
  progressUpdateInterval = setInterval(updateProgress, 100);
}

function stopProgressTracking() {
  if (progressUpdateInterval) {
    clearInterval(progressUpdateInterval);
    progressUpdateInterval = null;
  }
}

function setVolume(vol) {
  volume = Math.max(0, Math.min(100, vol));
  
  if (audioPlayer) {
    audioPlayer.volume = volume / 100;
  }
  
  sendStateUpdate();
}

function togglePlaybackMode() {
  const modes = ['order', 'loop', 'shuffle'];
  const currentIndex = modes.indexOf(playbackMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  playbackMode = modes[nextIndex];
  
  // Update audio player loop based on mode
  if (audioPlayer) {
    audioPlayer.loop = playbackMode === 'loop';
  }
  
  sendStateUpdate();
}

function getCurrentTrackIndex() {
  return AVAILABLE_TRACKS.indexOf(currentTrack);
}

function skipToNext() {
  if (AVAILABLE_TRACKS.length === 0) return;
  
  if (playbackMode === 'shuffle') {
    // Random track
    const randomIndex = Math.floor(Math.random() * AVAILABLE_TRACKS.length);
    loadTrack(AVAILABLE_TRACKS[randomIndex]);
  } else {
    // Next track in order
    const currentIndex = getCurrentTrackIndex();
    const nextIndex = (currentIndex + 1) % AVAILABLE_TRACKS.length;
    loadTrack(AVAILABLE_TRACKS[nextIndex]);
  }
}

function skipToPrevious() {
  if (AVAILABLE_TRACKS.length === 0) return;
  
  if (playbackMode === 'shuffle') {
    // Random track
    const randomIndex = Math.floor(Math.random() * AVAILABLE_TRACKS.length);
    loadTrack(AVAILABLE_TRACKS[randomIndex]);
  } else {
    // Previous track in order
    const currentIndex = getCurrentTrackIndex();
    const prevIndex = (currentIndex - 1 + AVAILABLE_TRACKS.length) % AVAILABLE_TRACKS.length;
    loadTrack(AVAILABLE_TRACKS[prevIndex]);
  }
}

function loadTrack(trackPath) {
  if (!trackPath) {
    // Stop current track
    stopProgressTracking();
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer = null;
    }
    currentTrack = null;
    isPlaying = false;
    sendStateUpdate();
    return;
  }
  
  const wasPlaying = isPlaying;
  
  // Stop current track if playing
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer = null;
  }
  
  // Load new track
  currentTrack = trackPath;
  const trackUrl = chrome.runtime.getURL(trackPath);
  audioPlayer = new Audio(trackUrl);
  audioPlayer.loop = playbackMode === 'loop';
  audioPlayer.volume = volume / 100;
  
  // Handle errors
  audioPlayer.addEventListener('error', (e) => {
    console.error('Error loading audio:', e);
    isPlaying = false;
    stopProgressTracking();
    sendStateUpdate();
  });
  
  // Update duration when metadata loads
  audioPlayer.addEventListener('loadedmetadata', () => {
    sendStateUpdate();
  });
  
  // Handle track end
  audioPlayer.addEventListener('ended', () => {
    if (playbackMode !== 'loop') {
      isPlaying = false;
      stopProgressTracking();
      sendStateUpdate();
      
      // Auto-play next track if not in loop mode
      if (playbackMode === 'shuffle' || playbackMode === 'order') {
        skipToNext();
        if (audioPlayer) {
          playTrack();
        }
      }
    }
  });
  
  // Update progress when time updates
  audioPlayer.addEventListener('timeupdate', () => {
    sendStateUpdate();
  });
  
  sendStateUpdate();
  
  // If was playing, start new track
  if (wasPlaying) {
    playTrack();
  }
}

function playTrack() {
  if (!audioPlayer || !currentTrack) return;
  
  audioPlayer.play().then(() => {
    isPlaying = true;
    startProgressTracking();
    sendStateUpdate();
  }).catch((error) => {
    console.error('Error playing audio:', error);
    isPlaying = false;
    stopProgressTracking();
    sendStateUpdate();
  });
}

function pauseTrack() {
  if (!audioPlayer) return;
  
  audioPlayer.pause();
  isPlaying = false;
  stopProgressTracking();
  sendStateUpdate();
}

function togglePlayPause() {
  if (isPlaying) {
    pauseTrack();
  } else {
    playTrack();
  }
}

function seekTo(position) {
  if (audioPlayer && audioPlayer.duration) {
    audioPlayer.currentTime = position;
    sendStateUpdate();
  }
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.command) {
    case 'AUDIO_PLAY':
      playTrack();
      sendResponse({ success: true });
      break;
      
    case 'AUDIO_PAUSE':
      pauseTrack();
      sendResponse({ success: true });
      break;
      
    case 'AUDIO_TOGGLE_PLAY_PAUSE':
      togglePlayPause();
      sendResponse({ success: true });
      break;
      
    case 'AUDIO_LOAD_TRACK':
      loadTrack(message.trackPath);
      sendResponse({ success: true });
      break;
      
    case 'AUDIO_NEXT_TRACK':
      skipToNext();
      sendResponse({ success: true });
      break;
      
    case 'AUDIO_PREV_TRACK':
      skipToPrevious();
      sendResponse({ success: true });
      break;
      
    case 'AUDIO_SET_VOLUME':
      setVolume(message.volume);
      sendResponse({ success: true });
      break;
      
    case 'AUDIO_TOGGLE_PLAYBACK_MODE':
      togglePlaybackMode();
      sendResponse({ success: true });
      break;
      
    case 'AUDIO_SEEK':
      seekTo(message.position);
      sendResponse({ success: true });
      break;
      
    case 'AUDIO_GET_STATE':
      sendResponse({
        success: true,
        state: {
          currentTrack,
          isPlaying,
          volume,
          playbackMode,
          currentTime: audioPlayer ? audioPlayer.currentTime : 0,
          duration: audioPlayer ? audioPlayer.duration : 0
        }
      });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown command' });
  }
  
  return true; // Keep message channel open for async response
});

// Initialize: Load state from storage and restore playback
async function initialize() {
  const { musicTrack, musicPlaying, musicVolume, playbackMode: savedMode } = await chrome.storage.local.get([
    'musicTrack',
    'musicPlaying',
    'musicVolume',
    'playbackMode'
  ]);
  
  // Restore playback mode
  if (savedMode) {
    playbackMode = savedMode;
  }
  
  // Restore volume
  if (musicVolume !== undefined) {
    volume = musicVolume;
  } else {
    volume = 50;
  }
  
  // Restore track selection and playback
  if (musicTrack) {
    loadTrack(musicTrack);
    
    // Restore playback state
    if (musicPlaying) {
      // Small delay to ensure audio is loaded
      setTimeout(() => {
        playTrack();
      }, 100);
    }
  } else {
    sendStateUpdate();
  }
}

// Initialize on load
initialize();

