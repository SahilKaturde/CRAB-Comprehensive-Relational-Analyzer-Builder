# AI Full Stack Project 🚀

## Tech Stack
- React (Vite)
- Django (Backend)
- FastAPI (AI Engine)

## Run Instructions

### Frontend
npm install
npm run dev

### Django
cd backend_django
python -m venv venv
pip install -r requirements.txt
python manage.py runserver

### FastAPI
cd ai_engine
python -m venv venv
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
