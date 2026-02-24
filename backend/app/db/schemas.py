from pydantic import BaseModel, EmailStr, Field
from typing import Any, Dict, List, Optional
from datetime import datetime

class AgentRunOut(BaseModel):
    id: int
    status: str
    config_id: int
    output: Optional[Dict[str, Any]] = None

class AgentRunDetailOut(BaseModel):
    id: int
    status: str
    config_id: int
    input: Dict[str, Any]
    output: Optional[Dict[str, Any]] = None
    trace: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ConfigCreate(BaseModel):
    name: str
    market: str = "crypto"
    interval: str = "1h"
    strategy: str
    params: Dict[str, Any] = {}
    risk: Dict[str, Any] = {}
    symbols: List[str]
    start_date: str
    end_date: str

class ConfigOut(BaseModel):
    id: int
    name: str
    market: str
    interval: str
    strategy: str
    params: Dict[str, Any]
    risk: Dict[str, Any]
    symbols: List[str]
    start_date: str
    end_date: str

class BacktestRunOut(BaseModel):
    id: int
    status: str
    config_id: int
    metrics: Dict[str, Any]

class TradeOut(BaseModel):
    id: int
    symbol: str
    timestamp: str
    side: str
    qty: float
    price: float
    fee: float
    slippage: float
    pnl: float

class MeOut(BaseModel):
    id: int
    email: EmailStr
    is_admin: bool

class AdminUserOut(BaseModel):
    id: int
    email: EmailStr
    is_admin: bool

class BacktestRunListOut(BaseModel):
    id: int
    status: str
    config_id: int
    created_at: str
    metrics: Dict[str, Any]