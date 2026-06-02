// ── Configuration ──────────────────────────────────────────────────────────
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-8';

function getApiKey() { return localStorage.getItem('bb_api_key') || ''; }

// ── Storage helpers ─────────────────────────────────────────────────────────
const storage = {
  get: (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
};

// ── State ───────────────────────────────────────────────────────────────────
let library  = storage.get('bb_library', []);
let history  = storage.get('bb_history', []);

let quizState = {
  book: null,
  questions: [],
  answers: [],
  current: 0,
  useRandom: true,
  difficulty: 'deep',
  count: 5,
};

// ── Utility ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];

function saveLibrary() { storage.set('bb_library', library); updateBookCount(); }
function saveHistory()  { storage.set('bb_history', history); }

function updateBookCount() {
  $('bookCountDisplay').textContent = library.length;
}

function showError(id, msg) {
  const el = $(id);
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ── Navigation ──────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.classList.add('hidden'); });
    const target = document.getElementById(`view-${view}`);
    target.classList.remove('hidden');
    target.classList.add('active');
    if (view === 'library')  renderLibrary();
    if (view === 'stats')    renderStats();
  });
});

// ── Quiz Setup ───────────────────────────────────────────────────────────────
$('btn-random').addEventListener('click', () => {
  quizState.useRandom = true;
  $('btn-random').classList.add('active');
  $('btn-pick').classList.remove('active');
  $('bookSelect').classList.add('hidden');
});

$('btn-pick').addEventListener('click', () => {
  quizState.useRandom = false;
  $('btn-pick').classList.add('active');
  $('btn-random').classList.remove('active');
  populateBookSelect();
  $('bookSelect').classList.remove('hidden');
});

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    quizState.difficulty = btn.dataset.level;
  });
});

$('questionCount').addEventListener('input', e => {
  quizState.count = parseInt(e.target.value);
  $('qCountLabel').textContent = quizState.count;
});

