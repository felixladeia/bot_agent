from dataclasses import dataclass
from typing import Dict, Any
import pandas as pd
from app.services.indicators import sma, rsi

@dataclass
class SignalRow:
    action: str  # "BUY" | "SELL" | "HOLD"
    reason: Dict[str, Any]

class Strategy:
    name: str
    def prepare(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        return df
    def decide(self, row: pd.Series, state: Dict[str, Any], params: Dict[str, Any]) -> SignalRow:
        raise NotImplementedError

class SmaCrossoverStrategy(Strategy):
    name = "sma_crossover"

    def prepare(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        fast = int(params.get("fast", 10))
        slow = int(params.get("slow", 30))
        df["sma_fast"] = sma(df["close"], fast)
        df["sma_slow"] = sma(df["close"], slow)
        return df

    def decide(self, row: pd.Series, state: Dict[str, Any], params: Dict[str, Any]) -> SignalRow:
        pos = state.get("position_qty", 0.0)
        fast = row.get("sma_fast")
        slow = row.get("sma_slow")

        if pd.isna(fast) or pd.isna(slow):
            return SignalRow("HOLD", {"rule": "warmup", "sma_fast": fast, "sma_slow": slow})

        # Entry: fast crosses above slow (approx: fast>slow and previously not)
        prev_fast = state.get("prev_sma_fast")
        prev_slow = state.get("prev_sma_slow")

        crossed_up = prev_fast is not None and prev_slow is not None and prev_fast <= prev_slow and fast > slow
        crossed_down = prev_fast is not None and prev_slow is not None and prev_fast >= prev_slow and fast < slow

        reason = {
            "rule": "sma_crossover",
            "sma_fast": float(fast),
            "sma_slow": float(slow),
            "crossed_up": bool(crossed_up),
            "crossed_down": bool(crossed_down),
            "position_qty": float(pos),
        }

        if pos <= 0 and crossed_up:
            return SignalRow("BUY", {**reason, "trigger": "fast_cross_above_slow"})
        if pos > 0 and crossed_down:
            return SignalRow("SELL", {**reason, "trigger": "fast_cross_below_slow"})
        return SignalRow("HOLD", reason)

class RsiMeanReversionStrategy(Strategy):
    name = "rsi_mean_reversion"

    def prepare(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        window = int(params.get("window", 14))
        df["rsi"] = rsi(df["close"], window)
        return df

    def decide(self, row: pd.Series, state: Dict[str, Any], params: Dict[str, Any]) -> SignalRow:
        pos = state.get("position_qty", 0.0)
        rsi_val = row.get("rsi")
        low = float(params.get("buy_below", 30))
        high = float(params.get("sell_above", 70))

        if pd.isna(rsi_val):
            return SignalRow("HOLD", {"rule": "warmup", "rsi": rsi_val})

        reason = {
            "rule": "rsi_mean_reversion",
            "rsi": float(rsi_val),
            "buy_below": low,
            "sell_above": high,
            "position_qty": float(pos),
        }

        if pos <= 0 and rsi_val < low:
            return SignalRow("BUY", {**reason, "trigger": "rsi_oversold"})
        if pos > 0 and rsi_val > high:
            return SignalRow("SELL", {**reason, "trigger": "rsi_overbought"})
        return SignalRow("HOLD", reason)

def get_strategy(name: str) -> Strategy:
    if name == SmaCrossoverStrategy.name:
        return SmaCrossoverStrategy()
    if name == RsiMeanReversionStrategy.name:
        return RsiMeanReversionStrategy()
    raise ValueError(f"Unknown strategy: {name}")