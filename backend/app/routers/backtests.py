import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.db.schemas import BacktestRunOut, TradeOut, BacktestRunListOut
from app.routers._deps import get_current_user
from app.services.data_provider import CsvDataProvider
from app.services.yfinance_provider import YFinanceDataProvider
from app.services.backtester import run_backtest_for_symbol, aggregate_metrics

router = APIRouter(prefix="/backtests", tags=["backtests"])

@router.post("/run", response_model=BacktestRunOut)
def run_backtest(config_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    cfg = db.query(models.Config).filter(models.Config.id == config_id, models.Config.user_id == user.id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")

    params = json.loads(cfg.params_json)
    risk = json.loads(cfg.risk_json)
    symbols = [s.strip() for s in cfg.symbols_csv.split(",") if s.strip()]

    #provider = CsvDataProvider(base_path="data")  # MVP: put CSVs in backend/data/
    provider = YFinanceDataProvider()

    per_symbol_metrics = []
    all_trades = []
    curves = {}  # symbol -> curve

    for sym in symbols:
        #md = provider.get_ohlcv(sym, cfg.start_date, cfg.end_date)
        md = provider.get_ohlcv(sym, cfg.start_date, cfg.end_date, interval=cfg.interval)
        #metrics, trades, curve = run_backtest_for_symbol(sym, md.df, cfg.strategy, params, risk)
        metrics, trades, curve = run_backtest_for_symbol(
            sym, md.df, cfg.strategy, params, risk, market=cfg.market, interval=cfg.interval
        )
        per_symbol_metrics.append(metrics)
        all_trades.extend(trades)
        curves[sym] = curve

    metrics = aggregate_metrics(per_symbol_metrics)

    run = models.BacktestRun(
        user_id=user.id,
        config_id=cfg.id,
        status="completed",
        metrics_json=json.dumps(metrics),
        equity_json=json.dumps(curves),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # store trades
    for t in all_trades:
        db.add(models.Trade(
            run_id=run.id,
            symbol=t.symbol,
            timestamp=t.timestamp,
            side=t.side,
            qty=t.qty,
            price=t.price,
            fee=t.fee,
            slippage=t.slippage,
            pnl=t.pnl,
            decision_trace_json=json.dumps(t.decision_trace),
        ))
    db.commit()

    return BacktestRunOut(id=run.id, status=run.status, config_id=run.config_id, metrics=metrics)

@router.get("/{run_id}/results", response_model=BacktestRunOut)
def get_results(run_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    run = db.query(models.BacktestRun).filter(models.BacktestRun.id == run_id, models.BacktestRun.user_id == user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return BacktestRunOut(
        id=run.id, status=run.status, config_id=run.config_id, metrics=json.loads(run.metrics_json)
    )

@router.get("/{run_id}/trades", response_model=list[TradeOut])
def get_trades(run_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    run = db.query(models.BacktestRun).filter(models.BacktestRun.id == run_id, models.BacktestRun.user_id == user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    trades = db.query(models.Trade).filter(models.Trade.run_id == run.id).order_by(models.Trade.id.asc()).all()
    return [TradeOut(
        id=t.id, symbol=t.symbol, timestamp=t.timestamp, side=t.side, qty=t.qty, price=t.price,
        fee=t.fee, slippage=t.slippage, pnl=t.pnl
    ) for t in trades]

@router.get("/{run_id}/explain/{trade_id}")
def explain_trade(run_id: int, trade_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    run = db.query(models.BacktestRun).filter(models.BacktestRun.id == run_id, models.BacktestRun.user_id == user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    trade = db.query(models.Trade).filter(models.Trade.id == trade_id, models.Trade.run_id == run.id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return {"trade_id": trade.id, "decision_trace": json.loads(trade.decision_trace_json)}

@router.get("/{run_id}/equity")
def get_equity(run_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    run = db.query(models.BacktestRun).filter(models.BacktestRun.id == run_id, models.BacktestRun.user_id == user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"run_id": run.id, "equity": json.loads(run.equity_json)}

@router.get("", response_model=list[BacktestRunListOut])
def list_runs(db: Session = Depends(get_db), user=Depends(get_current_user)):
    runs = (
        db.query(models.BacktestRun)
        .filter(models.BacktestRun.user_id == user.id)
        .order_by(models.BacktestRun.id.desc())
        .limit(200)
        .all()
    )
    out = []
    for r in runs:
        out.append({
            "id": r.id,
            "status": r.status,
            "config_id": r.config_id,
            "created_at": r.created_at.isoformat() if r.created_at else "",
            "metrics": json.loads(r.metrics_json) if r.metrics_json else {},
        })
    return out