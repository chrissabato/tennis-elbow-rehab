# Tennis Elbow Rehab

A progressive web app that guides you through the
[OrthoIndy Tennis Elbow Home Exercise Program](https://www.orthoindy.com/wp-content/uploads/Tennis-Elbow-Home-Exercise-Program.pdf).

**Live app:** https://chrissabato.github.io/tennis-elbow-rehab/

## Features

- Step-by-step session player for all 7 exercises, with photos, setup, movement and tips
- Hold / relax / rest timers with beeps, voice prompts and vibration
- Keeps the screen awake during a session
- Tracks the 2× daily, 5× weekly schedule
- Post-session pain rating (0–10) and notes, with a trend chart
- Optional reminders (while the app is open)
- Works offline and can be installed to your home screen
- All data stays on your device (export/import as JSON)

## Install

Open the live app on your phone, then:
- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** menu → Install app

## Development

No build step. Serve the folder with any static server:

```sh
python3 -m http.server
```

When changing cached files, bump `CACHE` in `sw.js` (and `APP_VERSION` in `app.js`) so installed copies update.

## Disclaimer

This app is a guide, not medical advice. Follow your physical therapist's instructions. Exercise content is
adapted from OrthoIndy's published home exercise program. Exercise photos are © OrthoIndy and are not stored in
this repo: the app downloads OrthoIndy's PDF and crops the photos on your device ([photos.js](photos.js)); video demonstrations are at
[OrthoIndy.com/PTVideos](https://www.orthoindy.com/PTVideos).
