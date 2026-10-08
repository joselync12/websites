/* ============================================
   AI Digital Person — Part 3
   Upload photo → Create digital person →
   Ask questions (text or voice) → AI answers
   aloud, reusing the Mission Comms chatbot.
   ============================================ */

function initDigitalPerson() {
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

  // Page not present — nothing to do
  if (!fileInput || !createBtn || !stage) return;

  let photoDataUrl = null;
  let recognition = null;
  let isListening = false;

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

    // Simulated "generation" step, then reveal the avatar
    setTimeout(() => {
      avatar.src = photoDataUrl;
      stage.hidden = false;
      createStatus.textContent = 'Your digital person is ready!';
      stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      questionInput.focus();
      setAvatarStatus('Online');
    }, 600);
  });

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

      // Return to "Online" once speech finishes (or immediately if no TTS)
      if ('speechSynthesis' in window) {
        const poll = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            clearInterval(poll);
            setAvatarStatus('Online');
          }
        }, 400);
        // Safety stop so the interval never runs forever
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
  function setupMicrophone() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!micBtn) return;

    if (!SpeechRecognition) {
      micBtn.disabled = true;
      micBtn.title = 'Speech recognition is not supported in this browser';
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
        questionInput.value = transcript;
        setStatus(`Heard: "${transcript}"`);
        askQuestion();
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
}

/* --- Initialize --- */
document.addEventListener('DOMContentLoaded', initDigitalPerson);
