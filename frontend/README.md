# Frontend

## Quickstart
```
cd frontend
npm install
NEXT_PUBLIC_API_BASE=http://localhost:8003 npm run dev
```
Open UI:

-   [http://localhost:3003](http://localhost:3000)


----------

## Usage

1.  Go to **/login**

2.  Register a new user

    -   The **first registered user** becomes **admin** (MVP convenience)

3.  Create a config in **/configs**

    -   Crypto example: `BTC-USD` interval `1h`

    -   Equity example: `AAPL` interval `1d`

4.  Run a backtest → view results, trades, and per-trade reasoning


Admin screen:

-   `/admin/users` (only visible to admin)


----------

## Strategies (MVP)

-   `sma_crossover`
    Buy when fast SMA crosses above slow SMA; Sell on cross below.

-   `rsi_mean_reversion`
    Buy when RSI < threshold; Sell when RSI > threshold.


----------

## Data Provider

Current provider: **yfinance**

-   Equities: `AAPL`, `MSFT`, ...

-   Crypto: `BTC-USD`, `ETH-USD`, ...


Intervals (depends on symbol/provider support): `1m,5m,15m,30m,1h,1d,...`

----------

## Notes / Gotchas

-   If you request intraday equities over long date ranges, yfinance may return empty. Prefer `interval=1d` for equities.

-   CORS is enabled for localhost frontend → backend dev.

-   SQLite is used for MVP; schema changes may require deleting the DB file.


----------

## Roadmap (Next Steps)

-   Run history + compare runs UI

-   Parameter sweep (grid search) + leaderboard

-   Background jobs for long backtests

-   Swap data providers: ccxt (crypto) / broker API (equities)

-   Execution layer (paper/live) with risk controls