from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import models
from app.db.session import Base, engine
from app.routers import auth, configs, backtests
from app.routers import me as me_router
from app.routers import admin as admin_router
from app.routers import agent

def create_app() -> FastAPI:
    app = FastAPI(title="Trading Bot MVP")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3003",
            "http://127.0.0.1:3003",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    Base.metadata.create_all(bind=engine)

    app.include_router(auth.router)
    app.include_router(configs.router)
    app.include_router(backtests.router)
    app.include_router(me_router.router)
    app.include_router(admin_router.router)

    app.include_router(agent.router)
    return app

app = create_app()