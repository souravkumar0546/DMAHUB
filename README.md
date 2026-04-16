# Data Transformation Agent Hub

AI-powered platform for data management — deduplication, classification, enrichment, profiling, and more.

**Tech stack:** FastAPI (Python) backend, React + Vite frontend, scikit-learn for similarity, Azure OpenAI for AI reasoning. Built using Claude Code.

---

## Prerequisites

- Python 3.9+
- Node.js 18+ and npm

---

## Backend

```bash
cd backend
```

### 1. Create a virtual environment

```bash
python -m venv venv
```

### 2. Activate the virtual environment

**macOS / Linux:**

```bash
source venv/bin/activate
```

**Windows (PowerShell):**

```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (if scripts are restricted):** skip activation and use full paths instead:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the `backend/` directory:

```
AZURE_OPENAI_ENDPOINT=<your-azure-openai-endpoint>
AZURE_OPENAI_API_KEY=<your-azure-openai-api-key>
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_OPENAI_MODEL=gpt-4o-mini
```

### 5. Run the backend

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API is now available at `http://localhost:8000/api`.

---

## Frontend

```bash
cd frontend
```

### 1. Install dependencies

```bash
npm install
```

### 2. Run the dev server

```bash
npm run dev
```

The app opens at `http://localhost:5173`.

### 3. Build for production

```bash
npm run build
```

The production-ready files are output to `frontend/dist/`.

---

## Running both together (production)

To serve the frontend and backend from a single process (no separate dev server needed):

```bash
cd backend
uvicorn serve:app --host 0.0.0.0 --port 8000
```

This serves the React build from `frontend/dist/` and proxies `/api/*` to FastAPI — all on one port. Open `http://localhost:8000`.

> **Note:** Run `npm run build` in the `frontend/` directory first so the `dist/` folder is up to date.

---

## Project Structure

```
DMAhub/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── routes/            # API route handlers
│   │   ├── services/          # Business logic & AI integration
│   │   └── schemas/           # Request/response schemas
│   ├── serve.py               # Combined frontend + backend server
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── src/
    │   ├── App.jsx            # Main app with tabs (Agents / Orchestration / Connectors)
    │   ├── api.js             # Axios API client
    │   ├── pages/             # Page components per agent
    │   └── components/        # Shared UI components
    ├── dist/                  # Production build output
    ├── package.json
    └── vite.config.js
```
