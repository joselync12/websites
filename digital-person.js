/* ============================================
   AI Digital Person — Part 3
   Page: upload photo → create digital person
   Panel (every page): talk to your digital person
   Reuses the Mission Comms chatbot AI.
   ============================================ */

const DP_AVATAR_KEY = 'dpAvatar';
const DP_DEFAULT_AVATAR = 'assets/img/dawn.png';

function dpLoadAvatar() {
  try { return localStorage.getItem(DP_AVATAR_KEY); } catch (e) { return null; }
}

function dpSaveAvatar(dataUrl) {
  try { localStorage.setItem(DP_AVATAR_KEY, dataUrl); } catch (e) { /* storage full/unavailable */ }
  // Let panels on this page refresh immediately (storage events only fire cross-tab)
  try { window.dispatchEvent(new Event('dp-avatar-changed')); } catch (e) { /* ignore */ }
}

/* --- Shared: attach speech recognition to a mic button --- */
function dpSetupMic(micBtn, inputEl, statusEl, onTranscript) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!micBtn) return null;

  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micBtn.title = 'Speech recognition is not supported in this browser';
    return null;
  }

  let recognition = null;
  let isListening = false;

  const setStatus = (m) => { if (statusEl) statusEl.textContent = m || ''; };

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  if (typeof registerRecognition === 'function') registerRecognition(recognition);

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add('listening');
    setStatus('Listening...');
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    if (transcript) {
      if (inputEl) inputEl.value = transcript;
      setStatus(`Heard: "${transcript}"`);
      onTranscript(transcript);
    }
  };

  recognition.onerror = (event) => {
    // 'aborted' = stopped by the shared mic guard when another mic took over
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
    if (typeof stopOtherRecognitions === 'function') stopOtherRecognitions(recognition);

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

  return recognition;
}

/* ============================================
   Floating Digital Person panel (all pages)
   ============================================ */
function initDpPanel() {
  const toggle = document.querySelector('.dp-toggle');
  const panel = document.querySelector('.dp-panel');
  const closeBtn = document.querySelector('.dp-panel-close');
  const avatarImg = document.getElementById('dp-panel-avatar');
  const avatarStatus = document.getElementById('dp-panel-avatar-status');
  const messages = document.getElementById('dp-panel-messages');
  const input = document.getElementById('dp-panel-input');
  const micBtn = document.getElementById('dp-panel-mic');
  const sendBtn = document.getElementById('dp-panel-send');
  const statusEl = document.getElementById('dp-panel-status');

  if (!toggle || !panel || !messages) return;

  let recognition = null;

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message || '';
  }

  function addMsg(text, who) {
    const msg = document.createElement('div');
    msg.classList.add('chat-msg', who);
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  // Show Dawn by default; an uploaded photo overrides her
  function refreshAvatar() {
    if (!avatarImg) return false;
    const avatar = dpLoadAvatar() || DP_DEFAULT_AVATAR;
    avatarImg.src = avatar;
    avatarImg.hidden = false;
    return true;
  }

  // If the sprite ever fails to load, hide it instead of showing a broken image
  if (avatarImg) {
    avatarImg.addEventListener('error', () => { avatarImg.hidden = true; });
  }

  let hasAvatar = refreshAvatar();

  // First-open welcome
  let greeted = false;

  function askQuestion(text) {
    const question = (text || (input && input.value) || '').trim();
    if (!question) return;
    if (input) input.value = '';

    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (statusEl) setStatus('Thinking...');

    addMsg(question, 'user');
    const pending = addMsg('...', 'bot');

    getBotResponse(question).then((answer) => {
      pending.textContent = answer;
      messages.scrollTop = messages.scrollHeight;

      if (statusEl) setStatus('Speaking...');
      speakText(answer, statusEl);
    });
  }

  // Open/close
  toggle.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      if (!greeted) {
        greeted = true;
        if (hasAvatar) {
          addMsg("Hi! I'm Dawn. Ask me anything!", 'bot');
        } else {
          const hint = document.createElement('div');
          hint.classList.add('dp-panel-hint');
          hint.innerHTML = 'Dawn is offline right now. <a href="digital-person.html">Open her page</a> to set her up!';
          messages.appendChild(hint);
        }
      }
      if (input) input.focus();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => panel.classList.remove('open'));
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => askQuestion());
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        askQuestion();
      }
    });
  }

  recognition = dpSetupMic(micBtn, input, statusEl, (transcript) => askQuestion(transcript));

  // Listen for avatar changes (same tab via custom event, other tabs via storage)
  window.addEventListener('dp-avatar-changed', () => { hasAvatar = refreshAvatar(); });
  window.addEventListener('storage', (e) => {
    if (e.key === DP_AVATAR_KEY) {
      hasAvatar = refreshAvatar();
    }
  });
}

