from fastapi import APIRouter, Depends
from app.routers._deps import get_current_user
from app.db.schemas import MeOut

router = APIRouter(prefix="", tags=["me"])

@router.get("/me", response_model=MeOut)
def me(user=Depends(get_current_user)):
    return MeOut(id=user.id, email=user.email, is_admin=user.is_admin)