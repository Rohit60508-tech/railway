# 🚆 Raksha Path — Live API Architecture & Key Setup Guide

This guide documents every external API integrated across the **Raksha Path (Indian Railways Maintenance & AI Block Scheduling Platform)**, how live data powers each module, free alternative options, and exact step-by-step instructions for acquiring API keys.

---

## 🗺️ System API Architecture Map

| # | Subsystem / Feature | External API | What It Powers in Live Mode | Code Location | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | **Live Train Tracking & NTES Delays** | **Indian Railway IRCTC / NTES API** (RapidAPI) | Real-time GPS station locations, live delay minutes, dynamic headway gap calculations, and timetable clash detection | `ai-models/traffic_predictor/live_train_service.py`, `server.js` | 🟢 Active |
| **2** | **Meteorological & Rail Surface Temperature** | **Open-Meteo Satellite API** (Free) + **OpenWeatherMap** | Live ambient temperature, humidity, IRPWM Para 602 steel rail thermal expansion, and fog visibility alerts | `ai-models/traffic_predictor/live_train_service.py` (`get_live_weather`) | 🟢 Active |
| **3** | **Multi-Department Handshake & Persistence** | **Supabase Postgres Database & Realtime** | Real-time Civil, TRD, and Signal sign-off handshake matrix, work orders, and audit trail ledger | `server.js`, `frontend/pages/maintenance-dashboard.html` | 🟢 Active |
| **4** | **AI Dispatcher Reasoning & Rationale** | **Local Ollama** (`qwen2.5` / `llama3.2`) or **Groq / OpenAI API** | Plain-English explanations for why specific Night Shadow slots (`01:30–04:30`) were chosen | `ai-models/traffic_predictor/live_train_service.py`, `ai-models/inference/ollama_api.py` | 🟢 Active |
| **5** | **Geospatial Track & Asset Mapping** | **Leaflet / OpenStreetMap (Free)** + **Mapbox GL JS** | Live train moving markers, defect KM pole pins, and section bounding boxes | `frontend/pages/surveillance-dashboard.html`, `frontend/pages/control-office.html` | 🟢 Active |

---

## 📋 Step-by-Step Guide to Obtain API Keys

### 1. Indian Railway / NTES Live Train API (RapidAPI)
1. Visit [RapidAPI Sign Up](https://rapidapi.com/auth/sign-up) and create an account (using Google or GitHub).
2. In the top search bar, search for `Indian Railway IRCTC` and choose **"IRCTC Indian Railway"** (by Ashish Goel or RailRadar).
3. Under the **Pricing** tab, subscribe to the **Basic (Free)** plan ($0/month).
4. Go to the **Endpoints** tab, find `X-RapidAPI-Key` in the right-hand code snippet panel, and copy your key.
5. **Configuration:** Add to your `.env` or `ai-models/traffic_predictor/live_train_service.py`:
   ```env
   RAPIDAPI_KEY=your_rapidapi_key_here
   ```
* **Free Alternatives:**
  * Open NTES / ConfirmTkt scraped proxy endpoints (no key needed).
  * [Data.gov.in](https://data.gov.in) open train timetable schedules.

---

### 2. Live Weather & Rail Temperature
#### Option A: Open-Meteo (Recommended — 100% Free, Zero Key Needed)
* Already active in the platform! Direct requests are made to:
  `https://api.open-meteo.com/v1/forecast?latitude=28.6139&longitude=77.2090&current_weather=true`

#### Option B: OpenWeatherMap (Free Tier)
1. Go to [OpenWeatherMap Sign Up](https://home.openweathermap.org/users/sign_up) and create an account.
2. Verify your email address.
3. In your dashboard, click your username in the top right → select **"My API Keys"**.
4. Copy the default API key generated.
5. **Configuration:** Add to `.env`:
   ```env
   OPENWEATHER_API_KEY=your_openweather_key_here
   ```

---

### 3. Database & Realtime Multi-Department Sync (Supabase)
1. Go to [Supabase](https://supabase.com) and click **Start your project** (Sign in with GitHub).
2. Click **"New Project"**, name it `railway-raksha-path`, set a database password, and choose your preferred region (e.g., `Mumbai / South Asia`).
3. Once provisioned, click **Project Settings** (gear icon on bottom left) → **API**.
4. Copy the **Project URL** and the **`service_role` (Secret)** key.
5. **Configuration:** Add to `.env`:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
* **Free Alternatives:**
  * Local PostgreSQL with `pg_notify` / WebSockets.
  * [PocketBase](https://pocketbase.io) (Self-hosted single executable).

---

### 4. AI Controller Rationale & Dispatcher LLM
#### Option A: Groq Cloud (Free Tier & Ultra-Fast)
1. Go to [Groq Console](https://console.groq.com) and sign in with Google/GitHub.
2. Click **API Keys** on the left navigation bar → click **"Create API Key"**.
3. Copy the key (`gsk_...`).
4. **Configuration:** Add to `.env`:
   ```env
   GROQ_API_KEY=gsk_your_groq_key_here
   ```

#### Option B: Google Gemini API (Free Tier)
1. Go to [Google AI Studio](https://aistudio.google.com).
2. Sign in with your Google account.
3. Click **"Get API key"** → **"Create API key in new project"** and copy the key.

#### Option C: Ollama (100% Offline / Local, No Key Required)
1. Download Ollama from [ollama.com](https://ollama.com).
2. Run in terminal: `ollama run qwen2.5` or `ollama run llama3.2`.
3. The server runs automatically on `http://localhost:11434` without internet or keys.

---

### 5. Geospatial Track & Map Tiles
#### Option A: OpenStreetMap (OSM) via Leaflet (Default — 100% Free)
* Pre-configured and active in `frontend/pages/surveillance-dashboard.html` and `control-office.html`. No API key required.

#### Option B: Mapbox GL JS (Custom Dark Satellite Tiles)
1. Go to [Mapbox Sign Up](https://account.mapbox.com/auth/signup/) and register a free account.
2. From your account dashboard, copy the **Default public token** (`pk.eyJ1...`).
3. **Configuration:** Add to `.env`:
   ```env
   MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token_here
   ```
