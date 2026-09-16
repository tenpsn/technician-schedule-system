export const environment = {
  production: true,
  apiUrl: '/api',
  // Keep in sync with backend/.env MAX_PHOTO_SIZE_MB (defaults to 10 in
  // backend/middleware/upload.js) — shown as a hint in the photo upload modal.
  photoMaxSizeMb: 10
};
