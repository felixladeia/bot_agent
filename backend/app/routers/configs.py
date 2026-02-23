import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.db.schemas import ConfigCreate, ConfigOut
from app.routers._deps import get_current_user

router = APIRouter(prefix="/configs", tags=["configs"])

@router.get("", response_model=list[ConfigOut])
def list_configs(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = db.query(models.Config).filter(models.Config.user_id == user.id).order_by(models.Config.id.desc()).all()
    out = []
    for r in rows:
        out.append(ConfigOut(
            id=r.id,
            name=r.name,
            market=r.market,
            interval=r.interval,
            strategy=r.strategy,
            params=json.loads(r.params_json),
            risk=json.loads(r.risk_json),
            symbols=[s.strip() for s in r.symbols_csv.split(",") if s.strip()],
            start_date=r.start_date,
            end_date=r.end_date,
        ))
    return out

@router.post("", response_model=ConfigOut)
def create_config(payload: ConfigCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = models.Config(
        user_id=user.id,
        name=payload.name,
        strategy=payload.strategy,
        params_json=json.dumps(payload.params),
        risk_json=json.dumps(payload.risk),
        symbols_csv=",".join(payload.symbols),
        start_date=payload.start_date,
        end_date=payload.end_date,
        market=payload.market,
        interval=payload.interval,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ConfigOut(
        id=row.id,
        name=row.name,
        market=row.market,
        interval=row.interval,
        strategy=row.strategy,
        params=payload.params,
        risk=payload.risk,
        symbols=payload.symbols,
        start_date=row.start_date,
        end_date=row.end_date,
    )

@router.get("/{config_id}", response_model=ConfigOut)
def get_config(config_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    r = db.query(models.Config).filter(models.Config.id == config_id, models.Config.user_id == user.id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Config not found")
    return ConfigOut(
        id=r.id,
        name=r.name,
        market=r.market,
        interval=r.interval,
        strategy=r.strategy,
        params=json.loads(r.params_json),
        risk=json.loads(r.risk_json),
        symbols=[s.strip() for s in r.symbols_csv.split(",") if s.strip()],
        start_date=r.start_date,
        end_date=r.end_date,
    )