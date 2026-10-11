'use strict';

// Exercise photos are © OrthoIndy and are not stored in this repo. On first run the app downloads the
// official PDF from orthoindy.com, renders it on-device with pdf.js, crops out each photo, and keeps the
// crops in Cache Storage so they work offline afterwards.

const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
const PHOTO_CACHE = 'elbow-rehab-photos-v1';
const PHOTO_SCALE = 3;

// Photo boxes in PDF points (top-left origin): [page, x, y, width, height]. Two photos per exercise: step 1, step 2.
const PHOTO_BOXES = {
  'wrist-extension-stretch':     [[1, 50.5, 179.6, 104.8, 104.8], [1, 207.4, 179.6, 104.8, 104.8]],
  'wrist-flexion-stretch':       [[1, 50.5, 405.0, 104.8, 104.8], [1, 207.4, 405.0, 104.8, 104.8]],
  'wrist-flexion-dumbbell':      [[1, 50.5, 630.2, 104.8, 104.8], [1, 207.4, 630.2, 104.8, 104.8]],
  'wrist-extension-dumbbell':    [[2, 50.5, 79.1, 104.8, 100.9], [2, 207.4, 79.1, 104.8, 100.9]],
  'towel-roll-squeeze':          [[2, 50.5, 272.2, 104.8, 96.3], [2, 206.4, 272.2, 106.8, 96.3]],
  'pronation-supination-hammer': [[2, 29.5, 445.7, 151.9, 100.8], [2, 186.1, 445.7, 152.1, 100.8]],
  'finger-extension-band':       [[2, 49.5, 622.6, 104.8, 104.8], [2, 206.3, 622.6, 104.8, 104.8]],
};

const photoKey = (id, step) => `photos/${id}-${step}.jpg`;
const photoUrls = {}; // "id-step" -> object URL

function getPhoto(id, step) {
  return photoUrls[`${id}-${step}`] || null;
}

async function readCachedPhotos() {
  if (!('caches' in window)) return false;
  const cache = await caches.open(PHOTO_CACHE);
  let all = true;
  for (const id of Object.keys(PHOTO_BOXES)) {
    for (const step of [1, 2]) {
      const res = await cache.match(photoKey(id, step));
      if (res) photoUrls[`${id}-${step}`] = URL.createObjectURL(await res.blob());
      else all = false;
    }
  }
  return all;
}

async function extractPhotos() {
  const pdfjs = await import(PDFJS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const doc = await pdfjs.getDocument({ url: PROGRAM.sourceUrl }).promise;
  const cache = 'caches' in window ? await caches.open(PHOTO_CACHE) : null;

  const pages = {};
  for (const boxes of Object.values(PHOTO_BOXES)) for (const [p] of boxes) pages[p] = true;
  for (const p of Object.keys(pages)) {
    const page = await doc.getPage(Number(p));
    const viewport = page.getViewport({ scale: PHOTO_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    pages[p] = canvas;
  }

  for (const [id, boxes] of Object.entries(PHOTO_BOXES)) {
    for (let i = 0; i < boxes.length; i++) {
      const [p, x, y, w, h] = boxes[i];
      // Trim a point on each side to avoid anti-aliased edges.
      const sx = (x + 1) * PHOTO_SCALE, sy = (y + 1) * PHOTO_SCALE;
      const sw = (w - 2) * PHOTO_SCALE, sh = (h - 2) * PHOTO_SCALE;
      const crop = document.createElement('canvas');
      crop.width = Math.round(sw);
      crop.height = Math.round(sh);
      crop.getContext('2d').drawImage(pages[p], sx, sy, sw, sh, 0, 0, crop.width, crop.height);
      const blob = await new Promise((resolve) => crop.toBlob(resolve, 'image/jpeg', 0.85));
      if (cache) await cache.put(photoKey(id, i + 1), new Response(blob, { headers: { 'Content-Type': 'image/jpeg' } }));
      photoUrls[`${id}-${i + 1}`] = URL.createObjectURL(blob);
    }
  }
  doc.destroy();
}

let photosPromise = null;
// Resolves to true when photos are available. Never rejects.
function loadPhotos({ force = false } = {}) {
  if (photosPromise && !force) return photosPromise;
  photosPromise = (async () => {
    try {
      if (!force && await readCachedPhotos()) return true;
      if (!navigator.onLine) return false;
      await extractPhotos();
      return true;
    } catch (err) {
      console.warn('Could not load exercise photos', err);
      return false;
    }
  })();
  return photosPromise;
}

async function clearPhotos() {
  if ('caches' in window) await caches.delete(PHOTO_CACHE);
  for (const k of Object.keys(photoUrls)) { URL.revokeObjectURL(photoUrls[k]); delete photoUrls[k]; }
  photosPromise = null;
}
