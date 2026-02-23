# Trading Bot MVP (Backtesting + Dashboard + Multi-User)

A minimal but real trading bot platform:
- ✅ Multi-user authentication (register/login) with JWT
- ✅ Config dashboard (strategy params, risk params, market, interval, symbols)
- ✅ Backtesting over historical data (yfinance provider for equities + crypto)
- ✅ Metrics (CAGR, vol, Sharpe/Sortino with risk-free rate, max drawdown, win rate, profit factor, etc.)
- ✅ Trade list + **deterministic** (non-LLM) human-readable reasoning per trade
- ✅ Admin screen to list registered users

> Note: This is a backtesting MVP. It does NOT place live trades.

---

## Repo Structure

```text
.
├── backend/         # FastAPI + SQLite + backtester + yfinance provider
└── frontend/        # Next.js dashboard (login, configs, runs, admin)