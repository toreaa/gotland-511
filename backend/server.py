from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Any

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Gotland 511 API")
api_router = APIRouter(prefix="/api")

# Load route snapshot once on boot. The snapshot was generated from the
# user's GOTLAND 511 - V02.xlsx workbook (sheet GR-511-226). Frontend also
# bundles the same JSON so the calculator works fully offline; this endpoint
# is for inspectability / future live-refresh.
ROUTE_PATH = ROOT_DIR / 'data' / 'gotland.json'


def load_route() -> dict:
    with open(ROUTE_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


class POI(BaseModel):
    id: int
    distance: Optional[float]
    off_route: bool
    name: str
    category: str
    open: Optional[str] = None
    note: Optional[str] = None
    url: Optional[str] = None
    phone: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None


class Bounds(BaseModel):
    minLat: float
    maxLat: float
    minLon: float
    maxLon: float


class RouteResponse(BaseModel):
    route_name: str
    total_distance_km: float
    default_start: str
    default_pace_seconds_per_km: int
    pois: List[POI]
    track: List[List[float]] = []
    track_total_km: Optional[float] = None
    bounds: Optional[Bounds] = None


@api_router.get("/")
async def root():
    return {"message": "Gotland 511 API"}


@api_router.get("/route", response_model=RouteResponse)
async def get_route():
    return load_route()


@api_router.get("/route/categories")
async def get_categories():
    data = load_route()
    cats = sorted({p['category'] for p in data['pois'] if p.get('category')})
    return {"categories": cats}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
