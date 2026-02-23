from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.db.schemas import AdminUserOut
from app.routers._deps import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

def require_admin(user):
    if not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin privileges required")

@router.get("/users", response_model=list[AdminUserOut])
def list_users(db: Session = Depends(get_db), user=Depends(get_current_user)):
    require_admin(user)
    rows = db.query(models.User).order_by(models.User.id.asc()).all()
    return [AdminUserOut(id=u.id, email=u.email, is_admin=u.is_admin) for u in rows]