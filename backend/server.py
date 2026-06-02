"""
THE SPHERE – Resonance Engine · Backend (Coherence Engine v0.3)

Strict architecture:
  * houses.py  — stable lifecycle topology (NEVER modified by probes)
  * aspects.py — measurement operators + Aspect Matrix + Project Mirror
  * server.py  — FastAPI surface; the Aspect Matrix is the ONLY bridge between
                 probe output and any state mutation.

Endpoints:
  /api/                         root + houses metadata + engine version
  /api/health                   MongoDB ping
  /api/houses                   read-only house topology
  /api/aspects                  read-only aspect-operator definitions

  /api/presets                  legacy 8-knot CRUD
  /api/snapshots                legacy 8-knot CRUD
  /api/snapshots24              rich 24-knot snapshots (singing / nullstelle)
  /api/coherence/reset          Caput Mortuum purification
  /api/coherence/residues       residue archive

  /api/probe                    single Haiku call returning 8 measurement scores
  /api/tune                     end-to-end:  Layer-0 → probe → aspects → mirror
"""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from houses import HOUSES as HOUSE_META, house_summaries
from aspects import (
    ASPECT_OPERATORS,
    Aspect,
    AspectEffects,
    apply_aspect_matrix_py,
    build_project_mirror,
    layer0_check,
    probe_to_aspects,
)
from orchestrator import (
    TENZOR_TIMEOUT_MS,
    load_agents_config,
    load_flows_config,
    load_orchestrator_prompt,
    tenzor_invoke,
)

try:
    from cycle_engine import (
        HOUSES as ORBIT_HOUSES,
        HOUSE_BY_INDEX as ORBIT_HOUSE_BY_INDEX,
        compute_warm_kalt,
        theta_to_house_index,
        describe_zyklus_position,
    )
    from agent_bus import get_bus as _orbit_get_bus
    from agent_core import get_registry as _orbit_get_registry
    _ORBIT_AVAILABLE = True
except ImportError:
    _ORBIT_AVAILABLE = False

load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")   # legacy, no longer used
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="TheSphere – Coherence Engine")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",")] if CORS_ORIGINS != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


# ════════════════════════════════════════════════════════════════
# Single-call LLM probe
#   One Claude Haiku 4.5 call returns all 8 measurement scores at once.
#   Strict deterministic JSON-only output. Total wall-clock ~1.5–3 s.
# ════════════════════════════════════════════════════════════════
def _build_probe_system_prompt() -> str:
    lines = [
        "You are a QUALITATIVE MEASUREMENT OPERATOR — not an answer generator.",
        "You measure 8 dimensions of an input, each on a 0.000–1.000 scale.",
        "Return EXACTLY ONE JSON object with these keys, in this order:",
        "",
    ]
    for op in ASPECT_OPERATORS:
        lines.append(f'  "{op["name"]}": {{"score": float, "marker": str, "vector": int}},')
    lines.append("")
    lines.append("score: 0.000–1.000 (three decimals).")
    lines.append('marker: one phrase from the input, max 12 words. "" if input too thin.')
    lines.append("vector: -1, 0, or +1 (sign of deviation from neutral 0.5).")
    lines.append("")
    lines.append("Definitions and anchors:")
    for op in ASPECT_OPERATORS:
        lines.append(
            f'  • {op["name"]}: {op["definition"]} '
            f'low(0.0)="{op["anchor_low"]}" high(1.0)="{op["anchor_high"]}"'
        )
    lines.append("")
    lines.append("Return only the JSON object. No prose. No markdown. No code fences.")
    return "\n".join(lines)


_PROBE_SYSTEM = _build_probe_system_prompt()


def _safe_score(x) -> float:
    try:
        v = float(x)
    except Exception:
        return 0.5
    return max(0.0, min(1.0, round(v, 3)))


def _safe_vector(x) -> int:
    try:
        v = int(x)
    except Exception:
        return 0
    return v if v in (-1, 0, 1) else 0


def _empty_probe_result(reason: str = "") -> dict:
    """Neutral result used as a fallback when the LLM call fails."""
    return {
        "scores":  [0.5] * 8,
        "vectors": [0] * 8,
        "markers": [reason or ""] * 8 if reason else [""] * 8,
    }


def _parse_probe_payload(raw: str) -> dict:
    if not raw:
        return _empty_probe_result("(empty response)")
    # Prefer the first JSON object that contains all 8 keys
    try:
        data = json.loads(raw)
    except Exception:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            return _empty_probe_result("(no json)")
        try:
            data = json.loads(match.group(0))
        except Exception:
            return _empty_probe_result("(json parse)")
    if not isinstance(data, dict):
        return _empty_probe_result("(not object)")
    scores: list[float] = []
    vectors: list[int] = []
    markers: list[str] = []
    for op in ASPECT_OPERATORS:
        slot = data.get(op["name"])
        if not isinstance(slot, dict):
            scores.append(0.5); vectors.append(0); markers.append("")
            continue
        scores.append(_safe_score(slot.get("score", 0.5)))
        vectors.append(_safe_vector(slot.get("vector", 0)))
        markers.append(str(slot.get("marker", ""))[:80])
    return {"scores": scores, "vectors": vectors, "markers": markers}


