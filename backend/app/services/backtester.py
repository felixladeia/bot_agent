import json
from dataclasses import dataclass
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd

from app.services.strategies import get_strategy

@dataclass
class TradeRecord:
    symbol: str
    timestamp: str
    side: str
    qty: float
    price: float
    fee: float
    slippage: float
    pnl: float
    decision_trace: Dict[str, Any]

def run_backtest_for_symbol(
    symbol: str,
    df: pd.DataFrame,
    strategy_name: str,
    params: Dict[str, Any],
    risk: Dict[str, Any],
    market: str,
    interval: str,
) -> Tuple[Dict[str, Any], List[TradeRecord], List[Dict[str, Any]]]:
    """
    Very simple, single-position, long-only backtest.
    risk:
      - initial_cash
      - risk_fraction (fraction of equity to allocate on entry)
      - fee_bps
      - slippage_bps
    """
    strat = get_strategy(strategy_name)
    df = strat.prepare(df, params)

    initial_cash = float(risk.get("initial_cash", 10_000))
    risk_fraction = float(risk.get("risk_fraction", 1.0))
    fee_bps = float(risk.get("fee_bps", 1.0))        # 1 bp = 0.01%
    slippage_bps = float(risk.get("slippage_bps", 2.0))

    cash = initial_cash
    qty = 0.0
    entry_price = None
    trades: List[TradeRecord] = []
    equity_curve = []

    state: Dict[str, Any] = {"position_qty": 0.0, "prev_sma_fast": None, "prev_sma_slow": None}

    for i, row in df.iterrows():
        price = float(row["close"])
        ts = str(pd.to_datetime(row["timestamp"]).isoformat())

        # Decide
        signal = strat.decide(row, state, params)

        # Update cross memory if present
        if "sma_fast" in row and "sma_slow" in row:
            try:
                state["prev_sma_fast"] = None if pd.isna(row["sma_fast"]) else float(row["sma_fast"])
                state["prev_sma_slow"] = None if pd.isna(row["sma_slow"]) else float(row["sma_slow"])
            except Exception:
                pass

        fee = 0.0
        slip = 0.0
        pnl = 0.0

        if signal.action == "BUY" and qty <= 0:
            alloc = (cash + qty * price) * risk_fraction
            buy_qty = alloc / price if price > 0 else 0.0

            slip = price * (slippage_bps / 10_000.0)
            exec_price = price + slip
            fee = (buy_qty * exec_price) * (fee_bps / 10_000.0)

            cost = buy_qty * exec_price + fee
            if cost <= cash and buy_qty > 0:
                cash -= cost
                qty += buy_qty
                entry_price = exec_price

                trades.append(TradeRecord(
                    symbol=symbol, timestamp=ts, side="BUY", qty=buy_qty, price=exec_price,
                    fee=fee, slippage=slip, pnl=0.0,
                    decision_trace={"action": "BUY", **signal.reason, "exec_price": exec_price, "fee": fee, "slippage": slip},
                ))

        elif signal.action == "SELL" and qty > 0:
            slip = price * (slippage_bps / 10_000.0)
            exec_price = price - slip
            fee = (qty * exec_price) * (fee_bps / 10_000.0)

            proceeds = qty * exec_price - fee
            cash += proceeds

            if entry_price is not None:
                pnl = (exec_price - entry_price) * qty - fee
            else:
                pnl = 0.0

            trades.append(TradeRecord(
                symbol=symbol, timestamp=ts, side="SELL", qty=qty, price=exec_price,
                fee=fee, slippage=slip, pnl=pnl,
                decision_trace={"action": "SELL", **signal.reason, "exec_price": exec_price, "fee": fee, "slippage": slip, "pnl": pnl},
            ))

            qty = 0.0
            entry_price = None

        equity = cash + qty * price
        #equity_curve.append(equity)
        equity_curve.append({"t": ts, "equity": float(equity)})
        state["position_qty"] = qty

    # total_return = (equity_curve[-1] / initial_cash - 1.0) if equity_curve else 0.0
    # metrics = {
    #     "symbol": symbol,
    #     "initial_cash": initial_cash,
    #     "final_equity": equity_curve[-1] if equity_curve else initial_cash,
    #     "total_return": total_return,
    #     "num_trades": len(trades),
    # }
    # curve = [{"t": str(pd.to_datetime(df.loc[i, "timestamp"]).date()), "equity": float(e)} for i, e in enumerate(equity_curve)]
    #return metrics, trades, curve
    final_equity = equity_curve[-1]["equity"] if equity_curve else initial_cash
    total_return = (final_equity / initial_cash - 1.0) if equity_curve else 0.0

    rf_annual = float(risk.get("risk_free_rate_annual", 0.0) or 0.0)
    #ann = annualization_factor(risk.get("market", "crypto"), risk.get("interval", "1h"))
    ann = annualization_factor(market, interval)
    rf_annual = float(risk.get("risk_free_rate_annual", 0.0) or 0.0)
    eq_metrics = compute_equity_metrics(equity_curve, annualization=ann, risk_free_rate_annual=rf_annual)
    #eq_metrics = compute_equity_metrics(equity_curve, annualization=252, risk_free_rate_annual=rf_annual)
    tr_metrics = compute_trade_metrics(trades)

    metrics = {
        "symbol": symbol,
        "initial_cash": initial_cash,
        "final_equity": final_equity,
        "total_return": total_return,
        "num_trades": len(trades),

        # equity curve metrics
        **eq_metrics,

        # trade metrics (SELL legs / round trips)
        **tr_metrics,
    }
    return metrics, trades, equity_curve