function populateBookSelect() {
  const sel = $('bookSelect');
  sel.innerHTML = '<option value="">— choose a book —</option>';
  library.forEach((b, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${b.title} — ${b.author}`;
    sel.appendChild(opt);
  });
}

// ── Start Quiz ───────────────────────────────────────────────────────────────
$('startQuizBtn').addEventListener('click', async () => {
  if (!getApiKey()) {
    showError('quizError', 'Add your Anthropic API key in Settings first.');
    return;
  }
  if (library.length === 0) {
    showError('quizError', 'Add some books to your library first.');
    return;
  }

  let book;
  if (quizState.useRandom) {
    book = randomItem(library);
  } else {
    const idx = parseInt($('bookSelect').value);
    if (isNaN(idx)) { showError('quizError', 'Please select a book.'); return; }
    book = library[idx];
  }

  quizState.book = book;
  quizState.answers = [];
  quizState.current = 0;

  $('quiz-setup').classList.add('hidden');
  $('quiz-loading').classList.remove('hidden');

  try {
    quizState.questions = await generateQuestions(book, quizState.difficulty, quizState.count);
    $('quiz-loading').classList.add('hidden');
    startQuizUI();
  } catch (err) {
    $('quiz-loading').classList.add('hidden');
    $('quiz-setup').classList.remove('hidden');
    showError('quizError', `Error: ${err.message}`);
  }
});

// ── Question Generation ──────────────────────────────────────────────────────
async function generateQuestions(book, difficulty, count) {
  const diffPrompts = {
    recall: 'Focus on plot events, character names, key facts, and specific details from the book.',
    deep:   'Focus on themes, the author\'s central argument or message, narrative structure, symbolism, and craft.',
    apply:  'Focus on how the book\'s ideas connect to real life, current events, or the reader\'s own experience. Ask reflective or speculative questions.',
  };

  const prompt = `You are a thoughtful reading guide creating a multiple-choice retention quiz for someone who has read a nonfiction book.

Book: "${book.title}" by ${book.author}${book.genre ? ` (${book.genre})` : ''}${book.notes ? `\nReader's notes: ${book.notes}` : ''}

Generate exactly ${count} multiple-choice questions. Difficulty: ${difficulty}.
${diffPrompts[difficulty]}

Each question must have exactly 4 options (A, B, C, D) with only one correct answer. Make the wrong answers plausible but clearly incorrect to someone who read the book.

Return ONLY a JSON array in this exact format, no other text:
[
  {
    "question": "Question text?",
    "options": ["A. First option", "B. Second option", "C. Third option", "D. Fourth option"],
    "answer": "A"
  }
]`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  let text = data.content[0].text.trim();
  console.log('API response:', text);
  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No valid JSON array in response. Try again.');
  return JSON.parse(text.slice(start, end + 1));
}

// ── Quiz UI ──────────────────────────────────────────────────────────────────
function startQuizUI() {
  $('quiz-active').classList.remove('hidden');
  $('quiz-book-label').textContent = `"${quizState.book.title}" by ${quizState.book.author}`;
  showQuestion();
}

function showQuestion() {
  const i = quizState.current;
  const total = quizState.questions.length;
  const q = quizState.questions[i];

  $('progressText').textContent = `Question ${i + 1} of ${total}`;
  $('progressFill').style.width = `${(i / total) * 100}%`;
  $('questionText').textContent = q.question;
  $('submitAnswerBtn').disabled = true;
  $('feedbackCard').classList.add('hidden');
  $('questionCard').classList.remove('hidden');

  const list = $('optionsList');
  list.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const letter = ['A','B','C','D'][idx];
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.letter = letter;
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      list.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      $('submitAnswerBtn').disabled = false;
    });
    list.appendChild(btn);
  });
}

$('submitAnswerBtn').addEventListener('click', () => {
  const selected = $('optionsList').querySelector('.option-btn.selected');
  if (!selected) return;

  const q = quizState.questions[quizState.current];
  const chosenLetter = selected.dataset.letter;
  const correct = chosenLetter === q.answer;

  // Highlight correct and wrong answers
  $('optionsList').querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.letter === q.answer) btn.classList.add('correct');
    else if (btn.classList.contains('selected')) btn.classList.add('incorrect');
  });

  const correctOption = q.options.find(o => o.startsWith(q.answer + '.'));

  quizState.answers.push({
    question: q.question,
    chosen: selected.textContent,
    correct,
    correctAnswer: correctOption || q.answer,
  });

  $('submitAnswerBtn').disabled = true;
  $('feedbackIcon').textContent = correct ? '✓' : '✗';
  $('feedbackIcon').style.color = correct ? 'var(--green)' : 'var(--red)';
  $('feedbackText').textContent = correct
    ? 'Correct!'
    : `The correct answer was: ${correctOption || q.answer}`;
  $('feedbackCard').classList.remove('hidden');

  const isLast = quizState.current === quizState.questions.length - 1;
  $('nextBtn').textContent = isLast ? 'See Results' : 'Next Question';
});

$('nextBtn').addEventListener('click', () => {
  quizState.current++;
  $('progressFill').style.width = `${(quizState.current / quizState.questions.length) * 100}%`;
  if (quizState.current < quizState.questions.length) {
    showQuestion();
  } else {
    finishQuiz();
  }
});

// ── Results ──────────────────────────────────────────────────────────────────
function finishQuiz() {
  $('quiz-active').classList.add('hidden');
  $('quiz-results').classList.remove('hidden');

  const correct = quizState.answers.filter(a => a.correct).length;
  const total   = quizState.answers.length;

  $('resultsBook').textContent = `"${quizState.book.title}" by ${quizState.book.author}`;
  $('scoreNum').textContent = `${correct}/${total}`;

  const list = $('resultsList');
  list.innerHTML = '';
  quizState.answers.forEach(a => {
    const div = document.createElement('div');
    div.className = `result-item ${a.correct ? 'correct' : 'incorrect'}`;
    div.innerHTML = `
      <p class="result-q">${escHtml(a.question)}</p>
      <p class="result-fb">Your answer: ${escHtml(a.chosen)}${!a.correct ? `<br>Correct: ${escHtml(a.correctAnswer)}` : ''}</p>`;
    list.appendChild(div);
  });

  // Save to history
  const session = {
    id: Date.now(),
    date: new Date().toISOString(),
    book: quizState.book.title,
    author: quizState.book.author,
    difficulty: quizState.difficulty,
    correct,
    total,
  };
  history.unshift(session);
  if (history.length > 100) history = history.slice(0, 100);
  saveHistory();
}

$('retakeBtn').addEventListener('click', () => {
  $('quiz-results').classList.add('hidden');
  quizState.answers = [];
  quizState.current = 0;
  startQuizUI();
});

$('newQuizBtn').addEventListener('click', () => {
  $('quiz-results').classList.add('hidden');
  $('quiz-setup').classList.remove('hidden');
});

// ── Library ──────────────────────────────────────────────────────────────────
function renderLibrary() {
  const grid = $('libraryGrid');
  const empty = $('emptyLibrary');
  grid.innerHTML = '';

  if (library.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  library.forEach((book, i) => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <p class="book-title">${escHtml(book.title)}</p>
      <p class="book-author">${escHtml(book.author)}</p>
      <div class="book-meta">
        ${book.genre  ? `<span class="book-tag">${escHtml(book.genre)}</span>` : ''}
        ${book.year   ? `<span class="book-tag">${escHtml(String(book.year))}</span>` : ''}
      </div>
      <div class="book-actions">
        <button class="book-action-btn quiz-this" data-idx="${i}">Quiz this</button>
        <button class="book-action-btn delete" data-idx="${i}">Delete</button>
      </div>`;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.quiz-this').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      quizState.useRandom = false;
      $('btn-pick').classList.add('active');
      $('btn-random').classList.remove('active');
      populateBookSelect();
      $('bookSelect').classList.remove('hidden');
      $('bookSelect').value = idx;
      // Switch to quiz view
      document.querySelector('[data-view="quiz"]').click();
    });
  });

  grid.querySelectorAll('.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (confirm(`Delete "${library[idx].title}"?`)) {
        library.splice(idx, 1);
        saveLibrary();
        renderLibrary();
      }
    });
  });
}

