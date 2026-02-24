from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Union

JSONScalar = Union[str, int, float, bool, None]

class EvidencePoint(BaseModel):
    label: str
    value: JSONScalar
    note: Optional[str] = None

class SymbolRecommendation(BaseModel):
    symbol: str
    action: Literal["BUY", "SELL", "HOLD"]
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str
    evidence: List[EvidencePoint]
    risks: List[str]
    next_steps: List[str]

class AgentReport(BaseModel):
    run_id: int
    config_id: int
    summary: str
    recommendations: List[SymbolRecommendation]