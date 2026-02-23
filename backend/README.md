# Backend

## Quickstart
```
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload  --port  8000
```
### Open API docs:

-   http://localhost:8000/docs