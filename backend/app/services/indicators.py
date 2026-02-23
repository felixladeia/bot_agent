import pandas as pd

def sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window).mean()

def rsi(close: pd.Series, window: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.rolling(window).mean()
    avg_loss = loss.rolling(window).mean()
    rs = avg_gain / (avg_loss.replace(0, 1e-12))
    return 100 - (100 / (1 + rs))