# MyProfile (React + Vite)

Personal profile app with an AI Assistant for file upload and chat. Built with React 19, Vite, and TailwindCSS.

## Scripts

- `npm run dev`: Start dev server
- `npm run build`: Build for production
- `npm run preview`: Preview built assets
- `npm run lint`: Lint source

## Environment

Create a `.env` file in the project root:

```
VITE_API_URL=http://127.0.0.1:8000
VITE_DEV_MODE=true
# Optional: enable server-side delete for uploaded files
# VITE_DELETE_URL=http://127.0.0.1:8000/delete
```

The AI Assistant uses these endpoints relative to `VITE_API_URL`:
- `POST /upload` — upload a file (PDF, TXT, CSV; max 200MB)
- `POST /get_insights/{fileName}` — initialize chat context for a file
- `POST /chat/{fileName}/{message}` — send a message for a file

If `VITE_DELETE_URL` is provided, deleting a file group in the UI will also send a server request with `{ files: [{ fileId, fileName }] }`.

## Limits (AI Assistant)

- Max 2 successful uploads per session
- Max 3 distinct files kept in the list
- Max 5 attempts per file (retries allowed)
- Allowed types: PDF, TXT, CSV

## Deployment

Configured for GitHub Pages:
- `vite.config.js` uses `base: '/MyProfile/'`
- `package.json` `homepage` points to the Pages URL
