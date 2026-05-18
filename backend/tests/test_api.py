"""Backend tests for TheSphere Resonance Engine."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://resonance-engine-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ── Root & Health ──────────────────────────────────────────
class TestRoot:
    def test_root_returns_houses_and_nullstelle(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data["nullstelle_energy"] == 25.0
        assert data["status"] == "alive"
        assert len(data["houses"]) == 8
        # v0.3+: houses now use compass codes (NNO/ONO/…) and lifecycle titles
        # (ORIGIN/OFFERING/…). The legacy `name` field is preserved as an alias.
        codes = {h["code"] for h in data["houses"]}
        titles = {h.get("title", h.get("name")) for h in data["houses"]}
        assert codes == {"NNO", "ONO", "OSO", "SSO", "SSW", "WSW", "WNW", "NNW"}
        assert titles == {
            "ORIGIN", "OFFERING", "EXPRESSION", "GROUND",
            "EMBODIMENT", "VALUE", "FEEDBACK", "EVALUATION",
        }
        for h in data["houses"]:
            assert isinstance(h["vector"], list) and len(h["vector"]) == 3

    def test_health(self, client):
        r = client.get(f"{API}/health")
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["db"] is True


# ── Presets CRUD ───────────────────────────────────────────
class TestPresets:
    created_id = None

    def test_create_preset_valid(self, client):
        payload = {
            "name": "TEST_preset_alpha",
            "magnitudes": [1.77] * 8,
            "phases": [0.0] * 8,
            "omega": 1.0,
        }
        r = client.post(f"{API}/presets", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_preset_alpha"
        assert len(data["magnitudes"]) == 8
        assert len(data["phases"]) == 8
        assert "id" in data
        assert "_id" not in data
        TestPresets.created_id = data["id"]

    def test_create_preset_invalid_length(self, client):
        payload = {
            "name": "TEST_bad",
            "magnitudes": [1.0] * 7,
            "phases": [0.0] * 8,
        }
        r = client.post(f"{API}/presets", json=payload)
        assert r.status_code == 400

    def test_create_preset_invalid_phases(self, client):
        payload = {
            "name": "TEST_bad2",
            "magnitudes": [1.0] * 8,
            "phases": [0.0] * 5,
        }
        r = client.post(f"{API}/presets", json=payload)
        assert r.status_code == 400

    def test_list_presets_sorted_newest_first(self, client):
        # create another preset to ensure sorting
        p2 = {
            "name": "TEST_preset_beta",
            "magnitudes": [0.5] * 8,
            "phases": [0.1] * 8,
        }
        r = client.post(f"{API}/presets", json=p2)
        assert r.status_code == 200
        new_id = r.json()["id"]

        r = client.get(f"{API}/presets")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # no _id leakage
        for it in items:
            assert "_id" not in it
        # newest first - beta should appear before alpha
        ids = [i["id"] for i in items]
        assert new_id in ids
        if TestPresets.created_id in ids:
            assert ids.index(new_id) < ids.index(TestPresets.created_id)

        # cleanup beta
        client.delete(f"{API}/presets/{new_id}")

    def test_get_preset_by_id(self, client):
        assert TestPresets.created_id is not None
        r = client.get(f"{API}/presets/{TestPresets.created_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == TestPresets.created_id
        assert data["name"] == "TEST_preset_alpha"

    def test_get_preset_404(self, client):
        r = client.get(f"{API}/presets/nonexistent-id-xyz")
        assert r.status_code == 404

    def test_delete_preset(self, client):
        assert TestPresets.created_id is not None
        r = client.delete(f"{API}/presets/{TestPresets.created_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["deleted"] is True
        # verify 404 after delete
        r2 = client.get(f"{API}/presets/{TestPresets.created_id}")
        assert r2.status_code == 404

    def test_delete_preset_404(self, client):
        r = client.delete(f"{API}/presets/nonexistent-id-xyz")
        assert r.status_code == 404


# ── Snapshots CRUD ─────────────────────────────────────────
class TestSnapshots:
    created_id = None

    def test_create_snapshot(self, client):
        payload = {
            "event": "nullstelle",
            "energy": 24.95,
            "incoherence": 0.012,
            "magnitudes": [1.77] * 8,
            "phases": [1.57] * 8,
            "resonance_state": "nullstelle",
        }
        r = client.post(f"{API}/snapshots", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["event"] == "nullstelle"
        assert data["energy"] == 24.95
        assert "_id" not in data
        TestSnapshots.created_id = data["id"]

    def test_list_snapshots_limit(self, client):
        # create a couple more
        for i in range(3):
            client.post(f"{API}/snapshots", json={
                "event": "manual",
                "energy": 10.0 + i,
                "incoherence": 0.5,
                "magnitudes": [0.3] * 8,
                "phases": [0.0] * 8,
                "resonance_state": "cold",
            })
        r = client.get(f"{API}/snapshots", params={"limit": 2})
        assert r.status_code == 200
        data = r.json()
        assert len(data) <= 2
        for it in data:
            assert "_id" not in it

    def test_delete_snapshot(self, client):
        assert TestSnapshots.created_id is not None
        r = client.delete(f"{API}/snapshots/{TestSnapshots.created_id}")
        assert r.status_code == 200
        assert r.json()["deleted"] is True
