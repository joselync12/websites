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

/* --- Shared text-to-speech (used by chatbox + digital person) --- */
function speakText(text, statusEl) {
  if (!('speechSynthesis' in window)) {
    if (statusEl) statusEl.textContent = 'Speech output is not supported in this browser.';
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;

  utterance.onstart = () => { if (statusEl) statusEl.textContent = 'Speaking...'; };
  utterance.onend = () => { if (statusEl) statusEl.textContent = ''; };
  utterance.onerror = () => { if (statusEl) statusEl.textContent = 'Could not play audio.'; };

  window.speechSynthesis.speak(utterance);
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
      setStatus(`Microphone error: ${event.error}`);
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

      try {
        recognition.start();
      } catch (error) {
        setStatus('Could not start microphone.');
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
  greeting.textContent = "Hi there! I'm Joselyn's assistant. Ask me about her major, hobbies, interests, or cybersecurity tips!";
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
