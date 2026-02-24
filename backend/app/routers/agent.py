import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models, models_agent
from app.routers._deps import get_current_user
from app.db.schemas import AgentRunOut, AgentRunDetailOut
from app.services.agent_runner import run_agent_v1

router = APIRouter(prefix="/agent", tags=["agent"])

class AgentRunListOut(BaseModel):
    id: int
    status: str
    config_id: int
    created_at: str
    summary: Optional[str] = None
    error: Optional[str] = None

@router.post("/run", response_model=AgentRunOut)
def run_agent(config_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    cfg = db.query(models.Config).filter(models.Config.id == config_id, models.Config.user_id == user.id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")

    params = json.loads(cfg.params_json)
    risk = json.loads(cfg.risk_json)
    symbols = [s.strip() for s in cfg.symbols_csv.split(",") if s.strip()]

    agent_run = models_agent.AgentRun(
        user_id=user.id,
        config_id=cfg.id,
        status="running",
        input_json=json.dumps({
            "symbols": symbols,
            "market": cfg.market,
            "interval": cfg.interval,
            "start_date": cfg.start_date,
            "end_date": cfg.end_date,
            "strategy": cfg.strategy,
            "params": params,
            "risk": risk,
        }),
    )
    db.add(agent_run)
    db.commit()
    db.refresh(agent_run)

    try:
        report_json, trace_json = run_agent_v1(
            run_id=agent_run.id,
            config_id=cfg.id,
            symbols=symbols,
            market=cfg.market,
            interval=cfg.interval,
            start_date=cfg.start_date,
            end_date=cfg.end_date,
            strategy=cfg.strategy,
            params=params,
            risk=risk,
            model="gpt-4.1-mini",
        )

        recs = report_json.get("recommendations", [])
        if not isinstance(recs, list) or len(recs) == 0:
            agent_run.status = "failed"
            agent_run.error = "Agent produced empty recommendations."
            agent_run.trace_json = json.dumps(trace_json)
            db.commit()
            raise HTTPException(status_code=500, detail="Agent produced empty recommendations.")

        agent_run.status = "completed"
        agent_run.output_json = json.dumps(report_json)
        agent_run.trace_json = json.dumps(trace_json)
        db.commit()

        return AgentRunOut(id=agent_run.id, status=agent_run.status, config_id=agent_run.config_id, output=report_json)

    except Exception as e:
        agent_run.status = "failed"
        agent_run.error = str(e)
        db.commit()
        raise

@router.get("/{agent_run_id}", response_model=AgentRunDetailOut)
def get_agent_run(agent_run_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    r = db.query(models_agent.AgentRun).filter(models_agent.AgentRun.id == agent_run_id, models_agent.AgentRun.user_id == user.id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Agent run not found")

    return AgentRunDetailOut(
        id=r.id,
        status=r.status,
        config_id=r.config_id,
        input=json.loads(r.input_json or "{}"),
        output=json.loads(r.output_json) if r.output_json else None,
        trace=json.loads(r.trace_json) if r.trace_json else None,
        error=r.error,
    )

@router.get("", response_model=List[AgentRunListOut])
@router.get("/", response_model=List[AgentRunListOut])  # supports trailing slash too
def list_agent_runs(db: Session = Depends(get_db), user=Depends(get_current_user)):
    runs = (
        db.query(models_agent.AgentRun)
        .filter(models_agent.AgentRun.user_id == user.id)
        .order_by(models_agent.AgentRun.id.desc())
        .limit(200)
        .all()
    )

    out = []
    for r in runs:
        summary = None
        if r.output_json:
            try:
                summary = json.loads(r.output_json).get("summary")
            except Exception:
                summary = None

        out.append(AgentRunListOut(
            id=r.id,
            status=r.status,
            config_id=r.config_id,
            created_at=r.created_at.isoformat() if r.created_at else "",
            summary=summary,
            error=r.error,
        ))

    return out