async def _run_probe_one_call(user_input: str) -> dict:
    """Single Claude Haiku 4.5 call returning 8 scored dimensions (direct Anthropic SDK)."""
    api_key = ANTHROPIC_API_KEY
    if not api_key:
        return _empty_probe_result("(no ANTHROPIC_API_KEY)")
    try:
        import anthropic
        client_anthropic = anthropic.AsyncAnthropic(api_key=api_key)
        user_text = (
            f'Input:\n"""\n{user_input}\n"""\n\n'
            "Return the JSON object measuring all 8 dimensions."
        )
        message = await client_anthropic.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=_PROBE_SYSTEM,
            messages=[{"role": "user", "content": user_text}],
        )
        raw = message.content[0].text if message.content else ""
    except Exception as exc:  # noqa: BLE001
        return _empty_probe_result(f"(llm error: {type(exc).__name__})")
    return _parse_probe_payload(raw)


# ════════════════════════════════════════════════════════════════
# Models
# ════════════════════════════════════════════════════════════════
class Preset(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    magnitudes: List[float]
    phases: List[float]
    omega: float = 1.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    note: Optional[str] = None


class PresetCreate(BaseModel):
    name: str
    magnitudes: List[float]
    phases: List[float]
    omega: float = 1.0
    note: Optional[str] = None


class Snapshot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event: str
    energy: float
    incoherence: float
    magnitudes: List[float]
    phases: List[float]
    resonance_state: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SnapshotCreate(BaseModel):
    event: str
    energy: float
    incoherence: float
    magnitudes: List[float]
    phases: List[float]
    resonance_state: str


class Snapshot24(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event: str
    sing_index: float
    energy: float
    R_layer: List[float]
    T_inter: float
    C_E: float
    q: List[float]
    p: List[float]
    A: List[float]
    llm_scores: Optional[List[float]] = None
    llm_markers: Optional[List[str]] = None
    label: Optional[str] = None
    resonance_state: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Snapshot24Create(BaseModel):
    event: str
    sing_index: float
    energy: float
    R_layer: List[float]
    T_inter: float
    C_E: float
    q: List[float]
    p: List[float]
    A: List[float]
    llm_scores: Optional[List[float]] = None
    llm_markers: Optional[List[str]] = None
    label: Optional[str] = None
    resonance_state: str


class CaputMortuumReset(BaseModel):
    noise_score: float
    energy: float
    incoherence: float
    q: List[float]
    p: List[float]
    A: List[float]
    reason: Optional[str] = None


class Residue(BaseModel):
    id: str
    noise_score: float
    energy: float
    incoherence: float
    q: List[float]
    p: List[float]
    A: List[float]
    reason: Optional[str] = None
    created_at: str


class ProbeRequest(BaseModel):
    text: str


class ProbeResponse(BaseModel):
    scores: List[float]
    vectors: List[int]
    markers: List[str]
    elapsed_ms: int


class TuneRequest(BaseModel):
    text: str
    # Optional baseline 24-knot state. If omitted, a canonical-coherent baseline is used.
    q: Optional[List[float]] = None
    p: Optional[List[float]] = None
    A: Optional[List[float]] = None


class AspectEffectDTO(BaseModel):
    amplitude:   Optional[float] = None
    damping:     Optional[float] = None
    coupling:    Optional[float] = None
    noise:       Optional[float] = None
    phase_shift: Optional[float] = None


class AspectDTO(BaseModel):
    name: str
    scope: str
    target_houses: List[int]
    effects: AspectEffectDTO
    marker: str


class MirrorDTO(BaseModel):
    core: str
    value: str
    friction: str
    next_step: str
    tone: str   # 'clear' | 'guided' | 'questioning' | 'incomplete'
    house_indices: dict
    incoherence: float
    origin_sign: int
    trace: dict


class TuneResponse(BaseModel):
    ok: bool
    layer0_ok: bool
    clarification: Optional[str] = None
    probe: Optional[ProbeResponse] = None
    aspects: Optional[List[AspectDTO]] = None
    mirror: Optional[MirrorDTO] = None
    elapsed_ms: int


# ── TENZOR Orchestrator (single-pass) ────────────────────────────
class TenzorInvokeRequest(BaseModel):
    input: str = Field(..., min_length=1, max_length=2000)
    lang:  Optional[str] = Field(default="de")
    save:  Optional[bool] = Field(default=True)


class TenzorInvokeResponse(BaseModel):
    report:          str
    state:           str
    factor:          str
    score:           float
    energy:          float
    vector_4d:       List[float]
    agent_feedback:  str
    insight:         str
    action:          str
    lang:            str
    elapsed_ms:      int
    mirror_layer1:   str = ""   # plain-language Layer-1 Spiegel (no tech terms)
    history_id:      Optional[str] = None


class TenzorHistoryEntry(BaseModel):
    id:         str
    input:      str
    state:      str
    factor:     str
    score:      float
    energy:     float
    vector_4d:  List[float]
    insight:    str
    action:     str
    lang:       str
    created_at: str
    llm_scores: Optional[List[float]] = None   # 8 operator scores; None for legacy entries


# ════════════════════════════════════════════════════════════════
# Routes — meta
# ════════════════════════════════════════════════════════════════
@api.get("/")
async def root():
    return {
        "service": "TheSphere – Coherence Engine",
        "status": "alive",
        "nullstelle_energy": 25.0,
        "houses": [
            {
                "index": h["index"],
                "code": h["code"],
                "title": h["title"],
                "name": h["title"],   # alias for backward compatibility
                "vector": h["vector"],
            }
            for h in HOUSE_META
        ],
        "coherence_engine": {
            "version": "0.3",
            "model": "claude-haiku-4-5-20251001",
            "n_threshold": 0.45,
            "probe_mode": "single_call",
        },
    }


@api.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"ok": True, "db": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "db": False, "error": str(exc)}


@api.get("/houses")
async def get_houses():
    return {"houses": house_summaries()}


@api.get("/aspects")
async def get_aspects():
    return {
        "operators": [
            {
                "name":           op["name"],
                "default_target": op["default_target"],
                "definition":     op["definition"],
                "anchor_low":     op["anchor_low"],
                "anchor_high":    op["anchor_high"],
            }
            for op in ASPECT_OPERATORS
        ],
        "effects_schema": ["amplitude", "damping", "coupling", "noise", "phase_shift"],
        "scopes": ["global", "local"],
    }


# ── Presets (legacy 8-knot) ──────────────────────────────────────
@api.post("/presets", response_model=Preset)
async def create_preset(payload: PresetCreate):
    if len(payload.magnitudes) != 8 or len(payload.phases) != 8:
        raise HTTPException(400, "magnitudes and phases must have 8 entries")
    preset = Preset(**payload.model_dump())
    await db.presets.insert_one(preset.model_dump())
    return preset


@api.get("/presets", response_model=List[Preset])
async def list_presets():
    docs = await db.presets.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Preset(**d) for d in docs]


