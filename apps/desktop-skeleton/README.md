TOEFL Reading Desktop Skeleton

- This directory contains a minimal Electron-based skeleton to host the TOEFL reading scoring UI.
- In production, you would build the web app into a local asset and load it into the desktop shell.
- The scoring engine is shared with the web app (src/score/reading_score_engine.js) and can be accessed from the renderer via a preload API.

- Current skeleton focuses on portability and ease of integration with existing web UI.
