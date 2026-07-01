"""Backend API tests for Gotland 511 route endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "http://localhost:8001").rstrip("/")


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# /api/ root health
def test_root_health(api):
    r = api.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert r.json().get("message") == "Gotland 511 API"


# /api/route
class TestRoute:
    def test_route_status(self, api):
        r = api.get(f"{BASE_URL}/api/route")
        assert r.status_code == 200

    def test_route_shape(self, api):
        d = api.get(f"{BASE_URL}/api/route").json()
        for key in ("route_name", "total_distance_km", "default_start",
                    "default_pace_seconds_per_km", "pois"):
            assert key in d, f"missing {key}"

    def test_route_defaults(self, api):
        d = api.get(f"{BASE_URL}/api/route").json()
        assert d["default_pace_seconds_per_km"] == 495  # 8:15
        assert d["default_start"].startswith("2026-07-04")
        assert d["route_name"] == "Gotland 511"

    def test_pois_count_220(self, api):
        d = api.get(f"{BASE_URL}/api/route").json()
        assert len(d["pois"]) == 220

    def test_poi_fields(self, api):
        d = api.get(f"{BASE_URL}/api/route").json()
        p = d["pois"][0]
        for key in ("id", "distance", "off_route", "name", "category"):
            assert key in p

    def test_off_route_flag_exists(self, api):
        d = api.get(f"{BASE_URL}/api/route").json()
        # at least one POI should be off_route per dataset
        assert any(p["off_route"] for p in d["pois"])

    def test_known_typo_preserved(self, api):
        # Ranarve Gårdshandel has distance=3600 (typo for 360) — must be preserved.
        d = api.get(f"{BASE_URL}/api/route").json()
        ran = [p for p in d["pois"] if "Ranarve" in p["name"]]
        assert ran, "Ranarve POI missing"
        assert ran[0]["distance"] == 3600


# /api/route/categories
class TestCategories:
    def test_categories_status(self, api):
        r = api.get(f"{BASE_URL}/api/route/categories")
        assert r.status_code == 200

    def test_categories_list(self, api):
        d = api.get(f"{BASE_URL}/api/route/categories").json()
        assert "categories" in d
        cats = d["categories"]
        assert isinstance(cats, list)
        assert len(cats) > 0
        assert cats == sorted(cats)
