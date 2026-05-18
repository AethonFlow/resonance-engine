"""Backend tests for Coherence Engine v0.2 (24-knot + probes + Caput Mortuum)."""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://resonance-engine-1.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ── Root v0.2 metadata ─────────────────────────────────────
class TestRootV02:
    def test_root_has_coherence_engine_v02(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        ce = data.get("coherence_engine")
        assert ce is not None, "coherence_engine block missing"
        # v0.3 supersedes v0.2; we accept any v0.2+ as long as the engine block
        # is present and points at the correct Anthropic Haiku model.
        assert ce["version"].startswith("0.")
        assert ce["model"] == "claude-haiku-4-5-20251001"
        assert ce["n_threshold"] == 0.45
        assert data["nullstelle_energy"] == 25.0


# ── 24-knot snapshots ──────────────────────────────────────
class TestSnapshots24:
    created_id = None

    def _valid_payload(self, event="singing", label="TEST_v02"):
        return {
            "event": event,
            "sing_index": 0.87,
            "energy": 24.5,
            "R_layer": [0.91, 0.82, 0.74],
            "T_inter": 0.88,
            "C_E": 0.97,
            "q": [0.01 * i for i in range(24)],
            "p": [0.0] * 24,
            "A": [1.0] * 24,
            "llm_scores": [0.6] * 8,
            "llm_markers": [f"marker_{i}" for i in range(8)],
            "label": label,
            "resonance_state": "singing",
        }

    def test_create_snapshot24_valid(self, client):
        r = client.post(f"{API}/snapshots24", json=self._valid_payload())
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["event"] == "singing"
        assert data["sing_index"] == 0.87
        assert len(data["q"]) == 24
        assert len(data["p"]) == 24
        assert len(data["A"]) == 24
        assert len(data["R_layer"]) == 3
        assert "_id" not in data
        assert "id" in data
        TestSnapshots24.created_id = data["id"]

    def test_create_snapshot24_invalid_q_length(self, client):
        bad = self._valid_payload()
        bad["q"] = [0.0] * 23
        r = client.post(f"{API}/snapshots24", json=bad)
        assert r.status_code == 400

    def test_create_snapshot24_invalid_p_length(self, client):
        bad = self._valid_payload()
        bad["p"] = [0.0] * 25
        r = client.post(f"{API}/snapshots24", json=bad)
        assert r.status_code == 400

    def test_create_snapshot24_invalid_A_length(self, client):
        bad = self._valid_payload()
        bad["A"] = [1.0] * 10
        r = client.post(f"{API}/snapshots24", json=bad)
        assert r.status_code == 400

    def test_create_snapshot24_invalid_R_layer(self, client):
        bad = self._valid_payload()
        bad["R_layer"] = [0.5, 0.5]
        r = client.post(f"{API}/snapshots24", json=bad)
        assert r.status_code == 400

    def test_list_snapshots24_newest_first(self, client):
        second = self._valid_payload(event="nullstelle", label="TEST_v02_second")
        r = client.post(f"{API}/snapshots24", json=second)
        assert r.status_code == 200
        second_id = r.json()["id"]

        r = client.get(f"{API}/snapshots24")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 2
        for it in items:
            assert "_id" not in it
        ids = [i["id"] for i in items]
        assert second_id in ids
        if TestSnapshots24.created_id in ids:
            assert ids.index(second_id) < ids.index(TestSnapshots24.created_id), \
                "expected newest-first ordering"
        # cleanup second
        client.delete(f"{API}/snapshots24/{second_id}")

    def test_delete_snapshot24(self, client):
        assert TestSnapshots24.created_id is not None
        r = client.delete(f"{API}/snapshots24/{TestSnapshots24.created_id}")
        assert r.status_code == 200
        assert r.json()["deleted"] is True

    def test_delete_snapshot24_404(self, client):
        r = client.delete(f"{API}/snapshots24/does-not-exist")
        assert r.status_code == 404


# ── Caput Mortuum ──────────────────────────────────────────
class TestCaputMortuum:
    def test_reset_valid(self, client):
        payload = {
            "noise_score": 0.62,
            "energy": 42.3,
            "incoherence": 0.73,
            "q": [0.1] * 24,
            "p": [0.2] * 24,
            "A": [0.9] * 24,
            "reason": "TEST_manual",
        }
        r = client.post(f"{API}/coherence/reset", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["purified"] is True
        assert "residue_id" in data
        assert data["n_threshold"] == 0.45

    def test_reset_invalid_length(self, client):
        payload = {
            "noise_score": 0.5,
            "energy": 10.0,
            "incoherence": 0.2,
            "q": [0.0] * 23,
            "p": [0.0] * 24,
            "A": [1.0] * 24,
        }
        r = client.post(f"{API}/coherence/reset", json=payload)
        assert r.status_code == 400

    def test_list_residues_newest_first(self, client):
        r = client.get(f"{API}/coherence/residues")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1
        for it in items:
            assert "_id" not in it
            assert "id" in it
            assert "noise_score" in it
            assert "created_at" in it
        # sorted newest-first
        if len(items) >= 2:
            assert items[0]["created_at"] >= items[1]["created_at"]


# ── Probe (LLM measurement operators) ──────────────────────
class TestProbe:
    def test_probe_valid_german_text(self, client):
        payload = {
            "text": "Mir ist heute Morgen aufgefallen, wie der Druck in meinem Brustkorb sich langsam auflöst, als ich im Halbdunkel sitze und ruhig atme."
        }
        # LLM calls take ~8s, allow generous timeout
        r = client.post(f"{API}/probe", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "scores" in data and "vectors" in data and "markers" in data
        assert len(data["scores"]) == 8
        assert len(data["vectors"]) == 8
        assert len(data["markers"]) == 8
        for s in data["scores"]:
            assert 0.0 <= s <= 1.0
        for v in data["vectors"]:
            assert v in (-1, 0, 1)
        for m in data["markers"]:
            assert isinstance(m, str)
        assert isinstance(data["elapsed_ms"], int)
        assert data["elapsed_ms"] >= 0

    def test_probe_too_short(self, client):
        r = client.post(f"{API}/probe", json={"text": "a"})
        assert r.status_code == 400

    def test_probe_empty(self, client):
        r = client.post(f"{API}/probe", json={"text": ""})
        assert r.status_code == 400
