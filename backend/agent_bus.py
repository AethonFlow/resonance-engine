"""
agent_bus.py — Agent Bus Layer (ABL) · Resonance Engine V6
===========================================================

KISS principle: one file, no external dependencies, no broker infrastructure.
The bus is a synchronous, in-process message router backed by a bounded deque.

Core primitive: AgentMessage — a typed, routable envelope.

Message lifecycle
-----------------
1. tenzor_invoke() calls get_bus().on_state_update(theta, vector_4d, sing, scores)
2. The bus evaluates three event conditions (house crossing, nullstelle, zyklus)
3. Each fired event becomes one or two AgentMessages added to the log
4. Registered subscribers are called synchronously (fire-and-forget)
5. Messages are returned to the caller for inclusion in the tenzor response

Feedback path (v0.1 — wired, not yet activated)
------------------------------------------------
When an operator LLM call produces a structured Response, it should call:

    bus.emit_response(
        to_house=active_house_idx,
        from_house=complement_house_idx,
        aspect_score_deltas={"relational_warmth": +0.15, ...},
        theta=current_theta,
        wk=current_wk,
        sing=current_sing,
    )

The orchestrator can then feed aspect_score_deltas back into
apply_aspect_matrix_py() on the *next* tenzor pass — closing the loop
without modifying θ directly (symplectic structure preserved).
"""

from __future__ import annotations

import time
import uuid
from collections import deque
from dataclasses import asdict, dataclass
from enum import Enum
from typing import Callable, Optional

from cycle_engine import (
    FORCE_PEAK_THRESHOLD,
    HOUSE_BY_INDEX,
    WarmKaltResult,
    compute_warm_kalt,
    theta_to_house_index,
)


# ---------------------------------------------------------------------------
# Message types
# ---------------------------------------------------------------------------

class MessageType(str, Enum):
    SPIN       = "SPIN"        # House boundary crossed → antipodal dialog
    QUERY      = "QUERY"       # Operator requests data from complement
    RESPONSE   = "RESPONSE"    # Structured response with aspect_score_deltas
    NULLSTELLE = "NULLSTELLE"  # Force-peak event |2cos(2θ)| > threshold
    ZYKLUS     = "ZYKLUS"      # H8 → H1 wrap: cycle completed


# ---------------------------------------------------------------------------
# Message envelope
# ---------------------------------------------------------------------------

@dataclass
class AgentMessage:
    """
    Single routable message on the Agent Bus.

    content keys (by type):
      SPIN       : semantic_payload (str), aspect_score_deltas (dict), raw_signal (any)
      RESPONSE   : aspect_score_deltas (dict), source_operator (str)
      NULLSTELLE : character (str), force (float)
      ZYKLUS     : note (str)
      QUERY      : query (str)
    """
    message_id:    str
    cycle_id:      str
    type:          MessageType
    from_house:    int
    from_operator: str
    to_house:      int
    to_operator:   str
    theta:         float
    timestamp:     float
    intent:        str          # broadcast | request | reflect | evaluate | complete
    warm_kalt:     str
    flow:          float        # sin(2θ)
    force:         float        # 2·cos(2θ)
    sing:          float        # SING INDEX at time of emission
    content:       dict

    def to_dict(self) -> dict:
        d = asdict(self)
        d["type"] = self.type.value  # serialize enum as string
        return d


# ---------------------------------------------------------------------------
# Agent Bus
# ---------------------------------------------------------------------------

