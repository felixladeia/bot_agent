from dataclasses import dataclass
import pandas as pd
import yfinance as yf

@dataclass
class MarketData:
    df: pd.DataFrame

class YFinanceDataProvider:
    def get_ohlcv(self, symbol: str, start_date: str, end_date: str, interval: str = "1d") -> MarketData:
        # yfinance uses an EXCLUSIVE end; add +1 day to be inclusive for date strings
        try:
            end_dt = pd.to_datetime(end_date) + pd.Timedelta(days=1)
            end_for_yf = end_dt.strftime("%Y-%m-%d")
        except Exception:
            end_for_yf = end_date

        def download(itv: str) -> pd.DataFrame:
            df0 = yf.download(
                symbol,
                start=start_date,
                end=end_for_yf,
                interval=itv,
                auto_adjust=False,
                progress=False,
                group_by="column",  # helps reduce MultiIndex surprises
                threads=True,
            )
            if df0 is None or df0.empty:
                return pd.DataFrame()
            df0 = df0.reset_index()

            # Flatten MultiIndex columns if present
            if isinstance(df0.columns, pd.MultiIndex):
                df0.columns = [c[0] if isinstance(c, tuple) else c for c in df0.columns]

            # Normalize names
            df0 = df0.rename(columns={
                "Date": "timestamp",
                "Datetime": "timestamp",
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
                "Volume": "volume",
            })

            return df0

        df = download(interval)

        # Fallback: equities often work best at 1d for long ranges; retry if empty
        if df.empty and interval != "1d":
            df = download("1d")

        if df.empty:
            raise ValueError(
                f"No data for {symbol} in range {start_date}..{end_date} (interval={interval}). "
                f"Try interval=1d for equities or a shorter date range for intraday."
            )

        required = ["timestamp", "open", "high", "low", "close", "volume"]
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}. Columns={list(df.columns)}")

        print("Data fetched from yfinance:")
        print(df.head(5))

        df = df[required].copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df = df.dropna(subset=["timestamp"]).sort_values("timestamp").reset_index(drop=True)

        if df.empty:
            raise ValueError(
                f"Data normalized to empty for {symbol} in {start_date}..{end_date} (interval={interval}). "
                f"Columns after normalize ok, but timestamps invalid."
            )

        print("Data cleaned from yfinance:")
        print(df.head(5))

        return MarketData(df=df)