def aggregate_metrics(per_symbol: list[dict]) -> dict:
    if not per_symbol:
        return {"avg_total_return": 0.0, "num_trades": 0, "symbols": []}

    def avg(key: str) -> float:
        vals = [_safe_float(m.get(key, 0.0)) for m in per_symbol]
        return float(np.mean(vals)) if vals else 0.0

    total_trades = int(sum(int(m.get("num_trades", 0)) for m in per_symbol))
    total_round_trips = int(sum(int(m.get("round_trips", 0)) for m in per_symbol))
    total_realized = float(sum(_safe_float(m.get("total_realized_pnl", 0.0)) for m in per_symbol))

    # profit factor is not additive; report average PF and also overall PF from summed profits/losses if present
    avg_pf = avg("profit_factor")

    return {
        "avg_total_return": avg("total_return"),
        "avg_cagr": avg("cagr"),
        "avg_volatility": avg("volatility"),
        "avg_sharpe": avg("sharpe"),
        "avg_sortino": avg("sortino"),
        "avg_max_drawdown": avg("max_drawdown"),

        "num_trades": total_trades,
        "round_trips": total_round_trips,
        "total_realized_pnl": total_realized,
        "avg_profit_factor": avg_pf,
        "avg_win_rate": avg("win_rate"),
        "symbols": per_symbol,
    }


def _safe_float(x, default=0.0):
    try:
        if x is None:
            return default
        return float(x)
    except Exception:
        return default

