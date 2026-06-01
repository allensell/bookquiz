# BookBrain

A nonfiction book retention quiz app. Import your reading history, then let AI quiz you on what you've actually retained.

## Setup

1. Open `app.js` and replace `YOUR_API_KEY_HERE` on line 2 with your [Anthropic API key](https://console.anthropic.com/).
2. Open `index.html` in a browser (or serve locally — no build step required).

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

- Your API key is used directly in the browser. Do not publish this repo with a real key in `app.js` — use an environment variable or a backend proxy for production use.
- All data (library, quiz history) is stored in your browser's `localStorage`.
