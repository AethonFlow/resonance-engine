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

load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

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
    """Single Claude Haiku 4.5 call returning 8 scored dimensions."""
    if not EMERGENT_LLM_KEY:
        return _empty_probe_result("(no LLM key)")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"sphere-probe-{uuid.uuid4()}",
            system_message=_PROBE_SYSTEM,
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        user_text = (
            f'Input:\n"""\n{user_input}\n"""\n\n'
            "Return the JSON object measuring all 8 dimensions."
        )
        raw = await chat.send_message(UserMessage(text=user_text))
    except Exception as exc:  # noqa: BLE001
        return _empty_probe_result(f"(llm error: {type(exc).__name__})")
    return _parse_probe_payload(raw if isinstance(raw, str) else str(raw))


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


@api.delete("/tenzor/history/{entry_id}")
async def tenzor_history_delete(entry_id: str):
    res = await db.tenzor_history.delete_one({"id": entry_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "history entry not found")
    return {"deleted": True, "id": entry_id}


@api.delete("/tenzor/history")
async def tenzor_history_clear():
    res = await db.tenzor_history.delete_many({})
    return {"deleted": int(res.deleted_count)}


app.include_router(api)
