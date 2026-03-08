## Empathy AI – Implementation Plan

This document outlines the next major development steps for Empathy AI, focusing on mood insights, multi-session memory, exportability, guided exercises, personalization, and robustness.

---

## 1. Mood Trend Dashboard (Emotional Pattern Visualization)

### 1.1 Goals
- Provide users with clear visualizations of how their mood and emotions evolve over time.
- Help users notice patterns, triggers, and improvements.

### 1.2 Data model & storage
- Extend Python `users_chat` persistence to store, per message:
  - `dominant_emotion` (e.g., calm, sad, anxious, angry, etc.).
  - Emotion sources: text sentiment, voice emotion, face emotion.
  - Optional intensity/confidence scores.
  - Timestamps (UTC).
- Ensure Node `UsersChat` (session metadata) can reference a canonical `sessionId` that matches Python’s stored conversations.

### 1.3 Backend & API
- Add analytics endpoints (likely in the Python Flask service), e.g.:
  - `GET /mood-trends?user_id=...&range=7d|30d|custom`.
  - Return aggregated, time-bucketed data:
    - Daily dominant emotion.
    - Emotion distribution over time.
    - Streaks (e.g., days feeling mostly “calm”).
- Implement basic filtering (date ranges, session filters).

### 1.4 Frontend UX/UI
- Create a `MoodDashboard` route (e.g. `/mood-dashboard`) with:
  - Line/area charts for mood over time.
  - Bar/pie charts for emotion distribution.
  - Highlight cards for “Most frequent emotion”, “Recent trend”, etc.
- Link from:
  - Chatbot page (e.g. “View Mood Trends” button).
  - User profile or sidebar.

### 1.5 Milestones
- M1: Store full emotion metadata per message in Mongo (Python side).
- M2: Implement aggregation endpoints.
- M3: Build basic charts and integrate into UI.
- M4: Add filters, tooltips, and explanatory copy.

---

## 2. Session History & Persistent Memory Across Sessions

### 2.1 Goals
- Allow users to revisit past sessions with full context.
- Give the AI a richer, session-aware and cross-session memory.

### 2.2 Data model unification
- Define a unified session model:
  - `sessionId`, `userId`, `title`, `createdAt`, `updatedAt`, `summary`, `archived`.
  - Messages array or separate `messages` collection with:
    - `sender` (user/bot), `text`, `dominant_emotion`, timestamps, and metadata.
- Ensure:
  - Node `UsersChat` model and Python `users_chat` collection share/align on `sessionId`.

### 2.3 Backend & API
- Node/Express:
  - Add routes for:
    - `GET /api/chats` – list sessions for current user.
    - `GET /api/chats/:sessionId` – basic metadata and link to full history.
    - `PATCH /api/chats/:sessionId` – rename, archive.
    - `DELETE /api/chats/:sessionId` – delete session metadata and coordinate deletion with Python side.
- Python/Flask:
  - Add endpoints for:
    - `GET /sessions/:sessionId/history` – full ordered conversation.
    - Optional: `POST /sessions/:sessionId/summary` – store or refresh a textual summary.

### 2.4 LLM memory integration
- In `chatbot_response.py`:
  - Load recent messages for the current `sessionId` and feed them into LangChain memory.
  - Optionally:
    - Summarize older messages into a compact “session summary” when the history is long.
    - Use summaries + recent turns in the system prompt to maintain context.

### 2.5 Frontend updates
- Enhance sidebar in `Chatbot`:
  - Show list of sessions with title, last message, timestamp.
  - Allow selecting a session to load full history.
  - Provide rename, delete, and archive options.

### 2.6 Milestones
- M1: Unify session identifiers across Node and Python.
- M2: Implement full-history retrieval and summaries (Python).
- M3: Update sidebar and chat view to support resuming sessions.
- M4: Add basic long-term memory via summaries in LLM prompts.

---

## 3. Chat Export & Share (PDF + Shareable Link)

### 3.1 Goals
- Allow users to export their sessions for offline review or sharing with a therapist.
- Provide a controlled, privacy-aware mechanism for sharing via link.

### 3.2 Backend: Export service
- Implement an export endpoint (in Node or Python; choose one for consistency):
  - `GET /api/chats/:sessionId/export/pdf`
    - Fetch full conversation history.
    - Render to PDF using a PDF generation library.
    - Apply clear formatting (user vs bot, timestamps, session title).
- Ensure:
  - Sensitive internal IDs are not shown.
  - Include disclaimers (not a medical diagnosis).

### 3.3 Backend: Shareable links
- Add a `shareId` or signed token field on sessions:
  - Generated on demand (e.g. `POST /api/chats/:sessionId/share`).
  - Optional expiration and revocation.
- Add a public, read-only endpoint:
  - `GET /shared/:shareId` – returns sanitized HTML or JSON representation of the session.

### 3.4 Frontend UX
- In session actions menu:
  - “Export as PDF” → triggers download.
  - “Get shareable link” → calls share endpoint and shows URL with clear privacy warning.
- Optionally, implement:
  - A simple public read-only view (e.g. `/#/shared/:shareId`) to display shared sessions.

