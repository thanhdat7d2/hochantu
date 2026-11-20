# Học Hán Tự — Spaced Repetition

A lightweight, offline-capable web application for learning Chinese characters (*Hán Tự*) with Vietnamese *Hán Việt* readings and meanings using spaced repetition.

## Features

- **4 Frequency-Based Character Sets** (3,609 characters total):
  - **Bộ 1 (`set1_0_65.json`)**: 210 characters (0% → 65% coverage)
  - **Bộ 2 (`set2_65_85.json`)**: 411 characters (65% → 85% coverage)
  - **Bộ 3 (`set3_85_95.json`)**: 666 characters (85% → 95% coverage)
  - **Bộ 4 (`set4_95_100.json`)**: 2,322 characters (95% → 100% coverage)
- **Study & Review Modes**:
  - **Học (Learn)**: Introduces new characters in a structured bootstrap sequence alongside spaced repetition reviews.
  - **Ôn tập (Review)**: Focuses on reviewing previously introduced characters prioritized by urgency.
  - **Chữ đã học (Learned Words)**: Browse, search (by character, *Hán Việt*, or meaning), view per-character mastery bars, or reset progress for the active set.
- **Multiple Exercise Types**:
  - **Definition Cards**: Displays the character, *Hán Việt* reading, Vietnamese meanings, and sample vocabulary compounds.
  - **Draw Review**: Interactive HTML5 canvas with a grid guide (`米字格`), clear button, and self-grading (**Đã nhớ ✓** / **Chưa nhớ ✗**).
  - **Multiple Choice (MCQ)**: Character → *Hán Việt*, Character → Meaning, *Hán Việt* → Character, and Meaning → Character.
  - **Typing Quiz**: Character → *Hán Việt* with Vietnamese diacritic/tone validation.
- **Spaced Repetition Scheduling**: Tracks per-word stability, interval distance, error history, review counters, and `last_reviewed` / `next_due` timestamps to compute review urgency.
- **Session Summary**: Concludes each 50-card session with a summary screen showing total cards, accuracy, correct count, and wrong count.
- **Offline / PWA Support**: Includes `manifest.json` and a Service Worker (`sw.js`) caching app assets and character sets for offline use.

## Getting Started

### Prerequisites
- Python 3 (for the local development server)

### Running Locally
1. Double-click `run.bat`, or run the server from a terminal:
   ```bash
   python server.py
   ```
2. The server starts on `http://localhost:7583` using `ThreadingTCPServer` and automatically opens the app in your browser.

## Controls

- **Desktop**: Press `Enter` or `Space` to advance past definition cards, feedback prompts, draw cards, or the session summary. In typing mode, press `Enter` to submit your answer and `Enter` again to continue.
- **Mobile**: Swipe to advance between cards (swiping is disabled while drawing inside the canvas).

## Project Structure

```text
hochantu/
├── index.html          # Main UI (home view, study view, session summary, learned panel)
├── styles.css          # Application styling
├── app.js              # SRS logic, session builder, card renderers, canvas, SW registration
├── manifest.json       # Web app manifest for PWA installation
├── sw.js               # Service Worker for offline caching
├── server.py           # Local Python HTTP server (port 7583, no-cache headers)
├── run.bat             # Windows launcher for server.py
├── set1_0_65.json      # Set 1 dataset (210 characters)
├── set2_65_85.json     # Set 2 dataset (411 characters)
├── set3_85_95.json     # Set 3 dataset (666 characters)
├── set4_95_100.json    # Set 4 dataset (2,322 characters)
├── audio/              # Feedback sound effects (true.wav, false.wav)
├── font/               # Local fonts (Inter-Regular.otf, SF-Pro-Rounded-Bold.otf)
└── icon/               # App icon (app-icon.svg)
```

## Storage

All learning progress and bootstrap states are saved locally in the browser's `localStorage` under keys `hanzi_state_<setId>` and `hanzi_bootstrap_<setId>`.