def compute_equity_metrics(
    equity_curve: list[dict],
    annualization: int = 252,
    risk_free_rate_annual: float = 0.0,
) -> dict:
    """
    equity_curve: [{"t": iso_timestamp, "equity": float}, ...] in chronological order
    """
    if not equity_curve or len(equity_curve) < 2:
        return {
            "cagr": 0.0,
            "volatility": 0.0,
            "sharpe": 0.0,
            "sortino": 0.0,
            "max_drawdown": 0.0,
        }

    eq = np.array([_safe_float(p["equity"]) for p in equity_curve], dtype=float)
    # guard against zeros
    eq = np.where(eq <= 0, np.nan, eq)
    eq = pd.Series(eq).fillna(method="ffill").fillna(method="bfill").to_numpy()

    # simple returns
    rets = eq[1:] / eq[:-1] - 1.0
    rets = np.where(np.isfinite(rets), rets, 0.0)

    rf_annual = float(risk_free_rate_annual or 0.0)
    rf_per_period = (1.0 + rf_annual) ** (1.0 / annualization) - 1.0 if annualization > 0 else 0.0
    excess = rets - rf_per_period

    mean_excess = float(np.mean(excess))
    std_ret = float(np.std(rets, ddof=1)) if len(rets) > 1 else 0.0
    vol = std_ret * np.sqrt(annualization) if std_ret > 0 else 0.0

    # Sharpe uses excess returns over total volatility
    sharpe = (mean_excess / std_ret) * np.sqrt(annualization) if std_ret > 0 else 0.0

    # Sortino uses downside deviation of excess returns
    downside_excess = excess[excess < 0]
    downside_std = float(np.std(downside_excess, ddof=1)) if len(downside_excess) > 1 else 0.0
    sortino = (mean_excess / downside_std) * np.sqrt(annualization) if downside_std > 0 else 0.0

    # max drawdown
    running_max = np.maximum.accumulate(eq)
    drawdowns = eq / running_max - 1.0
    max_dd = float(np.min(drawdowns)) if len(drawdowns) else 0.0  # negative number
    max_dd_abs = abs(max_dd)

    # CAGR using timestamps if possible, else fallback to annualization
    # best-effort parse dates
    try:
        t0 = pd.to_datetime(equity_curve[0]["t"])
        t1 = pd.to_datetime(equity_curve[-1]["t"])
        years = max((t1 - t0).total_seconds() / (365.25 * 24 * 3600), 1e-9)
        cagr = float((eq[-1] / eq[0]) ** (1.0 / years) - 1.0)
    except Exception:
        # fallback: treat length as trading days
        years = max(len(eq) / annualization, 1e-9)
        cagr = float((eq[-1] / eq[0]) ** (1.0 / years) - 1.0)

    return {
        "cagr": cagr,
        "volatility": vol,
        "sharpe": sharpe,
        "sortino": sortino,
        "max_drawdown": max_dd_abs,
        "risk_free_rate_annual": rf_annual,
    }

def compute_trade_metrics(trades: list) -> dict:
    """
    Our TradeRecord stores realized pnl on SELL trades; BUY trades have pnl=0.
    We'll compute metrics on SELL trades as completed round-trips.
    """
    if not trades:
        return {
            "round_trips": 0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "avg_trade_pnl": 0.0,
            "total_realized_pnl": 0.0,
        }

    sells = [t for t in trades if getattr(t, "side", "") == "SELL"]
    if not sells:
        return {
            "round_trips": 0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "avg_trade_pnl": 0.0,
            "total_realized_pnl": 0.0,
        }

    pnls = np.array([_safe_float(getattr(t, "pnl", 0.0)) for t in sells], dtype=float)
    wins = pnls[pnls > 0]
    losses = pnls[pnls < 0]

    round_trips = int(len(pnls))
    win_rate = float(len(wins) / round_trips) if round_trips > 0 else 0.0

    gross_profit = float(np.sum(wins)) if len(wins) else 0.0
    gross_loss = float(np.sum(np.abs(losses))) if len(losses) else 0.0
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (float("inf") if gross_profit > 0 else 0.0)

    avg_trade_pnl = float(np.mean(pnls)) if round_trips > 0 else 0.0
    total_realized = float(np.sum(pnls))

    return {
        "round_trips": round_trips,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "avg_trade_pnl": avg_trade_pnl,
        "total_realized_pnl": total_realized,
    }

def annualization_factor(market: str, interval: str) -> int:
    m = (market or "").lower()
    itv = (interval or "").lower()

    # normalize yfinance interval variants
    if itv == "60m":
        itv = "1h"

    if itv.endswith("d"):
        return 252 if m == "equity" else 365
    if itv in ["1h", "90m"]:
        return 252 * 6 if m == "equity" else 365 * 24  # equities: rough 6.5h/day -> use 6 for simplicity
    if itv == "30m":
        return 252 * 13 if m == "equity" else 365 * 24 * 2
    if itv == "15m":
        return 252 * 26 if m == "equity" else 365 * 24 * 4
    if itv == "5m":
        return 252 * 78 if m == "equity" else 365 * 24 * 12
    if itv == "1m":
        return 252 * 390 if m == "equity" else 365 * 24 * 60

    # fallback: treat like daily
    return 252 if m == "equity" else 365