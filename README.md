Empathy AI — Project README

This repository contains a mental-health therapy chatbot project with a Node.js backend, a Python (Flask) ML/LLM API, and a React frontend. Below are minimal setup and run instructions for the `backend` and `api` services plus sanitized `.env` examples.

## Prerequisites

- Node.js 16+ / 18+ (for `backend`)
- Python 3.10+ (for `api`)
- MongoDB (Atlas or local)
- Git

---

## Backend (Node/Express)

Path: `backend`

1. Install dependencies

```bash
cd backend
npm install
```

2. Create `.env` from the example

Copy `backend/.env-example` to `backend/.env` and fill values.

3. Run the server (common options)

```bash
# development (if package.json has a dev script)
npm run dev

# or start directly
node index.js
```

Ports: default `PORT=3000` (set in `.env`).

---

## API (Python / Flask)

Path: `api`

1. Create and activate a virtual environment

Windows PowerShell
```powershell
cd api
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

macOS / Linux
```bash
cd api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. Create `.env` from the example

Copy `api/.env-example` to `api/.env` and fill values.

3. Run the Flask API

```bash
# start directly
python app.py

# OR using flask (if app configured with FLASK_APP)
flask run --host=127.0.0.1 --port=5001
```

Default port: `5001`.

---

## `.env` examples (sanitized)

Use these example files as templates — do NOT commit real secrets to source control.

### `backend/.env-example`

```
# Backend service (Node)
PORT=3000
MONGO_URI=<your-mongodb-uri>
JWT_SECRET=<your-jwt-secret>
EMAIL_USER=<smtp-user@example.com>
EMAIL_PASS=<smtp-password>
CLIENT_URL=http://localhost:5173
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
```

### `api/.env-example`

```
# Python API (Flask)
PORT=5001
MONGO_URI=<your-mongodb-uri>
OPENAI_API_KEY=<openai-api-key>
CHAT_ENCRYPTION_PASSPHRASE=<encryption-passphrase>
JWT_SECRET=<jwt-secret>
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
MAX_CONTENT_LENGTH=10485760
MODEL_TIMEOUT_SECONDS=12
ML_RATE_LIMIT_MAX=120
ML_RATE_LIMIT_WINDOW_SECONDS=60
FLASK_USE_RELOADER=0
```

---

## Notes & Tips

- Always keep `.env` out of version control (add to `.gitignore`).
- Start MongoDB (or confirm Atlas connection) before running services.
- If models (DeepFace, Whisper) are used, first run the API once to allow lazy model download; ensure enough disk and memory.
- For production, use proper secret management (vault, environment provisioning), HTTPS, and a process manager (PM2, systemd, or container orchestration).

---

If you want, I can also populate `backend/.env-example` and `api/.env-example` files in the repository now (sanitized). Tell me to proceed and I'll add them.
