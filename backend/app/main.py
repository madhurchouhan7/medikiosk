import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import sessions, interview, documents, assistance, summaries, health

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS: explicit frontend origin(s) only. Wildcard + credentials was both
# invalid and over-permissive.
_frontend_origins = [
    o.strip().rstrip("/") for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",") if o.strip().rstrip("/")
]
# Visible in Render logs on every boot so a stale/mistyped value is obvious.
print(f"[CORS] allow_origins={_frontend_origins}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "HEAD"],
    allow_headers=["Content-Type"],
)

# Include Routers
app.include_router(sessions.router, prefix=settings.API_V1_STR)
app.include_router(interview.router, prefix=settings.API_V1_STR)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(assistance.router, prefix=settings.API_V1_STR)
app.include_router(summaries.router, prefix=settings.API_V1_STR)
app.include_router(health.router, prefix=settings.API_V1_STR)

@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {
        "message": "Welcome to Niraamay API",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health"
    }
