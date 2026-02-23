from dataclasses import dataclass
import pandas as pd

@dataclass
class MarketData:
    df: pd.DataFrame
    # expected columns: ["timestamp","open","high","low","close","volume"]

class DataProvider:
    def get_ohlcv(self, symbol: str, start_date: str, end_date: str) -> MarketData:
        raise NotImplementedError

class CsvDataProvider(DataProvider):
    """
    MVP provider: expects CSV at data/{symbol}.csv with columns:
    timestamp,open,high,low,close,volume
    """
    def __init__(self, base_path: str = "data"):
        self.base_path = base_path

    def get_ohlcv(self, symbol: str, start_date: str, end_date: str) -> MarketData:
        path = f"{self.base_path}/{symbol}.csv"
        df = pd.read_csv(path)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp")
        df = df[(df["timestamp"] >= start_date) & (df["timestamp"] <= end_date)].copy()
        return MarketData(df=df.reset_index(drop=True))