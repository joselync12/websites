/* ============================================
   Joselyn's Personal Website — Script
   Starfield + AI Chatbox (Cloudflare Worker + Gemini) + Theme Switcher
   ============================================ */

/* --- Starfield Effect --- */
function createStarfield() {
  const container = document.querySelector('.starfield');
  if (!container) return;

  const starCount = 120;

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    star.classList.add('star');

    const size = Math.random() * 2.5 + 0.5;
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const duration = Math.random() * 4 + 2;
    const maxOpacity = Math.random() * 0.7 + 0.3;

    star.style.width = size + 'px';
    star.style.height = size + 'px';
    star.style.left = x + '%';
    star.style.top = y + '%';
    star.style.setProperty('--duration', duration + 's');
    star.style.setProperty('--opacity', maxOpacity);
    star.style.animationDelay = Math.random() * duration + 's';

    container.appendChild(star);
  }
}

/* --- Chatbox Logic (real AI answers via Cloudflare Worker + Gemini) --- */
// Replace with your deployed Worker URL after setup:
const CHAT_WORKER_URL = "https://mission-comms-chatbot.joselyn-tech3498.workers.dev";

// Rolling short-term memory so the chat can have a conversation
const conversationHistory = [];

async function getBotResponse(userMessage) {
  try {
    const res = await fetch(CHAT_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage, history: conversationHistory })
    });

    if (!res.ok) throw new Error('Request failed with status ' + res.status);

    const data = await res.json();
    const reply = data.reply || "Sorry, I couldn't come up with a response. Try again!";

    conversationHistory.push({ role: 'user', content: userMessage });
    conversationHistory.push({ role: 'assistant', content: reply });
    if (conversationHistory.length > 12) {
      conversationHistory.splice(0, conversationHistory.length - 12);
    }

    return reply;
  } catch (error) {
    return "Sorry, I'm having trouble reaching my AI system right now. Please try again in a moment!";
  }
}

/* --- Voice selection: prefer a natural female English voice (Dawn) --- */
let availableVoices = [];

function refreshVoices() {
  if ('speechSynthesis' in window) {
    availableVoices = window.speechSynthesis.getVoices() || [];
  }
}

if ('speechSynthesis' in window) {
  refreshVoices();
  // Chrome/Firefox load voices asynchronously
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
}

function pickAssistantVoice() {
  if (!availableVoices.length) refreshVoices();
  const voices = availableVoices;
  if (!voices.length) return null;

  // Prefer English voices; fall back to all voices if none are English
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang || ''));
  const pool = en.length ? en : voices;

  const nameOf = (v) => (v.name || '').toLowerCase();
  const notMale = (v) => !/male/i.test(nameOf(v));

  // Tier 1: downloaded natural voices (Siri / Premium / Enhanced / Natural)
  // — these sound markedly more human than the built-in legacy voices.
  const naturalHints = ['siri', 'premium', 'enhanced', 'natural'];
  for (const hint of naturalHints) {
    const match = pool.find((v) => nameOf(v).includes(hint) && notMale(v));
    if (match) return match;
  }

  // Tier 2: known female-sounding voices
  const preferred = [
    'female', 'samantha', 'zira', 'victoria', 'susan', 'karen', 'moira',
    'fiona', 'tessa', 'kate', 'anna', 'amy', 'ava', 'joanna', 'allison',
    'google uk english female', 'google us english',
  ];
  for (const hint of preferred) {
    const match = pool.find((v) => nameOf(v).includes(hint));
    if (match) return match;
  }

  // Tier 3: any voice that is not explicitly male
  return pool.find(notMale) || null;
}