### 3.5 Milestones
- M1: Implement session-to-HTML/PDF renderer.
- M2: Wire PDF export endpoint and UI button.
- M3: Implement share token model and API.
- M4: Add read-only viewer for shared sessions.

---

## 4. Guided Exercise Module

### 4.1 Goals
- Offer structured breathing, grounding, and relaxation activities.
- Let the AI recommend exercises contextually and let users launch them on demand.

### 4.2 Content model
- Define a schema for exercises:
  - `id`, `name`, `type` (breathing, grounding, relaxation), `difficulty`, `duration`.
  - Steps (text, optional audio, animations).
  - Optional triggers (emotions or patterns where it’s appropriate).
- Store exercises either:
  - As JSON seeds in the backend.
  - Or in a small MongoDB collection.

### 4.3 Backend / LLM integration
- Node/Express:
  - Endpoints:
    - `GET /api/exercises` – list all.
    - `GET /api/exercises/:id` – details.
- Python/LLM:
  - Extend system prompt in `chatbot_response.py` so the model:
    - Suggests relevant exercises as part of replies.
    - Uses known exercise IDs/names so frontend can link to structured content.

### 4.4 Frontend UX
- New `GuidedExercises` component:
  - Lists available exercises.
  - Interactive step-by-step flow (timers, progress, animations).
- In chat:
  - Show “Start exercise” buttons when LLM suggests one.
  - Show completion state and optionally log exercise usage.

### 4.5 Tracking & analytics
- Log per exercise instance:
  - `userId`, `exerciseId`, start/end timestamps, completion status.
- Use this for future personalization and insights (e.g., which techniques help most).

### 4.6 Milestones
- M1: Design exercise schema and seed content.
- M2: Implement exercise APIs.
- M3: Build `GuidedExercises` UI and chat integration.
- M4: Log usage and connect to personalization.

---

## 5. Improved Personalization via Long-Term Emotion Tracking

### 5.1 Goals
- Tailor responses, suggestions, and exercises to each user’s long-term patterns.
- Provide users with gentle, non-clinical insights into their emotional trends.

### 5.2 Profile and insights model
- For each user, maintain:
  - Baseline mood profile (most frequent emotions, average sentiment).
  - Recurring topics/themes (via keyword/topic extraction).
  - Exercise preferences and effectiveness (which exercises are used and completed).
- Implement a periodic or on-demand job to update these aggregates.

### 5.3 Personalization engine
- Implement a service layer (Python or Node) to:
  - Generate a compact “personalization summary” per user.
  - Expose it via:
    - `GET /users/:id/personalization-summary` (auth-protected).

### 5.4 LLM prompt integration
- In `chatbot_response.py`:
  - Fetch the user’s personalization summary at the start of a session (or cache).
  - Inject it into the system prompt:
    - Include patterns (e.g., “often reports anxiety at night”), helpful past strategies, and sensitivities.

### 5.5 Frontend insights (optional)
- Add an “Insights” section (profile or dashboard) with:
  - Plain-language summaries: “You often feel most [emotion] on…”
  - Clear disclaimers: not medical advice or diagnosis.

### 5.6 Milestones
- M1: Define and compute personalization metrics.
- M2: Expose personalization summary via API.
- M3: Integrate summary into LLM prompts.
- M4: Build optional user-facing insights UI.

---

## 6. Privacy, Security, and Real-Time Performance

### 6.1 Goals
- Protect user privacy and data rigorously.
- Improve stability and responsiveness of emotion and LLM services.

### 6.2 Secrets & configuration hardening
- Ensure:
  - All secrets (DB URIs, JWT secrets, mail/OAuth credentials, OpenAI key) live only in environment variables or secret managers.
  - `.env` files are git-ignored and never committed.
  - Any currently hard-coded secrets in code are removed and rotated.

### 6.3 API security & validation
- Add:
  - Strict CORS (limit to known client origins).
  - Rate limiting on auth endpoints and ML-heavy endpoints.
  - Input validation and size limits on file uploads (images/audio) to prevent abuse.
  - Sanitized logging (no sensitive content).

### 6.4 Performance optimization
- Python/ML:
  - Lazy-load heavy models (DeepFace, Wav2Vec2, Whisper) on first use.
  - Consider lighter/smaller models where acceptable.
  - Add request timeouts and graceful fallbacks if a model is overloaded.
- Node:
  - Use proper MongoDB connection pooling.
  - Add health-check endpoints (e.g. `/health`) for readiness and liveness.

### 6.5 Monitoring & observability
- Implement:
  - Centralized logging (errors, latency, model load times).
  - Basic metrics dashboards or logs to identify slow endpoints.

### 6.6 Milestones
- M1: Remove hard-coded secrets and tighten CORS.
- M2: Add validation, rate limiting, and upload constraints.
- M3: Optimize model loading and add timeouts.
- M4: Add monitoring and health checks.

---

## 7. Suggested Phasing

- **Phase 1**: Security & performance (Section 6) + session history unification (Section 2).
- **Phase 2**: Mood Trend Dashboard (Section 1) + basic export (PDF only) (Section 3).
- **Phase 3**: Guided Exercise Module and initial personalization (Sections 4 and 5).
- **Phase 4**: Shareable links, public read-only views, and advanced insights UI.

