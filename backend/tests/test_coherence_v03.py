"""Backend tests for Coherence Engine v0.3 (Houses+Aspects separation, /api/tune)."""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

EXPECTED_CODES = ["NNO", "ONO", "OSO", "SSO", "SSW", "WSW", "WNW", "NNW"]
EXPECTED_TITLES = ["ORIGIN", "OFFERING", "EXPRESSION", "GROUND", "EMBODIMENT", "VALUE", "FEEDBACK", "EVALUATION"]
EXPECTED_ASPECTS = [
    "analytical_coldness", "evidential_density", "relational_warmth", "groundedness",
    "structural_completeness", "transformative_tension", "semantic_depth", "social_calibration",
]


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ── Root ──────────────────────────────────────────
class TestRootV03:
    def test_root_v03_metadata(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        d = r.json()
        ce = d.get("coherence_engine") or {}
        assert ce.get("version") == "0.3"
        assert ce.get("probe_mode") == "single_call"
        assert ce.get("model") == "claude-haiku-4-5-20251001"
        assert d.get("nullstelle_energy") == 25.0
        houses = d.get("houses") or []
        assert len(houses) == 8
        for i, h in enumerate(houses):
            assert h["index"] == i + 1
            assert h["code"] == EXPECTED_CODES[i]
            assert h["title"] == EXPECTED_TITLES[i]
            assert isinstance(h.get("vector"), list) and len(h["vector"]) == 3


# ── Houses ────────────────────────────────────────
class TestHouses:
    def test_houses_full_metadata(self, client):
        r = client.get(f"{API}/houses")
        assert r.status_code == 200
        houses = r.json().get("houses") or []
        assert len(houses) == 8
        for i, h in enumerate(houses):
            assert h["index"] == i + 1
            assert h["code"] == EXPECTED_CODES[i]
            assert h["title"] == EXPECTED_TITLES[i]
            for k in ("core_energy", "guiding_question", "low_state", "high_state"):
                assert isinstance(h.get(k), str) and len(h[k]) > 0
            assert isinstance(h.get("vector"), list) and len(h["vector"]) == 3
            # Antipodal pair (NNO↔SSW, ONO↔WSW, OSO↔WNW, SSO↔NNW): index + 4 mod 8
            expected_opp = ((h["index"] - 1 + 4) % 8) + 1
            assert h.get("opposite_index") == expected_opp


# ── Aspects ───────────────────────────────────────
class TestAspects:
    def test_aspects_operators(self, client):
        r = client.get(f"{API}/aspects")
        assert r.status_code == 200
        d = r.json()
        ops = d.get("operators") or []
        assert len(ops) == 8
        names = [o["name"] for o in ops]
        assert names == EXPECTED_ASPECTS
        for i, o in enumerate(ops):
            assert o["default_target"] == i + 1
            assert isinstance(o["definition"], str)
            assert isinstance(o["anchor_low"], str)
            assert isinstance(o["anchor_high"], str)
        assert d.get("effects_schema") == ["amplitude", "damping", "coupling", "noise", "phase_shift"]
        assert "global" in d.get("scopes", []) and "local" in d.get("scopes", [])


# ── Probe ─────────────────────────────────────────
class TestProbeSingleCall:
    def test_probe_too_short(self, client):
        r = client.post(f"{API}/probe", json={"text": "a"})
        assert r.status_code == 400

    def test_probe_valid(self, client):
        r = client.post(f"{API}/probe", json={"text": "I want to start a podcast about climate hope and possibility."}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["scores"]) == 8 and len(d["vectors"]) == 8 and len(d["markers"]) == 8
        for s in d["scores"]: assert 0.0 <= s <= 1.0
        for v in d["vectors"]: assert v in (-1, 0, 1)
        assert d["elapsed_ms"] > 0


# ── Tune (full pipeline) ──────────────────────────
class TestTune:
    def test_tune_too_short_returns_clarification(self, client):
        r = client.post(f"{API}/tune", json={"text": "hi"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is False
        assert d["layer0_ok"] is False
        assert isinstance(d.get("clarification"), str) and len(d["clarification"]) > 5
        assert d.get("probe") is None

    def test_tune_valid_full_pipeline(self, client):
        r = client.post(
            f"{API}/tune",
            json={"text": "I want to start a podcast about climate hope and possibility for young people."},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["layer0_ok"] is True
        # probe
        probe = d["probe"]
        assert len(probe["scores"]) == 8
        assert len(probe["vectors"]) == 8
        assert len(probe["markers"]) == 8
        # aspects
        aspects = d["aspects"]
        assert len(aspects) == 8
        names = [a["name"] for a in aspects]
        assert names == EXPECTED_ASPECTS
        for a in aspects:
            assert a["scope"] in ("local", "global")
            assert isinstance(a["target_houses"], list) and len(a["target_houses"]) >= 1
            assert isinstance(a["effects"], dict)
        # mirror
        mirror = d["mirror"]
        for k in ("core", "value", "friction", "next_step"):
            t = mirror[k]
            assert isinstance(t, str) and len(t) > 5
            up = t.upper()
            assert "TODO" not in up and "PLACEHOLDER" not in up
        assert mirror["tone"] in ("clear", "guided", "questioning", "incomplete")
        idx = mirror["house_indices"]
        for k in ("core", "value", "friction", "next_step"):
            assert 1 <= idx[k] <= 8
        assert idx["next_step"] == 1  # always House 1 ORIGIN
        assert mirror["origin_sign"] in (-1, 1)
        assert 0.0 <= mirror["incoherence"] <= 1.0
        # at least one mirror section references a CODE · TITLE
        joined = " ".join(mirror[k] for k in ("core", "value", "friction", "next_step"))
        assert any(code in joined for code in EXPECTED_CODES)
        assert any(title in joined for title in EXPECTED_TITLES)
        # performance budget (loose: <8s server-side wall-clock)
        assert d["elapsed_ms"] < 8000, f"tune took {d['elapsed_ms']}ms"


# ── Legacy regressions ────────────────────────────
class TestLegacy:
    def test_presets_list(self, client):
        r = client.get(f"{API}/presets")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_snapshots_list(self, client):
        r = client.get(f"{API}/snapshots")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_snapshots24_list(self, client):
        r = client.get(f"{API}/snapshots24")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_residues_list(self, client):
        r = client.get(f"{API}/coherence/residues")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_coherence_reset_valid(self, client):
        payload = {
            "noise_score": 0.5, "energy": 10.0, "incoherence": 0.3,
            "q": [0.0]*24, "p": [0.0]*24, "A": [1.0]*24, "reason": "TEST_v03_regression",
        }
        r = client.post(f"{API}/coherence/reset", json=payload)
        assert r.status_code == 200
        assert r.json()["purified"] is True
