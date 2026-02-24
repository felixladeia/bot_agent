# app/db/models.py (or a new file imported by models __init__)
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.db.session import Base

class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    config_id = Column(Integer, ForeignKey("configs.id"), nullable=False, index=True)

    status = Column(String(32), nullable=False, default="running")  # running|completed|failed
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    input_json = Column(Text, nullable=False, default="{}")
    output_json = Column(Text, nullable=True)      # final report
    trace_json = Column(Text, nullable=True)       # tool calls + intermediate summaries
    error = Column(Text, nullable=True)