import json
from typing import Any, Dict, List, Tuple
import pandas as pd

from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableLambda

from app.services.yfinance_provider import YFinanceDataProvider
from app.services.backtester import run_backtest_for_symbol
from app.services.strategies import get_strategy
from app.services.agent_schemas import AgentReport
from langchain_core.messages import SystemMessage, HumanMessage

def _df_tail_snapshot(df: pd.DataFrame, cols: List[str], n: int = 5) -> List[Dict[str, Any]]:
    cols = [c for c in cols if c in df.columns]
    tail = df[cols].tail(n).copy()
    # JSON safe
    tail = tail.where(pd.notnull(tail), None)
    return tail.to_dict(orient="records")

def build_agent(model: str = "gpt-4.1-mini", temperature: float = 0.0):
    llm = ChatOpenAI(model=model, temperature=temperature)

    # ---- Tools ----

    @tool
    def fetch_ohlcv(symbol: str, start_date: str, end_date: str, interval: str) -> Dict[str, Any]:
        """Fetch OHLCV data for a symbol."""
        provider = YFinanceDataProvider()
        md = provider.get_ohlcv(symbol, start_date, end_date, interval=interval)
        df = md.df.copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"]).astype(str)
        return {
            "symbol": symbol,
            "rows": int(len(df)),
            "head": _df_tail_snapshot(df.head(10), ["timestamp","open","high","low","close","volume"], n=5),
            "tail": _df_tail_snapshot(df, ["timestamp","open","high","low","close","volume"], n=5),
        }

    @tool
    def compute_indicators(symbol: str, start_date: str, end_date: str, interval: str, strategy: str, params_json: str) -> Dict[str, Any]:
        """Compute indicators by applying strategy.prepare to OHLCV."""
        provider = YFinanceDataProvider()
        md = provider.get_ohlcv(symbol, start_date, end_date, interval=interval)
        df = md.df.copy()
        params = json.loads(params_json)
        strat = get_strategy(strategy)
        df2 = strat.prepare(df, params)
        df2["timestamp"] = pd.to_datetime(df2["timestamp"]).astype(str)
        cols = ["timestamp","close","sma_fast","sma_slow","rsi"]
        return {
            "symbol": symbol,
            "rows": int(len(df2)),
            "tail": _df_tail_snapshot(df2, cols, n=8),
        }

    @tool
    def run_backtest(symbol: str, start_date: str, end_date: str, interval: str, market: str, strategy: str, params_json: str, risk_json: str) -> Dict[str, Any]:
        """Run backtest and return compact metrics and last signals."""
        provider = YFinanceDataProvider()
        md = provider.get_ohlcv(symbol, start_date, end_date, interval=interval)
        params = json.loads(params_json)
        risk = json.loads(risk_json)
        metrics, trades, equity_curve = run_backtest_for_symbol(
            symbol, md.df, strategy, params, risk, market=market, interval=interval
        )

        # Compact summary
        sells = [t for t in trades if getattr(t, "side", "") == "SELL"]
        last_trade = None
        if trades:
            t = trades[-1]
            last_trade = {
                "timestamp": t.timestamp,
                "side": t.side,
                "price": float(t.price),
                "qty": float(t.qty),
                "pnl": float(getattr(t, "pnl", 0.0)),
            }

        return {
            "symbol": symbol,
            "metrics": metrics,
            "num_trades": len(trades),
            "round_trips": len(sells),
            "last_trade": last_trade,
            "equity_tail": equity_curve[-5:] if len(equity_curve) >= 5 else equity_curve,
        }

    # ---- Orchestrator prompt ----
    system = SystemMessage(content=
        "You are a trading research agent. You MUST base conclusions only on tool outputs.\n"
        "Output must be valid JSON matching the required schema.\n"
        "EvidencePoint.value MUST be a JSON scalar (string/number/bool/null). Put any complex detail in EvidencePoint.note as text.\n"
        "Focus on: recommendation (BUY/SELL/HOLD), confidence, evidence (metrics, last indicator state), risks, next steps.\n"
        "Avoid claiming future returns; speak conditionally.\n"
    )

    # # We'll orchestrate ourselves (deterministic calls) and ask LLM only to *write the report* from tool results.
    # def make_report_payload(inputs: Dict[str, Any], tool_results: Dict[str, Any]) -> Dict[str, Any]:
    #     return {"inputs": inputs, "tool_results": tool_results}

    # report_chain = (
    #     RunnableLambda(make_report_payload)
    #     | llm.with_structured_output(AgentReport)
    # )

    def to_messages(payload: Dict[str, Any]):
        # payload is a dict with keys: inputs, tool_results
        return [
            system,
            HumanMessage(content=json.dumps(payload, ensure_ascii=False)),
        ]

    report_chain = (
        RunnableLambda(to_messages)
        | llm.with_structured_output(AgentReport)
    )

    return {
        "tools": {
            "fetch_ohlcv": fetch_ohlcv,
            "compute_indicators": compute_indicators,
            "run_backtest": run_backtest,
        },
        "system": system,
        "report_chain": report_chain,
    }

def run_agent_v1(
    run_id: int,
    config_id: int,
    symbols: List[str],
    market: str,
    interval: str,
    start_date: str,
    end_date: str,
    strategy: str,
    params: Dict[str, Any],
    risk: Dict[str, Any],
    model: str = "gpt-4.1-mini",
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Returns: (report_json, trace_json)
    """
    agent = build_agent(model=model)
    tools = agent["tools"]

    trace: Dict[str, Any] = {"tool_calls": [], "per_symbol": {}}
    per_symbol = {}

    params_json = json.dumps(params)
    risk_json = json.dumps(risk)

    for sym in symbols:
        sym_block = {"symbol": sym}

        ind = tools["compute_indicators"].invoke({
            "symbol": sym, "start_date": start_date, "end_date": end_date,
            "interval": interval, "strategy": strategy, "params_json": params_json
        })
        trace["tool_calls"].append({"tool": "compute_indicators", "symbol": sym})
        sym_block["indicators_tail"] = ind.get("tail", [])

        bt = tools["run_backtest"].invoke({
            "symbol": sym, "start_date": start_date, "end_date": end_date,
            "interval": interval, "market": market,
            "strategy": strategy, "params_json": params_json, "risk_json": risk_json
        })
        trace["tool_calls"].append({"tool": "run_backtest", "symbol": sym})
        sym_block["backtest"] = bt

        per_symbol[sym] = sym_block
        trace["per_symbol"][sym] = {"metrics": bt.get("metrics", {}), "ind_tail": sym_block["indicators_tail"]}

    inputs = {
        "run_id": run_id,
        "config_id": config_id,
        "symbols": symbols,
        "market": market,
        "interval": interval,
        "start_date": start_date,
        "end_date": end_date,
        "strategy": strategy,
        "params": params,
        "risk": risk,
    }

    # Ask the LLM to produce a strict report from the tool results
    #report = agent["report_chain"].invoke(inputs, tool_results=per_symbol)  # type: ignore
    payload = {"inputs": inputs, "tool_results": per_symbol}
    report = agent["report_chain"].invoke(payload)

    if hasattr(report, "model_dump"):
        report_json = report.model_dump()
    else:
        report_json = dict(report)

    trace["model"] = model
    trace["inputs"] = inputs

    return report_json, trace