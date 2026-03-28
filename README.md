# 🦀 CRAB: Comprehensive Relational Analyzer and Builder

**CRAB** is an advanced, multi-agent data intelligence platform designed to ingest, analyze, and visualize complex relational datasets. Built with a focus on high-performance agentic workflows and a striking neo-brutalist aesthetic, CRAB transforms raw data into actionable architectural insights through automated relationship discovery and conversational AI.

---

## 📸 System Preview

> [!TIP]
> *Insert high-resolution screenshots here to showcase the Neo-Brutalist UI and Topology Graphs.*

| Dashboard Overview | AI Agent Interface |
| :---: | :---: |
| ![Dashboard Placeholder](https://via.placeholder.com/800x450?text=CRAB+Dashboard+Preview) | ![Chat Placeholder](https://via.placeholder.com/800x450?text=CRAB+AI+Agent+Preview) |

---

## 🚀 Key Features

### 1. Multi-Agent AI Engine (LangGraph)
- **Specialized Nodes:** Dedicated agents for Statistical Analysis, Outlier Detection, Plotting, and Data Comparison.
- **Contextual Memory:** RAM-persistent state allows the AI to remember conversation history for deep follow-up queries.
- **Dynamic Routing:** Intelligent intent classification to send your request to the most qualified sub-agent.

### 2. Automated Relational Discovery
- **BID Algorithm:** Proprietary deterministic logic to detect Primary/Foreign Key relationships across multiple datasets.
- **Topology Mapping:** Interactive 2D Force-Graph visualization of your system's data architecture.
- **Schema Depth Code:** Automatic classification of schema complexity (D1 to D3).

### 3. Data Dictionary & Profiling
- **Deep Metadata:** Instant extraction of column types, null percentages, unique counts, and statistical ranges.
- **JSON Export:** Download your entire data dictionary for documentation or external integration.

### 4. Enterprise-Grade Security
- **JWT Authentication:** Secure access control via Django REST Framework.
- **System Backups:** Integrated full-system redundancy with automated history logging.

---

## 🛠 Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Framer Motion, React Force Graph.
- **AI Core:** FastAPI, LangChain, LangGraph, Pandas, Matplotlib, Seaborn.
- **Backend Infrastructure:** Django, PostgreSQL/SQLite, DRF.
- **AI Model:** GPT-4o-mini (via OpenRouter).

---

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- OpenRouter API Key

### 1. Clone & Configure
```bash
git clone https://github.com/your-repo/crab.git
cd crab
```

### 2. Backend (Django)
```bash
cd backend_django
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 3. AI Engine (FastAPI)
```bash
cd ai_engine
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
# Add OPENROUTER_API_KEY to your .env
python -m app.main
```

### 4. Frontend (Vite)
```bash
cd frontend
npm install
npm run dev
```

---

## 🎨 Design Philosophy
CRAB utilizes a **Neo-Brutalist** design system:
- **High Contrast:** Pure black (#1A1A1A) and white (#FFFFFF) palette.
- **Raw Geometry:** Heavy 4px-8px borders and sharp "hard-shadows" (6px-12px offsets).
- **Typography:** Mix of sans-serif headings and monospace data readouts for a "terminal-pro" feel.
- **Accent:** CRAB Red (#FF3B30) used sparingly for critical insights and calls to action.

---

## 🗺 Roadmap
- [ ] Multi-tenant data isolation.
- [ ] Real-time SQL database live-sync.
- [ ] Advanced 3D Topology Visualization.
- [ ] Automated PDF Data Audit generation.

---

© 2026 CRAB DATA SYSTEMS • Built for the next generation of data architects.
