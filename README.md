# BookBrain

A nonfiction book retention quiz app. Import your reading history, then let AI quiz you on what you've actually retained.

## Running the app

You can't open `index.html` directly — browsers block API calls from `file://` URLs. Serve it locally instead:

**Option A — Python (built into macOS):**
```bash
cd bookquiz
python3 -m http.server 8080
```

**Option B — Node:**
```bash
cd bookquiz
npx serve .
```

Then open http://localhost:8080 in your browser.

## Setup

1. Go to **Settings** and paste your [Anthropic API key](https://console.anthropic.com/). It's stored in your browser's localStorage — no code changes needed.

## Features

- **Import books** from a StoryGraph CSV export, or add them manually
- **Quiz mode** — random book from your library, or pick a specific one
- **3 difficulty levels**
  - *Recall* — plot, characters, key facts
  - *Deep Dive* — themes, argument, craft
  - *Apply It* — connect the book to your own life
- **1–20 questions** per session, AI-generated via Claude
- **Instant feedback** on each answer with partial credit
- **Stats & history** tracked in localStorage

## Usage

1. Go to **Library** and add books (or import a StoryGraph CSV)
2. Go to **Quiz**, pick your settings, click **Generate Quiz**
3. Answer each question — Claude evaluates your responses
4. Review your score and feedback at the end

## Notes

- Your API key is stored in your browser's localStorage and sent directly to Anthropic. It is never in the source code.
- All data (library, quiz history) is stored in your browser's `localStorage`.
