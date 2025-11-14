# Vercel Serverless Functions

This directory contains serverless functions that run on Vercel.

## `/api/openai.js`

OpenAI API proxy to avoid CORS issues when calling OpenAI from the frontend.

### Why?

- OpenAI's API doesn't allow direct calls from browsers (CORS policy)
- Keeps API keys secure on the server side
- Provides a clean interface for the frontend

### How it works:

1. Frontend calls `/api/openai` with messages and API key
2. Serverless function forwards request to OpenAI API
3. Response is returned to frontend

### Testing locally:

```bash
# Install Vercel CLI globally
npm install -g vercel

# Run Vercel dev server
vercel dev

# The API will be available at: http://localhost:3000/api/openai
```

### Deployment:

When you deploy your app to Vercel, this function will be automatically deployed as a serverless function.

```bash
vercel deploy
```

The function will be available at `https://your-app.vercel.app/api/openai`






