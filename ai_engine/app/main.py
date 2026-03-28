from fastapi import FastAPI
from app.routes import ai
from app.services.dictionary import init_dict_db

app = FastAPI()

# Initialize Persistent DBs
init_dict_db()

app.include_router(ai.router, prefix="/ai")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)