/* --- Shared text-to-speech (used by chatbox + digital person) --- */
function speakText(text, statusEl) {
  if (!('speechSynthesis' in window)) {
    if (statusEl) statusEl.textContent = 'Speech output is not supported in this browser.';
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickAssistantVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 1.05; // slightly brisker = more conversational
  utterance.pitch = 1.0; // natural tone (1.1 sounded chipmunk-y)

  utterance.onstart = () => { if (statusEl) statusEl.textContent = 'Speaking...'; };
  utterance.onend = () => { if (statusEl) statusEl.textContent = ''; };
  utterance.onerror = () => { if (statusEl) statusEl.textContent = 'Could not play audio.'; };

  window.speechSynthesis.speak(utterance);
}

/* --- Mic guard: browsers only allow ONE speech recognition at a time.
   The chatbox + both digital-person mics share this registry so starting
   one mic always stops any other that is still listening. --- */
const activeRecognizers = new Set();

function registerRecognition(rec) {
  activeRecognizers.add(rec);
}

function stopOtherRecognitions(except) {
  activeRecognizers.forEach((rec) => {
    if (rec !== except) {
      try { rec.stop(); } catch (e) { /* already stopped */ }
    }
  });
}

function initChatbox() {
  const toggle = document.querySelector('.chatbox-toggle');
  const panel = document.querySelector('.chatbox-panel');
  const closeBtn = document.querySelector('.chatbox-close');
  const input = document.querySelector('.chatbox-input');
  const sendBtn = document.querySelector('.chatbox-send');
  const messagesContainer = document.querySelector('.chatbox-messages');
  const micBtn = document.querySelector('.chatbox-mic');
  const statusEl = document.querySelector('.chatbox-status');

  if (!toggle || !panel) return;

  let recognition = null;
  let isListening = false;

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message || '';
  }

  function setupMicrophone() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!micBtn) return;

    if (!SpeechRecognition) {
      micBtn.disabled = true;
      micBtn.title = 'Speech recognition is not supported in this browser';
      setStatus('Voice input is not supported in this browser.');
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    registerRecognition(recognition);

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      setStatus('Listening...');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) {
        input.value = transcript;
        setStatus(`Heard: "${transcript}"`);
        sendMessage();
      }
    };

    recognition.onerror = (event) => {
      // 'aborted' = we stopped it ourselves via the mic guard — not a real error
      if (event.error !== 'aborted') {
        setStatus(`Microphone error: ${event.error}`);
      }
      isListening = false;
      micBtn.classList.remove('listening');
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
      if (statusEl && statusEl.textContent === 'Listening...') {
        setStatus('');
      }
    };

    micBtn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
        return;
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      // Stop any other mic first (only one recognition can run at a time)
      stopOtherRecognitions(recognition);

      try {
        recognition.start();
      } catch (error) {
        // Another instance may still be stopping — retry once shortly after
        setTimeout(() => {
          try {
            recognition.start();
          } catch (err) {
            setStatus('Could not start microphone.');
          }
        }, 150);
      }
    });
  }

  setupMicrophone();

  // Open/close panel
  toggle.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      input.focus();
    }
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.remove('open');
  });

  // Send message
  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.classList.add('chat-msg', 'user');
    userMsg.textContent = text;
    messagesContainer.appendChild(userMsg);

    // Clear input
    input.value = '';

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Get and add bot response (async AI call)
    const typingMsg = document.createElement('div');
    typingMsg.classList.add('chat-msg', 'bot');
    typingMsg.textContent = '...';
    messagesContainer.appendChild(typingMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    getBotResponse(text).then((botResponse) => {
      typingMsg.textContent = botResponse;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      speakText(botResponse, statusEl);
    });
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  // Initial greeting
  const greeting = document.createElement('div');
  greeting.classList.add('chat-msg', 'bot');
  greeting.textContent = "Hi! I'm the Mission Comms assistant — ask me about cybersecurity, tech, or anything you're curious about!";
  messagesContainer.appendChild(greeting);
}

/* --- Theme Switcher Logic --- */
function initThemeSwitcher() {
  const toggle = document.querySelector('.theme-toggle');
  const panel = document.querySelector('.theme-panel');
  const options = document.querySelectorAll('.theme-option');

  if (!toggle || !panel) return;

  // Load saved theme or default to purple
  const savedTheme = localStorage.getItem('theme') || 'purple';
  setTheme(savedTheme);

  // Toggle panel open/close
  toggle.addEventListener('click', () => {
    panel.classList.toggle('open');
  });

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !toggle.contains(e.target)) {
      panel.classList.remove('open');
    }
  });

  // Handle theme selection
  options.forEach(option => {
    option.addEventListener('click', () => {
      const theme = option.dataset.theme;
      setTheme(theme);
      localStorage.setItem('theme', theme);
      panel.classList.remove('open');
    });
  });
}

function setTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === theme);
  });
}

/* --- Initialize on page load --- */
document.addEventListener('DOMContentLoaded', () => {
  createStarfield();
  initChatbox();
  initThemeSwitcher();
});
