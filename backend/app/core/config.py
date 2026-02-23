from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Trading Bot MVP"
    jwt_secret: str = "CHANGE_ME_IN_ENV"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60 * 24
    database_url: str = "sqlite:///./trading_bot.db"

settings = Settings()