class AgentBus:
    """
    Synchronous, in-process message router.

    Thread-safety: not guaranteed — designed for single-threaded FastAPI async.
    The bus does NOT make LLM calls; it routes messages and maintains the log.
    LLM calls remain in orchestrator.py (single-pass guarantee preserved).
    """

    MAX_LOG: int = 200

    def __init__(self) -> None:
        self._log: deque[AgentMessage] = deque(maxlen=self.MAX_LOG)
        self._handlers: dict[MessageType, list[Callable[[AgentMessage], None]]] = {
            t: [] for t in MessageType
        }
        self._current_cycle_id: str = str(uuid.uuid4())
        self._prev_house: Optional[int] = None

    # ── Public API ──────────────────────────────────────────────────────────

    def on_state_update(
        self,
        theta: float,
        vector_4d: list[float],
        sing: float,
        scores: list[float],
    ) -> list[AgentMessage]:
        """
        Main entry point — call once per tenzor pass.

        Parameters
        ----------
        theta     : phase angle from _arg_z1() in orchestrator
        vector_4d : Troika rotor vector [cos θ, sin θ, -sin θ, cos θ]
        sing      : SING INDEX (0…1)
        scores    : 8 aspect scores from probe

        Returns
        -------
        List of AgentMessages emitted this pass (may be empty).
        """
        wk        = compute_warm_kalt(theta)
        house_idx = theta_to_house_index(theta)
        house     = HOUSE_BY_INDEX[house_idx]
        emitted:  list[AgentMessage] = []

        # ── Event 1: ZYKLUS — H8 → H1 wrap ─────────────────────────────────
        if self._prev_house == 8 and house_idx == 1:
            self._current_cycle_id = str(uuid.uuid4())
            emitted.append(self._build(
                msg_type=MessageType.ZYKLUS,
                from_h=8, to_h=1,
                theta=theta, wk=wk, sing=sing,
                intent="complete",
                content={"note": "Zyklus complete — new cycle begins"},
            ))

        # ── Event 2: NULLSTELLE — force peak, flow near zero ─────────────────
        if abs(wk.force) > FORCE_PEAK_THRESHOLD and abs(wk.flow) < 0.15:
            emitted.append(self._build(
                msg_type=MessageType.NULLSTELLE,
                from_h=house_idx, to_h=house_idx,
                theta=theta, wk=wk, sing=sing,
                intent="reflect",
                content={"character": house.character, "force": round(wk.force, 4)},
            ))

        # ── Event 3: SPIN — house boundary crossed ───────────────────────────
        if self._prev_house is not None and self._prev_house != house_idx:
            complement_idx = house.opposite
            complement     = HOUSE_BY_INDEX[complement_idx]

            # Outbound: active operator broadcasts to complement
            emitted.append(self._build(
                msg_type=MessageType.SPIN,
                from_h=house_idx, to_h=complement_idx,
                theta=theta, wk=wk, sing=sing,
                intent="broadcast",
                content={
                    "semantic_payload":    house.archetype,
                    "aspect_score_deltas": {},
                    "raw_signal":          None,
                },
            ))

            # Inbound: complement reflects back to active
            emitted.append(self._build(
                msg_type=MessageType.SPIN,
                from_h=complement_idx, to_h=house_idx,
                theta=theta, wk=wk, sing=sing,
                intent="reflect",
                content={
                    "semantic_payload":    complement.archetype,
                    "aspect_score_deltas": {},
                    "raw_signal":          None,
                },
            ))

        # ── Dispatch ─────────────────────────────────────────────────────────
        for msg in emitted:
            self._log.append(msg)
            for handler in self._handlers.get(msg.type, []):
                try:
                    handler(msg)
                except Exception:
                    pass  # subscribers must not crash the pipeline

        self._prev_house = house_idx
        return emitted

    def emit_response(
        self,
        *,
        from_house: int,
        to_house: int,
        aspect_score_deltas: dict[str, float],
        theta: float,
        wk: WarmKaltResult,
        sing: float,
        source_operator: str = "",
    ) -> AgentMessage:
        """
        Emit a structured RESPONSE message (operator LLM output).

        aspect_score_deltas feed back into apply_aspect_matrix_py()
        on the next tenzor pass — the only safe feedback path.
        """
        msg = self._build(
            msg_type=MessageType.RESPONSE,
            from_h=from_house, to_h=to_house,
            theta=theta, wk=wk, sing=sing,
            intent="evaluate",
            content={
                "aspect_score_deltas": aspect_score_deltas,
                "source_operator":     source_operator,
            },
        )
        self._log.append(msg)
        for handler in self._handlers.get(MessageType.RESPONSE, []):
            try:
                handler(msg)
            except Exception:
                pass
        return msg

    def subscribe(
        self,
        msg_type: MessageType,
        handler: Callable[[AgentMessage], None],
    ) -> None:
        """Register a synchronous handler for a message type."""
        self._handlers[msg_type].append(handler)

    def get_log(self, n: int = 20) -> list[AgentMessage]:
        """Return the last n messages from the log."""
        msgs = list(self._log)
        return msgs[-n:] if n < len(msgs) else msgs

    def reconstruct_spin_dialog(self, cycle_id: Optional[str] = None) -> dict:
        """
        Reconstruct the SpinDialog for a given cycle from the message log.

        SpinDialog is an emergent property of the message stream —
        this function materialises it on demand from the log.

        Returns a dict keyed by axis (e.g. "H3-H7") with message lists.
        """
        cid  = cycle_id or self._current_cycle_id
        msgs = [
            m for m in self._log
            if m.cycle_id == cid and m.type == MessageType.SPIN
        ]

        pairs: dict[str, list[dict]] = {}
        for m in msgs:
            key = f"H{min(m.from_house, m.to_house)}-H{max(m.from_house, m.to_house)}"
            pairs.setdefault(key, []).append(m.to_dict())

        return {
            "cycle_id":      cid,
            "message_count": len(msgs),
            "axes":          pairs,
        }

    @property
    def current_cycle_id(self) -> str:
        return self._current_cycle_id

    @property
    def current_house(self) -> Optional[int]:
        return self._prev_house

    def reset(self) -> None:
        """Full reset — clears log, cycle, house memory."""
        self._log.clear()
        self._prev_house = None
        self._current_cycle_id = str(uuid.uuid4())

    # ── Internal ─────────────────────────────────────────────────────────────

    def _build(
        self,
        msg_type: MessageType,
        from_h: int,
        to_h: int,
        theta: float,
        wk: WarmKaltResult,
        sing: float,
        intent: str,
        content: dict,
    ) -> AgentMessage:
        return AgentMessage(
            message_id=    str(uuid.uuid4()),
            cycle_id=      self._current_cycle_id,
            type=          msg_type,
            from_house=    from_h,
            from_operator= HOUSE_BY_INDEX[from_h].operator,
            to_house=      to_h,
            to_operator=   HOUSE_BY_INDEX[to_h].operator,
            theta=         round(theta, 6),
            timestamp=     time.time(),
            intent=        intent,
            warm_kalt=     wk.label,
            flow=          round(wk.flow, 4),
            force=         round(wk.force, 4),
            sing=          round(sing, 4),
            content=       content,
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_bus: Optional[AgentBus] = None


def get_bus() -> AgentBus:
    """Return the process-wide AgentBus instance (lazy init)."""
    global _bus
    if _bus is None:
        _bus = AgentBus()
    return _bus