$('addBookBtn').addEventListener('click', () => {
  $('addBookForm').classList.toggle('hidden');
});

$('cancelAddBtn').addEventListener('click', () => {
  $('addBookForm').classList.add('hidden');
  clearAddForm();
});

$('saveBookBtn').addEventListener('click', () => {
  const title  = $('newTitle').value.trim();
  const author = $('newAuthor').value.trim();
  if (!title || !author) { alert('Title and author are required.'); return; }

  library.push({
    title,
    author,
    genre: $('newGenre').value.trim() || null,
    year:  $('newYear').value  ? parseInt($('newYear').value) : null,
    notes: $('newNotes').value.trim() || null,
  });

  saveLibrary();
  clearAddForm();
  $('addBookForm').classList.add('hidden');
  renderLibrary();
});

function clearAddForm() {
  ['newTitle','newAuthor','newGenre','newYear','newNotes'].forEach(id => { $(id).value = ''; });
}

// ── CSV Import ────────────────────────────────────────────────────────────────
$('importCsvBtn').addEventListener('click', () => $('csvFileInput').click());

$('csvFileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const imported = parseStoryGraphCsv(ev.target.result);
    if (imported.length === 0) { alert('No books found in CSV. Make sure it\'s a StoryGraph export.'); return; }
    const dupes = imported.filter(b => library.some(l => l.title.toLowerCase() === b.title.toLowerCase()));
    const fresh = imported.filter(b => !library.some(l => l.title.toLowerCase() === b.title.toLowerCase()));
    library.push(...fresh);
    saveLibrary();
    renderLibrary();
    alert(`Imported ${fresh.length} book(s).${dupes.length ? ` Skipped ${dupes.length} duplicate(s).` : ''}`);
  };
  reader.readAsText(file);
  e.target.value = '';
});

function parseStoryGraphCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase().trim());
  const titleIdx  = headers.findIndex(h => h.includes('title'));
  const authorIdx = headers.findIndex(h => h.includes('author'));
  const genreIdx  = headers.findIndex(h => h.includes('genre') || h.includes('tag'));
  const dateIdx   = headers.findIndex(h => h.includes('read') && h.includes('date') || h === 'date read');

  if (titleIdx === -1 || authorIdx === -1) return [];

  const books = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const title  = cols[titleIdx]?.trim();
    const author = cols[authorIdx]?.trim();
    if (!title || !author) continue;

    let year = null;
    if (dateIdx !== -1 && cols[dateIdx]) {
      const match = cols[dateIdx].match(/\d{4}/);
      if (match) year = parseInt(match[0]);
    }

    books.push({
      title,
      author,
      genre: genreIdx !== -1 ? (cols[genreIdx]?.trim() || null) : null,
      year,
      notes: null,
    });
  }
  return books;
}

function splitCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  const totalQuizzes    = history.length;
  const totalQuestions  = history.reduce((s, h) => s + h.total, 0);
  const totalCorrect    = history.reduce((s, h) => s + h.correct, 0);
  const accuracy        = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) + '%' : '—';
  const booksQuizzed    = new Set(history.map(h => h.book)).size;

  $('statQuizzes').textContent   = totalQuizzes;
  $('statQuestions').textContent = totalQuestions;
  $('statAccuracy').textContent  = accuracy;
  $('statBooks').textContent     = booksQuizzed;

  const list  = $('historyList');
  const empty = $('emptyHistory');
  list.innerHTML = '';

  if (history.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  history.slice(0, 20).forEach(h => {
    const date = new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const div  = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div>
        <p class="history-book">${escHtml(h.book)}</p>
        <p class="history-meta">${date} · ${h.difficulty} · ${h.total} questions</p>
      </div>
      <span class="history-score">${h.correct}/${h.total}</span>`;
    list.appendChild(div);
  });
}

$('clearHistoryBtn').addEventListener('click', () => {
  if (confirm('Clear all quiz history?')) {
    history = [];
    saveHistory();
    renderStats();
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Settings ──────────────────────────────────────────────────────────────────
function initSettingsView() {
  const saved = getApiKey();
  if (saved) $('apiKeyInput').value = saved;
}

$('saveKeyBtn').addEventListener('click', () => {
  const key = $('apiKeyInput').value.trim();
  if (!key) { showApiKeyStatus('Enter a key first.', false); return; }
  localStorage.setItem('bb_api_key', key);
  showApiKeyStatus('Key saved.', true);
});

$('clearKeyBtn').addEventListener('click', () => {
  localStorage.removeItem('bb_api_key');
  $('apiKeyInput').value = '';
  showApiKeyStatus('Key cleared.', true);
});

function showApiKeyStatus(msg, ok) {
  const el = $('apiKeyStatus');
  el.textContent = msg;
  el.style.color = ok ? 'var(--green)' : 'var(--red)';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── Init ──────────────────────────────────────────────────────────────────────
updateBookCount();
initSettingsView();
