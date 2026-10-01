/* ============================================
   Joselyn's Personal Website — Script
   Starfield + Rule-Based Chatbox + Theme Switcher
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

/* --- Chatbox Logic --- */
const chatResponses = [
  {
    keywords: ['name', 'who are you', 'your name'],
    response: "I'm Joselyn, a senior at Kean University studying Information Technology."
  },
  {
    keywords: ['major', 'study', 'studying', 'field'],
    response: "I'm majoring in Information Technology with interests in programming, UX/UI, cybersecurity, and game design."
  },
  {
    keywords: ['hobby', 'hobbies', 'fun', 'free time', 'enjoy'],
    response: "I enjoy drawing and painting, gaming, and designing in my free time."
  },
  {
    keywords: ['cybersecurity', 'security', 'cyber'],
    response: "Cybersecurity is about protecting systems, networks, and people from threats like phishing. Always verify before you click!"
  },
  {
    keywords: ['phishing', 'phish', 'scam', 'fraud'],
    response: "Phishing is when attackers trick you into revealing sensitive info through fake emails or websites. Hover over links to preview URLs, check sender addresses carefully, and never share passwords via email."
  },
  {
    keywords: ['skill', 'skills', 'good at', 'abilities'],
    response: "I'm building skills in web development, programming, and UX/UI design. I'm always learning new technologies!"
  },
  {
    keywords: ['goal', 'goals', 'future', 'plan', 'plans', 'career'],
    response: "My goal is to do well in school, complete my degree, and grow my tech skills. I'm interested in careers that blend technology and creativity."
  },
  {
    keywords: ['fact', 'interesting', 'cool', 'unique'],
    response: "Here's a fun fact: I'm currently building my own budget tracker app!"
  },
  {
    keywords: ['education', 'school', 'university', 'college', 'kean'],
    response: "I attend Kean University as a senior, majoring in Information Technology."
  },
  {
    keywords: ['game', 'gaming', 'game design', 'design'],
    response: "I'm interested in game design — combining creativity with technology to build interactive experiences. I also enjoy gaming as a hobby!"
  },
  {
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml'],
    response: "AI is transforming every industry. I'm curious about how it can be used responsibly and securely, especially in cybersecurity."
  },
  {
    keywords: ['programming', 'code', 'coding', 'developer'],
    response: "Programming is one of my core interests! I enjoy building things with code and solving problems through software."
  },
  {
    keywords: ['ux', 'ui', 'user experience', 'user interface', 'design'],
    response: "UX/UI design is all about creating intuitive, enjoyable experiences for users. I love the blend of creativity and psychology it requires."
  },
  {
    keywords: ['web', 'website', 'web development', 'frontend', 'front-end'],
    response: "Web development is a skill I'm actively building. This very website is a project to practice my front-end skills!"
  },
  {
    keywords: ['budget', 'tracker', 'app', 'project'],
    response: "I'm currently creating my own budget tracker app — it's a great way to apply my programming skills to a real-world problem!"
  },
  {
    keywords: ['hello', 'hi', 'hey', 'greetings', 'what\'s up', 'sup'],
    response: "Hello! Welcome to my corner of the internet. Feel free to ask me about my major, hobbies, or cybersecurity tips!"
  },
  {
    keywords: ['thank', 'thanks', 'appreciate'],
    response: "You're welcome! Let me know if you have any other questions."
  },
  {
    keywords: ['bye', 'goodbye', 'later', 'see you'],
    response: "Goodbye! Thanks for stopping by. Stay safe online!"
  }
];

const fallbackResponses = [
  "I'm not sure about that — try asking about my major, hobbies, or cybersecurity tips!",
  "Hmm, I don't have an answer for that yet. Ask me about phishing, my skills, or my interests!",
  "That's outside my knowledge base for now. Try asking about my education, goals, or technology interests!"
];

function getBotResponse(userMessage) {
  const lower = userMessage.toLowerCase().trim();

  for (const item of chatResponses) {
    for (const keyword of item.keywords) {
      if (lower.includes(keyword)) {
        return item.response;
      }
    }
  }

  return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
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

  function speakText(text) {
    if (!('speechSynthesis' in window)) {
      setStatus('Speech output is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => setStatus('Speaking...');
    utterance.onend = () => setStatus('');
    utterance.onerror = () => setStatus('Could not play audio.');

    window.speechSynthesis.speak(utterance);
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

    // Get and add bot response with slight delay
    setTimeout(() => {
      const botResponse = getBotResponse(text);
      const botMsg = document.createElement('div');
      botMsg.classList.add('chat-msg', 'bot');
      botMsg.textContent = botResponse;
      messagesContainer.appendChild(botMsg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      speakText(botResponse);
    }, 400);
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
