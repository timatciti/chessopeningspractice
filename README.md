# Chess Opening Practice

A lightweight browser app for drilling chess openings.

## Features

- Pick an opening line.
- Choose whether you play White or Black.
- Play against an automated opponent that follows the selected line.
- Instant mistake feedback with a red cross and the correct move.
- Always-on engine evaluation (Stockfish) with an eval bar and live score text.
- 2D visual board powered by chessboard.js (similar style to common online chess boards).

## Run locally

Because this is a static web app, you can run it with any simple web server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.