/* ============================================
   Digital person page: upload + create + chat
   ============================================ */
function initDigitalPersonPage() {
  const fileInput = document.getElementById('dp-photo-input');
  const fileName = document.getElementById('dp-file-name');
  const previewWrap = document.getElementById('dp-preview-wrap');
  const preview = document.getElementById('dp-preview');
  const createBtn = document.getElementById('dp-create-btn');
  const createStatus = document.getElementById('dp-create-status');
  const stage = document.getElementById('dp-stage');
  const avatar = document.getElementById('dp-avatar');
  const avatarStatus = document.getElementById('dp-avatar-status');
  const responseBox = document.getElementById('dp-response');
  const questionInput = document.getElementById('dp-question');
  const askBtn = document.getElementById('dp-ask');
  const micBtn = document.getElementById('dp-mic');
  const statusEl = document.getElementById('dp-status');

  // Not on the digital person page
  if (!fileInput || !createBtn || !stage) return;

  let photoDataUrl = null;
  let recognition = null;

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message || '';
  }

  function setAvatarStatus(message) {
    if (avatarStatus) avatarStatus.textContent = message || '';
  }

  /* --- 1. Photo upload + preview --- */
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      fileName.textContent = 'Please choose an image file.';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      photoDataUrl = e.target.result;
      preview.src = photoDataUrl;
      previewWrap.hidden = false;
      fileName.textContent = file.name;
      createBtn.disabled = false;
      createStatus.textContent = '';
    };
    reader.readAsDataURL(file);
  });

  /* --- 2. Create digital person --- */
  createBtn.addEventListener('click', () => {
    if (!photoDataUrl) return;

    createStatus.textContent = 'Generating your digital person...';

    setTimeout(() => {
      avatar.src = photoDataUrl;
      stage.hidden = false;
      createStatus.textContent = 'Dawn is ready! She will also appear in the 🧑 panel on every page.';
      stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      questionInput.focus();
      setAvatarStatus('Online');

      // Persist so the floating panel shows it everywhere
      dpSaveAvatar(photoDataUrl);
    }, 600);
  });

  // Show Dawn by default; a saved photo overrides her
  const saved = dpLoadAvatar();
  if (avatar) {
    avatar.addEventListener('error', () => { avatar.hidden = true; });
    avatar.src = saved || DP_DEFAULT_AVATAR;
  }
  if (saved) {
    photoDataUrl = saved;
    preview.src = saved;
    previewWrap.hidden = false;
    fileName.textContent = 'Saved photo';
    createBtn.disabled = false;
  }
  stage.hidden = false;
  setAvatarStatus('Online');

  /* --- 3. Ask + AI response --- */
  function askQuestion() {
    const question = questionInput.value.trim();
    if (!question || stage.hidden) return;

    questionInput.value = '';
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    responseBox.innerHTML = '';
    const pending = document.createElement('p');
    pending.classList.add('dp-response-text', 'dp-thinking');
    pending.textContent = 'Thinking...';
    responseBox.appendChild(pending);

    setAvatarStatus('Thinking...');

    getBotResponse(question).then((answer) => {
      pending.classList.remove('dp-thinking');
      pending.textContent = answer;
      setAvatarStatus('Speaking');
      speakText(answer, statusEl);

      if ('speechSynthesis' in window) {
        const poll = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            clearInterval(poll);
            setAvatarStatus('Online');
          }
        }, 400);
        setTimeout(() => clearInterval(poll), 120000);
      } else {
        setAvatarStatus('Online');
      }
    });
  }

  askBtn.addEventListener('click', askQuestion);
  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      askQuestion();
    }
  });

  /* --- 4. Microphone input --- */
  recognition = dpSetupMic(micBtn, questionInput, statusEl, () => askQuestion());
}

/* --- Initialize --- */
document.addEventListener('DOMContentLoaded', () => {
  initDpPanel();
  initDigitalPersonPage();
});
