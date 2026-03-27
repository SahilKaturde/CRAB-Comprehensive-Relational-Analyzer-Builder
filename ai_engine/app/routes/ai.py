from fastapi import APIRouter

router = APIRouter()

@router.get("/test")
def test_fastapi():
    return {"message": "FastAPI connected successfully 🚀"}