@api.get("/presets/{preset_id}", response_model=Preset)
async def get_preset(preset_id: str):
    doc = await db.presets.find_one({"id": preset_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "preset not found")
    return Preset(**doc)


@api.delete("/presets/{preset_id}")
async def delete_preset(preset_id: str):
    res = await db.presets.delete_one({"id": preset_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "preset not found")
    return {"deleted": True, "id": preset_id}


# ── Snapshots (legacy 8-knot) ────────────────────────────────────
@api.post("/snapshots", response_model=Snapshot)
async def create_snapshot(payload: SnapshotCreate):
    if len(payload.magnitudes) != 8 or len(payload.phases) != 8:
        raise HTTPException(400, "magnitudes and phases must have 8 entries")
    snap = Snapshot(**payload.model_dump())
    await db.snapshots.insert_one(snap.model_dump())
    return snap


@api.get("/snapshots", response_model=List[Snapshot])
async def list_snapshots(limit: int = 100):
    docs = await db.snapshots.find({}, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(500, limit)))
    return [Snapshot(**d) for d in docs]


@api.delete("/snapshots/{snapshot_id}")
async def delete_snapshot(snapshot_id: str):
    res = await db.snapshots.delete_one({"id": snapshot_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "snapshot not found")
    return {"deleted": True, "id": snapshot_id}


# ════════════════════════════════════════════════════════════════
# Coherence Engine — Probes · 24-knot snapshots · Caput Mortuum · Tune
# ════════════════════════════════════════════════════════════════
@api.post("/probe", response_model=ProbeResponse)
async def probe(payload: ProbeRequest):
    text = (payload.text or "").strip()
    if len(text) < 2:
        raise HTTPException(400, "text required (>= 2 chars)")
    text = text[:2000]
    started = datetime.now(timezone.utc)
    result = await _run_probe_one_call(text)
    elapsed_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
    return ProbeResponse(
        scores=result["scores"],
        vectors=result["vectors"],
        markers=result["markers"],
        elapsed_ms=elapsed_ms,
    )


@api.post("/snapshots24", response_model=Snapshot24)
async def create_snapshot24(payload: Snapshot24Create):
    for f, v in [("q", payload.q), ("p", payload.p), ("A", payload.A)]:
        if len(v) != 24:
            raise HTTPException(400, f"{f} must have 24 entries")
    if len(payload.R_layer) != 3:
        raise HTTPException(400, "R_layer must have 3 entries")
    snap = Snapshot24(**payload.model_dump())
    await db.snapshots24.insert_one(snap.model_dump())
    return snap


@api.get("/snapshots24", response_model=List[Snapshot24])
async def list_snapshots24(limit: int = 100):
    docs = await db.snapshots24.find({}, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(500, limit)))
    return [Snapshot24(**d) for d in docs]


@api.delete("/snapshots24/{snapshot_id}")
async def delete_snapshot24(snapshot_id: str):
    res = await db.snapshots24.delete_one({"id": snapshot_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "snapshot24 not found")
    return {"deleted": True, "id": snapshot_id}


@api.post("/coherence/reset")
async def coherence_reset(payload: CaputMortuumReset):
    for f, v in [("q", payload.q), ("p", payload.p), ("A", payload.A)]:
        if len(v) != 24:
            raise HTTPException(400, f"{f} must have 24 entries")
    residue = {
        "id": str(uuid.uuid4()),
        "noise_score": payload.noise_score,
        "energy": payload.energy,
        "incoherence": payload.incoherence,
        "q": payload.q, "p": payload.p, "A": payload.A,
        "reason": payload.reason or "manual",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.caput_mortuum.insert_one(residue)
    return {"purified": True, "residue_id": residue["id"], "n_threshold": 0.45}


@api.get("/coherence/residues", response_model=List[Residue])
async def list_residues(limit: int = 50):
    docs = await db.caput_mortuum.find({}, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(200, limit)))
    return [Residue(**d) for d in docs]


# ── /api/tune  ·  text → Layer0 → probe → aspects → matrix → mirror ──────
import math as _math


def _canonical_baseline_state() -> tuple[list[float], list[float], list[float]]:
    DEFAULT_A = _math.sqrt(25.0 / 8.0)
    q: list[float] = []
    p: list[float] = [0.0] * 24
    A: list[float] = [DEFAULT_A] * 24
    # idx convention matches frontend: layer-major (l*8 + h)
    for l in range(3):
        for _h in range(8):
            q.append(_math.pi / 2 + l * (2 * _math.pi / 3))
    return q, p, A


@api.post("/tune", response_model=TuneResponse)
async def tune(payload: TuneRequest):
    started = datetime.now(timezone.utc)
    text = (payload.text or "").strip()

    # ── Layer 0 ──
    ok, reason = layer0_check(text)
    if not ok:
        elapsed_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        return TuneResponse(
            ok=False, layer0_ok=False,
            clarification=reason,
            elapsed_ms=elapsed_ms,
        )

    # ── Probe ──
    probe_result = await _run_probe_one_call(text[:2000])
    probe_dto = ProbeResponse(
        scores=probe_result["scores"],
        vectors=probe_result["vectors"],
        markers=probe_result["markers"],
        elapsed_ms=int((datetime.now(timezone.utc) - started).total_seconds() * 1000),
    )

    # ── Aspect translation ──
    aspects: list[Aspect] = probe_to_aspects({
        "scores":  probe_dto.scores,
        "vectors": probe_dto.vectors,
        "markers": probe_dto.markers,
    })

    # ── Apply Aspect Matrix to a baseline (or caller-supplied) state ──
    if payload.q and payload.p and payload.A and len(payload.q) == 24 and len(payload.p) == 24 and len(payload.A) == 24:
        q0, p0, A0 = list(payload.q), list(payload.p), list(payload.A)
    else:
        q0, p0, A0 = _canonical_baseline_state()
    q1, p1, A1 = apply_aspect_matrix_py(q0, p0, A0, aspects)

    # ── Compute sing_index on the post-matrix state (Task 4 — three-tier tone) ──
    from aspects import _compute_sing_index  # internal helper, same module
    sing_val, R_post, _T_inter, _C_E = _compute_sing_index(q1, A1)

    # ── Mirror ──
    mirror_dict = build_project_mirror({
        "q": q1, "p": p1, "A": A1,
        "aspects": [a.to_dict() for a in aspects],
        "sing_index": sing_val,
        "R_layer": R_post,
    })

    elapsed_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
    return TuneResponse(
        ok=True,
        layer0_ok=True,
        probe=probe_dto,
        aspects=[
            AspectDTO(
                name=a.name,
                scope=a.scope,
                target_houses=a.target_houses,
                effects=AspectEffectDTO(**a.effects.to_dict()),
                marker=a.marker or "",
            )
            for a in aspects
        ],
        mirror=MirrorDTO(**mirror_dict),
        elapsed_ms=elapsed_ms,
    )


# ════════════════════════════════════════════════════════════════
# TENZOR Orchestrator — single-pass resonance pipeline
# ════════════════════════════════════════════════════════════════
@api.get("/tenzor")
async def tenzor_meta():
    """Diagnostic surface for the orchestrator layer."""
    return {
        "agents": load_agents_config(),
        "flows":  load_flows_config(),
        "timeout_ms": TENZOR_TIMEOUT_MS,
        "system_prompt_excerpt": load_orchestrator_prompt()[:280],
    }


@api.post("/tenzor/invoke", response_model=TenzorInvokeResponse)
async def tenzor_invoke_endpoint(payload: TenzorInvokeRequest):
    """
    Single-pass TENZOR pipeline. Hard 8000 ms timeout.
    `lang` may be "de" (default) or "en"; affects [INSIGHT] / [ACTION].
    When `save=true` (default) the result is also persisted to
    db.tenzor_history for the History tab.
    """
    lang = (payload.lang or "de").lower()
    if not lang.startswith("en"):
        lang = "de"
    result = await tenzor_invoke(
        payload.input,
        emergent_key=EMERGENT_LLM_KEY,
        lang=lang,
    )

    history_id: Optional[str] = None
    if payload.save and result["state"] != "INSUFFICIENT_DATA":
        try:
            doc = {
                "id":         str(uuid.uuid4()),
                "input":      payload.input[:2000],
                "state":      result["state"],
                "factor":     result["factor"],
                "score":      float(result["score"]),
                "energy":     float(result["energy"]),
                "vector_4d":  [float(x) for x in result["vector_4d"]],
                "insight":    result["insight"],
                "action":     result["action"],
                "lang":       result.get("lang", lang),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "llm_scores": result.get("llm_scores"),   # 8 operator scores for drift analysis
            }
            await db.tenzor_history.insert_one(doc)
            history_id = doc["id"]
        except Exception:
            history_id = None

    return TenzorInvokeResponse(
        report=result["report"],
        state=result["state"],
        factor=result["factor"],
        score=float(result["score"]),
        energy=float(result["energy"]),
        vector_4d=[float(x) for x in result["vector_4d"]],
        agent_feedback=result["agent_feedback"],
        insight=result["insight"],
        action=result["action"],
        mirror_layer1=result.get("mirror_layer1", ""),
        lang=result.get("lang", lang),
        elapsed_ms=int(result["elapsed_ms"]),
        history_id=history_id,
    )


@api.get("/tenzor/history", response_model=List[TenzorHistoryEntry])
async def tenzor_history(limit: int = 20):
    """Last N TENZOR invocations (newest first). Capped at 100."""
    limit = max(1, min(100, int(limit or 20)))
    docs = await db.tenzor_history.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [TenzorHistoryEntry(**d) for d in docs]


@api.get("/tenzor/stats")
async def tenzor_stats(days: int = 7):
    """
    Daily aggregate of the last `days` calendar days (UTC).
    Returns an array length == days, oldest first, with one bucket per day:
        { date: 'YYYY-MM-DD',
          count: int,
          avg_score: float | null,    (None when count == 0)
          max_score: float | null,
          aligned: bool,              (count > 0 AND max_score >= 0.60)
          last_state: str | None }
    Used by the Daily Alignment indicator and the 7-day Sparkline.
    """
    days = max(1, min(60, int(days if days is not None else 7)))
    now_utc = datetime.now(timezone.utc)
    start_utc = (now_utc - timedelta(days=days - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    iso_start = start_utc.isoformat()
    docs = (
        await db.tenzor_history
        .find({"created_at": {"$gte": iso_start}}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(2000)
    )

    # Bucket into UTC calendar days.
    buckets: dict[str, dict] = {}
    for d in docs:
        try:
            ts = datetime.fromisoformat(d["created_at"])
        except Exception:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        key = ts.astimezone(timezone.utc).strftime("%Y-%m-%d")
        b = buckets.setdefault(key, {
            "count": 0, "sum_score": 0.0, "max_score": 0.0,
            "last_state": None, "last_ts": "",
        })
        b["count"] += 1
        b["sum_score"] += float(d.get("score") or 0.0)
        b["max_score"] = max(b["max_score"], float(d.get("score") or 0.0))
        if str(d.get("created_at")) > b["last_ts"]:
            b["last_ts"] = str(d.get("created_at"))
            b["last_state"] = d.get("state")

    out: list[dict] = []
    for i in range(days):
        day = (start_utc + timedelta(days=i)).strftime("%Y-%m-%d")
        b = buckets.get(day)
        if not b or b["count"] == 0:
            out.append({
                "date": day,
                "count": 0,
                "avg_score": None,
                "max_score": None,
                "aligned": False,
                "last_state": None,
            })
        else:
            avg = b["sum_score"] / max(1, b["count"])
            out.append({
                "date": day,
                "count": int(b["count"]),
                "avg_score": round(avg, 3),
                "max_score": round(b["max_score"], 3),
                "aligned": (b["max_score"] >= 0.60),
                "last_state": b["last_state"],
            })

    today = now_utc.strftime("%Y-%m-%d")
    today_entry = out[-1]

    # ── Streaks (consecutive aligned days, ending today OR yesterday) ──
    # We allow "today not yet aligned" to still count the streak that ended yesterday,
    # so the user doesn't lose the streak just because they have not invoked yet today.
    aligned_flags = [bool(b["aligned"]) for b in out]
    streak_current = 0
    # Walk back from the most recent day. If today is aligned -> start at -1.
    # If today is NOT aligned but yesterday IS -> start at -2 (streak still alive today).
    # If today is NOT aligned and yesterday is NOT aligned -> streak = 0.
    if aligned_flags and aligned_flags[-1]:
        i = len(aligned_flags) - 1
        while i >= 0 and aligned_flags[i]:
            streak_current += 1
            i -= 1
    elif len(aligned_flags) >= 2 and aligned_flags[-2]:
        i = len(aligned_flags) - 2
        while i >= 0 and aligned_flags[i]:
            streak_current += 1
            i -= 1

    # Best streak inside the window
    streak_best = 0
    cur = 0
    for f in aligned_flags:
        if f:
            cur += 1
            streak_best = max(streak_best, cur)
        else:
            cur = 0

    return {
        "days":          days,
        "today":         today,
        "today_aligned": bool(today_entry["aligned"]),
        "today_count":   int(today_entry["count"]),
        "today_score":   today_entry["max_score"],
        "today_state":   today_entry["last_state"],
        "streak_current": int(streak_current),
        "streak_best":    int(streak_best),
        "series":        out,
    }


@api.get("/tenzor/journal")
async def tenzor_journal(limit: int = 7):
    """
    The last N saved INSIGHTs as a lightweight feed for the Home screen
    journal carousel. Ordered newest first, capped 1..30.
    Each entry: { id, created_at, input, state, score, insight, action, lang }.
    """
    limit = max(1, min(30, int(limit if limit is not None else 7)))
    docs = (
        await db.tenzor_history
        .find({}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(limit)
    )
    out: list[dict] = []
    for d in docs:
        out.append({
            "id":         d.get("id"),
            "created_at": d.get("created_at"),
            "input":      d.get("input", ""),
            "state":      d.get("state"),
            "score":      float(d.get("score") or 0.0),
            "insight":    d.get("insight", ""),
            "action":     d.get("action", ""),
            "lang":       d.get("lang", "de"),
        })
    return out


@api.get("/tenzor/drift")
async def tenzor_drift(days: int = 14, min_entries: int = 3):
    """
    Cognitive Drift Score — temporal coherence analysis over `days` calendar days.

    Returns a composite drift score CDS ∈ [0, 1] (higher = more drift) built from:
      drift_ratio      — fraction of COLD/DRIFT entries in the window
      score_volatility — normalised std-dev of sing_index
      score_decline    — linear regression slope (negative = declining = more drift)
      factor_entropy   — unpredictability of the dominant operator
      vector_rotation  — circular variance of the 4D-vector angles

    Also returns per-dimension drift (mean, std, velocity) when llm_scores are present.
    """
    import math as _math
    from collections import Counter

    days = max(1, min(90, int(days or 14)))
    min_entries = max(2, min(50, int(min_entries or 3)))

    now_utc = datetime.now(timezone.utc)
    start_utc = (now_utc - timedelta(days=days)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    docs = (
        await db.tenzor_history
        .find({"created_at": {"$gte": start_utc.isoformat()}}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(1000)
    )

    n = len(docs)
    if n < min_entries:
        return {
            "status":       "insufficient_data",
            "n":            n,
            "min_required": min_entries,
            "days":         days,
            "drift_score":  None,
        }

    scores  = [float(d.get("score") or 0.0) for d in docs]
    states  = [d.get("state", "COLD") for d in docs]
    factors = [d.get("factor", "INSUFFICIENT_DATA") for d in docs]
    vectors = [[float(x) for x in (d.get("vector_4d") or [0.0, 0.0, 0.0, 0.0])] for d in docs]

    # ── Score velocity (linear regression slope, normalised to [-1, +1]) ──
    x_mean = (n - 1) / 2.0
    y_mean = sum(scores) / n
    cov_xy = sum((i - x_mean) * (scores[i] - y_mean) for i in range(n))
    var_x  = sum((i - x_mean) ** 2 for i in range(n))
    slope  = cov_xy / var_x if var_x > 0 else 0.0
    velocity = max(-1.0, min(1.0, slope / 0.05))   # ±0.05/entry = full swing

    # ── Score volatility (std-dev, normalised; 0.3 std = fully volatile) ──
    variance   = sum((s - y_mean) ** 2 for s in scores) / n
    volatility = min(1.0, _math.sqrt(variance) / 0.3)

    # ── Drift ratio (fraction of COLD or DRIFT entries) ──
    n_drift     = sum(1 for s in states if s in ("COLD", "DRIFT"))
    drift_ratio = n_drift / n

    # ── Factor entropy (how unpredictable is the dominant operator?) ──
    fc = Counter(f for f in factors if f != "INSUFFICIENT_DATA")
    total_f = sum(fc.values())
    entropy = 0.0
    if total_f > 0:
        for count in fc.values():
            p = count / total_f
            if p > 0:
                entropy -= p * _math.log2(p)
    factor_entropy = (entropy / _math.log2(8)) if entropy > 0 else 0.0

    # ── Vector angle variance (circular; 0=stable, 1=scattered) ──
    angles = [
        _math.atan2(v[1], v[0]) for v in vectors
        if any(abs(x) > 1e-9 for x in v)
    ]
    if angles:
        sx = sum(_math.cos(a) for a in angles) / len(angles)
        sy = sum(_math.sin(a) for a in angles) / len(angles)
        angle_variance = 1.0 - _math.hypot(sx, sy)
    else:
        angle_variance = 0.0

    # ── Composite CDS ────────────────────────────────────────────────
    cds = (
        0.35 * drift_ratio
        + 0.25 * volatility
        + 0.20 * ((1.0 - velocity) / 2.0)   # declining velocity → more drift
        + 0.10 * factor_entropy
        + 0.10 * angle_variance
    )
    cds = round(max(0.0, min(1.0, cds)), 3)

    drift_label = (
        "stable"          if cds < 0.25 else
        "mild_drift"      if cds < 0.50 else
        "moderate_drift"  if cds < 0.75 else
        "high_drift"
    )

    # ── Per-dimension drift (only when llm_scores are stored) ──────
    dimension_drift = None
    llm_score_rows  = [d.get("llm_scores") for d in docs if d.get("llm_scores") and len(d["llm_scores"]) == 8]
    if len(llm_score_rows) >= min_entries:
        dimension_drift = []
        for i, op in enumerate(ASPECT_OPERATORS):
            dim_scores = [row[i] for row in llm_score_rows]
            dm = sum(dim_scores) / len(dim_scores)
            dv = _math.sqrt(sum((s - dm) ** 2 for s in dim_scores) / len(dim_scores))
            dn = len(dim_scores)
            dx_mean = (dn - 1) / 2.0
            dcov    = sum((j - dx_mean) * (dim_scores[j] - dm) for j in range(dn))
            dvar_x  = sum((j - dx_mean) ** 2 for j in range(dn))
            dslope  = dcov / dvar_x if dvar_x > 0 else 0.0
            dimension_drift.append({
                "operator": op["name"],
                "house":    op["default_target"],
                "mean":     round(dm, 3),
                "std":      round(dv, 3),
                "velocity": round(max(-1.0, min(1.0, dslope / 0.05)), 3),
                "trend":    (
                    "improving" if dslope >  0.005 else
                    "declining" if dslope < -0.005 else
                    "stable"
                ),
            })
        # Sort by absolute velocity (most-changing first)
        dimension_drift.sort(key=lambda d: abs(d["velocity"]), reverse=True)

    return {
        "status":       "ok",
        "n":            n,
        "days":         days,
        "period":       {"start": start_utc.isoformat(), "end": now_utc.isoformat()},
        "drift_score":  cds,
        "drift_label":  drift_label,
        "components": {
            "drift_ratio":      round(drift_ratio, 3),
            "score_volatility": round(volatility, 3),
            "score_velocity":   round(velocity, 3),
            "factor_entropy":   round(factor_entropy, 3),
            "vector_rotation":  round(angle_variance, 3),
        },
        "score_trend": {
            "mean":  round(y_mean, 3),
            "min":   round(min(scores), 3),
            "max":   round(max(scores), 3),
            "slope": round(slope, 4),
        },
        "state_distribution": dict(Counter(states)),
        "top_drift_factor":   fc.most_common(1)[0][0] if fc else None,
        "factor_counts":      dict(fc.most_common()),
        "dimension_drift":    dimension_drift,  # None until llm_scores accumulate
        "series": [
            {
                "created_at": d.get("created_at"),
                "score":      float(d.get("score") or 0.0),
                "state":      d.get("state"),
                "factor":     d.get("factor"),
            }
            for d in docs
        ],
    }


@api.delete("/tenzor/history/{entry_id}")

@api.delete("/tenzor/history/{entry_id}")
async def tenzor_history_delete(entry_id: str):
    """Delete a single TENZOR history entry by id."""
    result = await db.tenzor_history.delete_one({"id": entry_id})
    return {"deleted": result.deleted_count > 0, "id": entry_id}


@api.delete("/tenzor/history")
async def tenzor_history_clear():
    """Delete all TENZOR history entries."""
    result = await db.tenzor_history.delete_many({})
    return {"deleted": result.deleted_count}


# ════════════════════════════════════════════════════════════════
# TheOrbit — Cycle Engine endpoints
# /api/orbit/invoke  →  enriched tenzor + cycle state + agents
# /api/orbit/agents  →  live agent status snapshot
# /api/devcompass/analyze  →  8-agent feature/idea analysis
# ════════════════════════════════════════════════════════════════

class OrbitRequest(BaseModel):
    input: str = Field(..., min_length=1, max_length=2000)
    lang:  Optional[str] = Field(default="de")
    save:  Optional[bool] = Field(default=False)


class DevCompassRequest(BaseModel):
    idea: str = Field(..., min_length=1, max_length=2000)
    lang: Optional[str] = Field(default="de")


def _orbit_cycle_state(vector_4d: list) -> dict:
    if not _ORBIT_AVAILABLE:
        return {}
    import math
    theta = math.atan2(vector_4d[1], vector_4d[0])
    wk    = compute_warm_kalt(theta)
    h_idx = theta_to_house_index(theta)
    house = ORBIT_HOUSE_BY_INDEX[h_idx]
    comp  = ORBIT_HOUSE_BY_INDEX[house.opposite]
    return {
        "theta":          round(theta, 6),
        "theta_deg":      round(math.degrees(theta) % 360, 2),
        "house_index":    h_idx,
        "house_code":     house.code,
        "house_title":    house.title,
        "operator":       house.operator,
        "archetype":      house.archetype,
        "opposite_house": {
            "index":    comp.index,
            "code":     comp.code,
            "title":    comp.title,
            "operator": comp.operator,
        },
        "warm_kalt":  wk.label,
        "warm_score": round(wk.warm_score, 3),
        "flow":       round(wk.flow, 4),
        "force":      round(wk.force, 4),
        "character":  house.character,
        "sin2":       round(house.sin2, 3),
        "cos2":       round(house.cos2, 3),
    }


def _orbit_spin_dialog(bus) -> Optional[dict]:
    if bus is None:
        return None
    sd = bus.reconstruct_spin_dialog()
    if not sd.get("axes"):
        return None
    all_msgs = []
    for msgs in sd["axes"].values():
        all_msgs.extend(msgs)
    if not all_msgs:
        return None
    latest   = max(all_msgs, key=lambda m: m.get("timestamp", 0))
    axis_key = f"H{min(latest['from_house'], latest['to_house'])}-H{max(latest['from_house'], latest['to_house'])}"
    axis_msgs = sd["axes"].get(axis_key, [])
    return {
        "active_operator":     latest.get("from_operator"),
        "complement_operator": latest.get("to_operator"),
        "axis":                axis_key,
        "message_count":       len(axis_msgs),
        "last_theta":          latest.get("theta"),
        "last_warm_kalt":      latest.get("warm_kalt"),
        "cycle_id":            sd.get("cycle_id"),
    }


@api.post("/orbit/invoke")
async def orbit_invoke(payload: OrbitRequest):
    """
    Enriched TENZOR pass with full cycle state.
    Returns everything from /api/tenzor/invoke plus:
      cycle_state, spin_dialog, agent_statuses, bus_cycle_id.
    """
    result = await tenzor_invoke(payload.input, lang=payload.lang or "de")

    cycle_state = _orbit_cycle_state(result.get("vector_4d", [0, 0, 0, 0]))
    bus         = _orbit_get_bus() if _ORBIT_AVAILABLE else None
    spin_dialog = _orbit_spin_dialog(bus)

    agent_statuses: list = []
    if _ORBIT_AVAILABLE:
        try:
            agent_statuses = _orbit_get_registry().all_statuses()
        except Exception:
            pass

    return {
        **result,
        "cycle_state":    cycle_state,
        "spin_dialog":    spin_dialog,
        "agent_statuses": agent_statuses,
        "bus_cycle_id":   bus.current_cycle_id if bus else None,
        "orbit_version":  "v6",
    }


@api.get("/orbit/agents")
async def orbit_agents():
    """Live snapshot of all 8 agent states."""
    if not _ORBIT_AVAILABLE:
        return {"available": False, "agents": []}
    try:
        return {
            "available":    True,
            "agents":       _orbit_get_registry().all_statuses(),
            "bus_cycle_id": _orbit_get_bus().current_cycle_id,
            "bus_log_size": len(_orbit_get_bus().get_log(200)),
        }
    except Exception as exc:
        return {"available": False, "error": str(exc), "agents": []}


def _devcompass_perspective(operator: str, cycle_state: dict, sing: float, lang: str) -> str:
    house_title = cycle_state.get("house_title", "")
    wk          = cycle_state.get("warm_kalt", "NEUTRAL")
    flow        = cycle_state.get("flow", 0.0)
    de = {
        "The Seer":      f"Was ist die irreducible Wahrheit dieser Idee? Feld: {house_title}.",
        "The Guardian":  f"Welche Evidenz stützt das? Flow={flow:+.2f} — Struktur folgt Momentum.",
        "The Prophet":   "Was muss jetzt gesagt werden, vollständig und ohne Hedging?",
        "The Anchor":    "Was muss stabilisiert werden, bevor diese Idee skaliert?",
        "The Decoder":   "Welches tiefere Muster codiert diese Idee systemisch?",
        "The Healer":    f"Welche Spannung muss transformiert werden? Thermal={wk}.",
        "The Oracle":    f"Was sagen die Daten wirklich? Kohärenz={sing:.2f}.",
        "The Disruptor": "Was muss abgestoßen werden, damit das Nächste beginnen kann?",
    }
    en = {
        "The Seer":      f"What is the irreducible truth of this idea? Field: {house_title}.",
        "The Guardian":  f"What evidence supports this? Flow={flow:+.2f} — structure follows momentum.",
        "The Prophet":   "What needs to be said now, fully and without hedging?",
        "The Anchor":    "What must be stabilised before this idea can scale?",
        "The Decoder":   "What deeper pattern does this idea encode systemically?",
        "The Healer":    f"What tension must be transformed? Thermal={wk}.",
        "The Oracle":    f"What does the data actually say? Coherence={sing:.2f}.",
        "The Disruptor": "What must be shed so the next cycle can begin?",
    }
    return (de if lang == "de" else en).get(operator, "")


@api.post("/devcompass/analyze")
async def devcompass_analyze(payload: DevCompassRequest):
    """
    8-agent feature/idea analysis (DevCompass).

    Runs an idea through the resonance engine and returns structured
    perspectives from all 8 operator agents, urgency signal, and recommendation.
    """
    lang   = payload.lang or "de"
    result = await tenzor_invoke(payload.idea, lang=lang)

    cycle_state = _orbit_cycle_state(result.get("vector_4d", [0, 0, 0, 0]))
    sing        = result.get("score", 0.0)
    wk_label    = cycle_state.get("warm_kalt", "NEUTRAL")

    urgency_map = {
        "HOT":        "HIGH — forward momentum, ship or commit now",
        "WARM":       "MEDIUM — building, continue with evidence",
        "NULLSTELLE": "PIVOT — turning point, re-evaluate direction",
        "COLD":       "LOW — discharging, gather data before acting",
        "FREEZING":   "HOLD — peak reverse flow, do not commit",
        "NEUTRAL":    "UNCLEAR — insufficient resonance signal",
    }

    agent_views: list = []
    if _ORBIT_AVAILABLE:
        try:
            import math as _m
            registry     = _orbit_get_registry()
            active_house = cycle_state.get("house_index", 1)
            for status in registry.all_statuses():
                h        = ORBIT_HOUSE_BY_INDEX[status["house"]]
                h_diff   = min(abs(status["house"] - active_house),
                               8 - abs(status["house"] - active_house))
                relevance = round(1.0 - h_diff / 4.0, 2)
                agent_views.append({
                    "house":       status["house"],
                    "operator":    status["operator"],
                    "archetype":   h.archetype[:80] + "…",
                    "drift":       status["drift"],
                    "relevance":   relevance,
                    "beliefs":     status["beliefs"],
                    "perspective": _devcompass_perspective(
                        status["operator"], cycle_state, sing, lang
                    ),
                })
        except Exception:
            pass

    bus         = _orbit_get_bus() if _ORBIT_AVAILABLE else None
    spin_dialog = _orbit_spin_dialog(bus)

    return {
        "idea":  payload.idea[:120],
        "lang":  lang,
        "compass_reading": {
            "house_index": cycle_state.get("house_index"),
            "house_title": cycle_state.get("house_title"),
            "operator":    cycle_state.get("operator"),
            "theta_deg":   cycle_state.get("theta_deg"),
            "sing":        round(sing, 3),
            "warm_kalt":   wk_label,
            "character":   cycle_state.get("character"),
        },
        "recommendation": cycle_state.get("archetype", ""),
        "urgency":         urgency_map.get(wk_label, "UNCLEAR"),
        "spin_dialog":     spin_dialog,
        "agent_views":     agent_views,
        "insight":         result.get("insight", ""),
        "action":          result.get("action", ""),
        "elapsed_ms":      result.get("elapsed_ms", 0),
    }


app.include_router(api)
