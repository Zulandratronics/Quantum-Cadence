# Quantum Cadence

An AI-assisted song and album analysis framework for artists and researchers, built with React, TypeScript, Vite, D3, and the Google Gemini API.

## Features

- **Song Analysis** (components/SongAnalysis.tsx): Deep single-track breakdown with interactive D3 visualizers and PDF export.
- **Album Session Review** (components/AlbumSessionReview.tsx, components/AlbumArcVisualizer.tsx): Multi-track album session analysis and macro energy-arc visualization.
- **Audio Transcriber** (components/Transcriber.tsx): Audio/microphone transcription workflow.
- **Critique Simulator** (components/CritiqueSimulator.tsx): Simulated multi-perspective creative critiques.
- **AI Creative Partner** (components/Chatbot.tsx): Interactive chat workspace for songwriting and arrangement feedback.

## Local Setup

**Prerequisites:** Node.js 20+ and a Google Gemini API key.

1. Install dependencies:
   `ash
   npm install
   `
2. Create .env.local in the project root:
   `env
   GEMINI_API_KEY=your_gemini_api_key_here
   `
3. Start the local dev server:
   `ash
   npm run dev
   `
4. Type-check with:
   `ash
   npm run lint
   `

> **Security Note:** ite.config.ts currently injects GEMINI_API_KEY into the frontend bundle via Vite define for local development. Do **not** deploy a static production build with your key embedded — route Gemini API calls through a backend proxy first.

## License

MIT — see [LICENSE](./LICENSE).