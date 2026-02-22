# Archvision

An AI-powered interior design studio. Describe a room through conversation, generate photorealistic 2D renderings, then convert them into interactive 3D spatial models — all in one workspace.

---

## Features

- **Conversational design** — Chat with an AI architect (Gemini) to define room specs, style, materials, and budget
- **2D rendering** — Generate photorealistic images from the conversation via Nano Banana
- **Approve & iterate** — Like images to approve them, or send feedback to regenerate
- **3D model generation** — Convert approved 2D designs into full 3D scenes via World Labs (Marble)
- **Interactive 3D viewer** — Explore generated rooms with Gaussian splatting and camera controls
- **Spec generation** — Generate a technical specification document from the design conversation
- **Project & room management** — Organize multiple homes and rooms per project
- **Whole-home reports** — Zoning and technical info reports across all rooms in a project

---

## Tech Stack

### Frontend
| | |
|---|---|
| Framework | React 19 + Vite |
| Routing | React Router DOM 7 |
| Styling | Tailwind CSS 4 |
| 3D Rendering | Three.js + Gaussian Splats 3D |
| Auth / DB | Firebase (Auth, Firestore, Storage) |
| HTTP | Axios |

### Backend
| | |
|---|---|
| Framework | FastAPI + Uvicorn |
| AI (chat) | Google Gemini API |
| Image gen | Nano Banana |
| 3D gen | World Labs / Marble API |
| Database | Firebase Firestore |
| Storage | Firebase Storage |
| Config | Pydantic Settings |

---

## Project Structure

```
Ironsite/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── pages/           # Route-level page components
│       ├── components/      # Reusable UI components
│       │   ├── chat/        # Chat window, input, status
│       │   ├── viewer/      # 2D image viewer, 3D viewer
│       │   ├── layout/      # Navbar, layout wrappers
│       │   ├── projects/    # Project list/cards
│       │   ├── rooms/       # Room list/cards
│       │   └── shared/      # Spinners, modals, etc.
│       ├── context/         # React context (auth)
│       ├── hooks/           # useChat, usePollJob, etc.
│       ├── services/        # Axios API client
│       └── utils/           # Constants, helpers
│
└── server/                  # Python FastAPI backend
    └── app/
        ├── routers/         # API route handlers
        ├── services/        # Gemini, WorldLabs, Firestore, etc.
        ├── models/          # Pydantic request/response models
        └── prompts/         # LLM system prompts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- A Firebase project (Firestore + Storage + Auth enabled)
- API keys for Gemini, World Labs, and Nano Banana

### Backend

```bash
cd server
pip install -r requirements.txt
```

Create `server/.env`:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=serviceAccountKey.json
FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com
GEMINI_API_KEY=your_gemini_key
WORLDLABS_API_KEY=your_worldlabs_key
CORS_ORIGINS=http://localhost:5173
```

Place your Firebase service account JSON at `server/serviceAccountKey.json`.

```bash
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd client
npm install
```

Create `client/.env.local`:

```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_BASE_URL=http://localhost:8000
```

```bash
npm run dev       # Dev server at http://localhost:5173
npm run build     # Production build
npm run lint      # ESLint
```

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/projects` | List / create projects |
| `GET/PUT/DELETE` | `/projects/{id}` | Get / update / delete a project |
| `GET/POST` | `/projects/{id}/rooms` | List / create rooms |
| `GET/PUT` | `/projects/{id}/rooms/{id}` | Get / update a room |
| `POST` | `/chat` | Send a chat message (streaming SSE) |
| `GET` | `/messages/{roomId}` | Fetch message history |
| `POST` | `/generate/2d` | Trigger 2D image generation |
| `POST` | `/generate/3d` | Trigger 3D model generation |
| `POST` | `/generate/artifact` | Generate a spec document |
| `GET` | `/generate/3d/export-bundle/{projectId}/{roomId}` | Download full 3D asset bundle |
| `GET` | `/health` | Health check |

---

## Workspace Flow

```
1. Create project → add room
2. Chat with AI about the room design
3. AI triggers 2D image generation
4. Approve images you like
5. Click "Final Render" or "Quick 3D" to generate a 3D model
6. Explore the room in the interactive 3D viewer
7. Click "Generate Spec" to produce a technical spec from the conversation
```
