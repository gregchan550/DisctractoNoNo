// Motivational quotes array
const motivationalQuotes = [
  {
    quote: "Only those who dare to fail greatly can ever achieve greatly.",
    author: "Robert F. Kennedy"
  },
  {
    quote: "Do not wait to strike till the iron is hot; but make it hot by striking.",
    author: "William Butler Yeats"
  },
  {
    quote: "The secret of getting ahead is getting started.",
    author: "Mark Twain"
  },
  {
    quote: "The journey of a thousand miles begins with a single step.",
    author: "Lao Tzu"
  },
  {
    quote: "When something is important enough, you do it even if the odds are not in your favor.",
    author: "Elon Musk"
  },
  {
    quote: "When your mind says quit, you're only 40% done.",
    author: "David Goggins"
  },
  {
    quote: "The biggest risk is not taking any risk.",
    author: "Mark Zuckerberg"
  },
  {
    quote: "Discipline is choosing between what you want now and what you want most.",
    author: "Abraham Lincoln"
  },
  {
    quote: "No discipline seems pleasant at the time, but painful. Later on, it produces a harvest.",
    author: "Hebrews 13:11"
  },
  {
    quote: "You don't learn to walk by following rules. You learn by doing, and by falling over.",
    author: "Richard Branson"
  },
  {
    quote: "Pain is temporary. Quitting lasts forever.",
    author: "Lance Armstrong"
  },
  {
    quote: "The will to win is nothing without the will to prepare.",
    author: "J.J. Watt"
  },
  {
    quote: "The difference between ordinary and extraordinary is that little extra.",
    author: "Jimmy Johnson"
  },
  {
    quote: "I hated every minute of training, but I said, 'Don't quit.'",
    author: "Muhammad Ali"
  },
  {
    quote: "Don't wish it were easier. Wish you were better.",
    author: "Jim Rohn"
  }
];

// Display a random motivational quote
function displayRandomQuote() {
  const motivationalEl = document.querySelector('.motivational');
  if (motivationalEl) {
    const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    motivationalEl.innerHTML = `"${randomQuote.quote}"<br><span style="font-size: 0.9em; margin-top: 10px; display: block;">— ${randomQuote.author}</span>`;
  }
}

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

// Initialize
displayRandomQuote();
updateTimer();
setInterval(updateTimer, 1000);
