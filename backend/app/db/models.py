from datetime import datetime
from sqlalchemy import Boolean, String, Integer, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))

    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)  # <-- ADD

    configs: Mapped[list["Config"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    runs: Mapped[list["BacktestRun"]] = relationship(back_populates="user", cascade="all, delete-orphan")

class Config(Base):
    __tablename__ = "configs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    name: Mapped[str] = mapped_column(String(200))
    strategy: Mapped[str] = mapped_column(String(50))  # "sma_crossover" | "rsi_mean_reversion"
    params_json: Mapped[str] = mapped_column(Text)     # JSON string
    risk_json: Mapped[str] = mapped_column(Text)       # JSON string
    symbols_csv: Mapped[str] = mapped_column(String(1000))  # "AAPL,MSFT"
    start_date: Mapped[str] = mapped_column(String(10))     # "YYYY-MM-DD"
    end_date: Mapped[str] = mapped_column(String(10))       # "YYYY-MM-DD"
    market: Mapped[str] = mapped_column(String(20), default="crypto")
    interval: Mapped[str] = mapped_column(String(10), default="1h")

    user: Mapped["User"] = relationship(back_populates="configs")
    runs: Mapped[list["BacktestRun"]] = relationship(back_populates="config", cascade="all, delete-orphan")

class BacktestRun(Base):
    __tablename__ = "backtest_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    config_id: Mapped[int] = mapped_column(ForeignKey("configs.id"), index=True)

    status: Mapped[str] = mapped_column(String(30), default="completed")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    metrics_json: Mapped[str] = mapped_column(Text)  # JSON string
    equity_json: Mapped[str] = mapped_column(Text, default="[]")  # <--- ADD THIS

    user: Mapped["User"] = relationship(back_populates="runs")
    config: Mapped["Config"] = relationship(back_populates="runs")
    trades: Mapped[list["Trade"]] = relationship(back_populates="run", cascade="all, delete-orphan")

class Trade(Base):
    __tablename__ = "trades"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("backtest_runs.id"), index=True)

    symbol: Mapped[str] = mapped_column(String(20))
    timestamp: Mapped[str] = mapped_column(String(30))  # ISO or date
    side: Mapped[str] = mapped_column(String(4))        # BUY/SELL
    qty: Mapped[float] = mapped_column(Float)
    price: Mapped[float] = mapped_column(Float)
    fee: Mapped[float] = mapped_column(Float, default=0.0)
    slippage: Mapped[float] = mapped_column(Float, default=0.0)
    pnl: Mapped[float] = mapped_column(Float, default=0.0)

    decision_trace_json: Mapped[str] = mapped_column(Text)  # JSON string

    run: Mapped["BacktestRun"] = relationship(back_populates="trades")