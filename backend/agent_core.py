"""
agent_core.py — Multi-Agent Layer · Resonance Engine V6
========================================================

Hybrid architecture: the deterministic core (cycle_engine + orchestrator)
stays untouched. This layer adds 8 stateful agents that subscribe to the
Agent Bus and maintain their own perception, memory, and drift.

Each agent is a peer in the event field — not a function of the engine,
but an autonomous observer that decides whether and how to react.

Design principles (KISS)
------------------------
- Agents are synchronous (same thread as bus handlers)
- Memory = bounded deque of observations + a belief dict
- Drift = single float ∈ [0, 1] that evolves per cycle
- No LLM calls inside agents (yet) — responses are structured deltas
- Feedback path wired but passive: RESPONSE messages sit in bus log
  waiting for orchestrator Stage 6 to read and apply them

Agent lifecycle per event
--------------------------
  Bus fires event
    → agent.perceive(msg) → bool  (is this relevant to me?)
    → agent.reflect(msg)  → dict  (what do I think?)
    → agent.act(deltas, msg)      (emit RESPONSE to bus)
    → agent.memory updated

Cross-axis coupling (canonical)
---------------------------------
  H3 Prophet ↔ H7 Oracle : broadcast ↔ distil
  H1 Seer    ↔ H5 Decoder : origin ↔ synthesis
  H2 Guardian↔ H6 Healer  : structure ↔ restoration
  H4 Anchor  ↔ H8 Disruptor: grounding ↔ rupture
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field
from typing import Optional

from agent_bus import AgentBus, AgentMessage, MessageType, get_bus
from cycle_engine import HOUSE_BY_INDEX, HouseDefinition


# ---------------------------------------------------------------------------
# Agent memory
# ---------------------------------------------------------------------------

@dataclass
class AgentMemory:
    """
    Minimal persistent state for one agent.

    observations : last N AgentMessages this agent perceived (bounded deque)
    beliefs      : agent-specific dict — updated after each reflection
    drift        : accumulated drift from baseline ∈ [0, 1]
                   grows when agent keeps reacting, decays toward 0 when quiet
    cycle_count  : number of ZYKLUS events this agent has witnessed
    """
    observations: deque = field(default_factory=lambda: deque(maxlen=20))
    beliefs:      dict  = field(default_factory=dict)
    drift:        float = 0.0
    cycle_count:  int   = 0

    def observe(self, msg: AgentMessage) -> None:
        self.observations.append(msg)

    def update_drift(self, reacted: bool) -> None:
        """Drift grows on reaction, decays on silence."""
        if reacted:
            self.drift = min(1.0, self.drift + 0.05)
        else:
            self.drift = max(0.0, self.drift * 0.92)


# ---------------------------------------------------------------------------
# Base agent
# ---------------------------------------------------------------------------

class BaseAgent:
    """
    Abstract base for all 8 operator agents.

    Subclasses override:
      perceive(msg) → bool   : filter — is this message relevant?
      reflect(msg)  → dict   : produce aspect_score_deltas (bounded ±0.2)
      initial_beliefs() → dict : starting belief state
    """

    def __init__(self, house_def: HouseDefinition, bus: AgentBus) -> None:
        self.house   = house_def
        self.memory  = AgentMemory(beliefs=self.initial_beliefs())
        self._bus    = bus

        # Subscribe to all message types — perceive() filters internally
        bus.subscribe(MessageType.SPIN,       self._handle)
        bus.subscribe(MessageType.NULLSTELLE, self._handle)
        bus.subscribe(MessageType.ZYKLUS,     self._on_zyklus)
        bus.subscribe(MessageType.RESPONSE,   self._on_response)

    # ── Public interface ──────────────────────────────────────────────────

    def initial_beliefs(self) -> dict:
        """Override to provide agent-specific starting beliefs."""
        return {}

    def perceive(self, msg: AgentMessage) -> bool:
        """Return True if this message is relevant to this agent."""
        return msg.to_house == self.house.index or msg.from_house == self.house.index

    def reflect(self, msg: AgentMessage) -> dict:
        """
        Produce aspect_score_deltas based on this message.
        Values should be small floats in [-0.2, +0.2].
        Return {} to abstain.
        """
        return {}

    # ── Internal handlers ─────────────────────────────────────────────────

    def _handle(self, msg: AgentMessage) -> None:
        if not self.perceive(msg):
            self.memory.update_drift(reacted=False)
            return

        self.memory.observe(msg)
        deltas = self.reflect(msg)
        reacted = bool(deltas)

        if reacted:
            self._act(deltas, msg)

        self.memory.update_drift(reacted=reacted)

    def _on_zyklus(self, msg: AgentMessage) -> None:
        self.memory.cycle_count += 1
        self._on_cycle_complete(msg)

    def _on_response(self, msg: AgentMessage) -> None:
        """Agents can observe other agents' responses — default: ignore."""
        pass

    def _on_cycle_complete(self, msg: AgentMessage) -> None:
        """Hook for subclasses to react to Zyklus completion."""
        pass

    def _act(self, deltas: dict, trigger: AgentMessage) -> None:
        """Emit a RESPONSE message with the reflection deltas."""
        from cycle_engine import compute_warm_kalt
        wk = compute_warm_kalt(trigger.theta)
        self._bus.emit_response(
            from_house=self.house.index,
            to_house=trigger.from_house,
            aspect_score_deltas=deltas,
            theta=trigger.theta,
            wk=wk,
            sing=trigger.sing,
            source_operator=self.house.operator,
        )

    @property
    def name(self) -> str:
        return self.house.operator

    @property
    def house_index(self) -> int:
        return self.house.index

    def status(self) -> dict:
        """Snapshot of agent state for inspection / API."""
        return {
            "operator":    self.name,
            "house":       self.house_index,
            "drift":       round(self.memory.drift, 3),
            "cycle_count": self.memory.cycle_count,
            "beliefs":     self.memory.beliefs,
            "observations": len(self.memory.observations),
        }


# ---------------------------------------------------------------------------
# The 8 Agents
# ---------------------------------------------------------------------------

class TheSeer(BaseAgent):
    """H1 / ORIGIN — analytical_coldness
    Attention: NULLSTELLE events — turning points, pure structural moments.
    When the force peaks and flow is zero, The Seer reads the irreducible state.
    """

    def initial_beliefs(self) -> dict:
        return {"last_force_peak": 0.0, "clarity": 1.0}

    def perceive(self, msg: AgentMessage) -> bool:
        return msg.type == MessageType.NULLSTELLE

    def reflect(self, msg: AgentMessage) -> dict:
        force = abs(msg.force)
        # High force peak = more structural clarity needed
        delta = round((force - 1.0) * 0.06, 4)   # force=2 → +0.06
        self.memory.beliefs["last_force_peak"] = round(force, 3)
        self.memory.beliefs["clarity"] = round(1.0 - self.memory.drift, 3)
        return {"analytical_coldness": delta} if abs(delta) > 0.01 else {}


class TheGuardian(BaseAgent):
    """H2 / OFFERING — evidential_density
    Attention: HOT/WARM messages — peak forward flow.
    Accumulates structural evidence when momentum is strongest.
    """

    def initial_beliefs(self) -> dict:
        return {"flow_accumulation": 0.0, "structure_confidence": 0.5}

    def perceive(self, msg: AgentMessage) -> bool:
        return msg.warm_kalt in ("HOT", "WARM") and msg.flow > 0

    def reflect(self, msg: AgentMessage) -> dict:
        acc = self.memory.beliefs["flow_accumulation"]
        acc = min(1.0, acc + msg.flow * 0.1)
        self.memory.beliefs["flow_accumulation"] = round(acc, 3)
        self.memory.beliefs["structure_confidence"] = round(
            0.5 + acc * 0.3, 3
        )
        # More flow = denser evidence signal
        delta = round(msg.flow * 0.08, 4)
        return {"evidential_density": delta}


class TheProphet(BaseAgent):
    """H3 / EXPRESSION — relational_warmth
    Cross-axis H3 ↔ H7: The Prophet broadcasts what The Oracle distils.
    Attention: SPIN messages from H7 (Oracle → Prophet direction).
    """

    def initial_beliefs(self) -> dict:
        return {
            "oracle_signal_strength": 0.5,
            "broadcast_intensity":    0.5,
            "last_oracle_theme":      None,
        }

    def perceive(self, msg: AgentMessage) -> bool:
        # Actively listens to Oracle (H7 → H3) and own SPIN events
        return (
            (msg.type == MessageType.SPIN and msg.from_house == 7 and msg.to_house == 3)
            or (msg.to_house == self.house.index)
        )

    def reflect(self, msg: AgentMessage) -> dict:
        if msg.from_house == 7:
            # Oracle is feeding signal — amplify warmth proportional to Oracle's sing
            strength = round(msg.sing, 3)
            self.memory.beliefs["oracle_signal_strength"] = strength
            theme = msg.content.get("semantic_payload", "")[:60]
            self.memory.beliefs["last_oracle_theme"] = theme
            # Boost broadcast intensity
            intensity = min(1.0, 0.5 + strength * 0.4)
            self.memory.beliefs["broadcast_intensity"] = round(intensity, 3)
            delta = round((strength - 0.5) * 0.15, 4)
            return {"relational_warmth": delta}
        return {}


class TheAnchor(BaseAgent):
    """H4 / GROUND — groundedness
    Attention: COLD/FREEZING moments — reverse flow, system discharge.
    Stabilises when the field decelerates hardest.
    """

    def initial_beliefs(self) -> dict:
        return {"grounding_load": 0.0, "stability_index": 0.8}

    def perceive(self, msg: AgentMessage) -> bool:
        return msg.warm_kalt in ("COLD", "FREEZING") or msg.to_house == self.house.index

    def reflect(self, msg: AgentMessage) -> dict:
        load = self.memory.beliefs["grounding_load"]
        reverse_magnitude = abs(min(0.0, msg.flow))
        load = min(1.0, load + reverse_magnitude * 0.12)
        self.memory.beliefs["grounding_load"] = round(load, 3)
        stability = max(0.2, 1.0 - load * 0.5)
        self.memory.beliefs["stability_index"] = round(stability, 3)
        delta = round(reverse_magnitude * 0.1, 4)
        return {"groundedness": delta} if delta > 0.01 else {}


class TheDecoder(BaseAgent):
    """H5 / EMBODIMENT — structural_completeness
    Attention: ZYKLUS events — cycle completions.
    After each cycle, distils the pattern and updates structural beliefs.
    """

    def initial_beliefs(self) -> dict:
        return {
            "cycle_pattern": [],
            "structural_depth": 0.5,
            "dominant_axis": None,
        }

    def perceive(self, msg: AgentMessage) -> bool:
        # ZYKLUS events and SPIN events directed at H5
        return msg.type == MessageType.ZYKLUS or msg.to_house == self.house.index

    def reflect(self, msg: AgentMessage) -> dict:
        if msg.type == MessageType.ZYKLUS:
            # Analyse the log of the just-completed cycle
            log = self._bus.get_log(30)
            spin_houses = [m.from_house for m in log if m.type == MessageType.SPIN]
            if spin_houses:
                from collections import Counter
                dominant = Counter(spin_houses).most_common(1)[0][0]
                self.memory.beliefs["dominant_axis"] = f"H{dominant}"
            depth = min(1.0, 0.5 + self.memory.cycle_count * 0.02)
            self.memory.beliefs["structural_depth"] = round(depth, 3)
            delta = round((depth - 0.5) * 0.1, 4)
            return {"structural_completeness": delta}
        return {}

    def _on_cycle_complete(self, msg: AgentMessage) -> None:
        self.memory.beliefs["cycle_pattern"].append(self.memory.cycle_count)
        if len(self.memory.beliefs["cycle_pattern"]) > 10:
            self.memory.beliefs["cycle_pattern"].pop(0)


class TheHealer(BaseAgent):
    """H6 / VALUE — transformative_tension
    Attention: transitions from COLD/FREEZING back to WARM/HOT.
    Detects the moment of transformation and boosts value restoration.
    """

    def initial_beliefs(self) -> dict:
        return {"tension_held": 0.0, "restoration_potential": 0.5, "prev_thermal": None}

    def perceive(self, msg: AgentMessage) -> bool:
        prev = self.memory.beliefs.get("prev_thermal")
        current = msg.warm_kalt
        # Perceive: cold-to-warm transition OR messages to this house
        transition = prev in ("COLD", "FREEZING") and current in ("WARM", "HOT")
        self.memory.beliefs["prev_thermal"] = current
        return transition or msg.to_house == self.house.index

    def reflect(self, msg: AgentMessage) -> dict:
        tension = self.memory.beliefs["tension_held"]
        if msg.warm_kalt in ("WARM", "HOT"):
            # Release tension into restoration
            release = min(tension, 0.15)
            self.memory.beliefs["tension_held"] = round(tension - release, 3)
            self.memory.beliefs["restoration_potential"] = round(
                min(1.0, 0.5 + release * 3), 3
            )
            return {"transformative_tension": round(release, 4)}
        elif msg.warm_kalt in ("COLD", "FREEZING"):
            # Accumulate tension
            self.memory.beliefs["tension_held"] = round(min(1.0, tension + 0.08), 3)
        return {}


class TheOracle(BaseAgent):
    """H7 / FEEDBACK — semantic_depth
    Cross-axis H7 ↔ H3: The Oracle distils what The Prophet broadcasts.
    Attention: SPIN messages from H3 (Prophet → Oracle direction).
    Inward intelligence: semantic depth, pattern in noise.
    """

    def initial_beliefs(self) -> dict:
        return {
            "prophet_broadcast_topic": None,
            "data_density":            0.5,
            "pattern_confidence":      0.5,
            "distillation":            None,
        }

    def perceive(self, msg: AgentMessage) -> bool:
        # Actively listens to Prophet (H3 → H7) and own SPIN events
        return (
            (msg.type == MessageType.SPIN and msg.from_house == 3 and msg.to_house == 7)
            or (msg.to_house == self.house.index)
        )

    def reflect(self, msg: AgentMessage) -> dict:
        if msg.from_house == 3:
            # Prophet is broadcasting — distil
            topic = msg.content.get("semantic_payload", "")[:60]
            self.memory.beliefs["prophet_broadcast_topic"] = topic
            density = round(min(1.0, self.memory.beliefs["data_density"] + msg.sing * 0.1), 3)
            self.memory.beliefs["data_density"] = density
            # Confidence grows with density over time
            confidence = round(0.4 + density * 0.4 + self.memory.cycle_count * 0.01, 3)
            confidence = min(0.95, confidence)
            self.memory.beliefs["pattern_confidence"] = confidence
            self.memory.beliefs["distillation"] = f"density={density:.2f} conf={confidence:.2f}"
            delta = round((confidence - 0.5) * 0.12, 4)
            return {"semantic_depth": delta}
        return {}


class TheDisruptor(BaseAgent):
    """H8 / EVALUATION — social_calibration
    Attention: ZYKLUS events — is this cycle worth completing?
    Evaluates and, when stagnation is detected, amplifies disruption signal.
    """

    def initial_beliefs(self) -> dict:
        return {
            "stagnation_index": 0.0,
            "disruption_signal": 0.0,
            "cycles_without_change": 0,
        }

    def perceive(self, msg: AgentMessage) -> bool:
        return msg.type in (MessageType.ZYKLUS, MessageType.SPIN) or msg.to_house == self.house.index

    def reflect(self, msg: AgentMessage) -> dict:
        if msg.type == MessageType.ZYKLUS:
            # Evaluate cycle freshness: if drift is low → stagnation
            log = self._bus.get_log(20)
            unique_houses = len({m.from_house for m in log if m.type == MessageType.SPIN})
            stagnation = round(max(0.0, 1.0 - unique_houses / 8.0), 3)
            self.memory.beliefs["stagnation_index"] = stagnation
            if stagnation > 0.6:
                self.memory.beliefs["cycles_without_change"] = (
                    self.memory.beliefs.get("cycles_without_change", 0) + 1
                )
                disruption = round(min(0.2, stagnation * 0.15), 4)
                self.memory.beliefs["disruption_signal"] = disruption
                return {"social_calibration": disruption}
            else:
                self.memory.beliefs["cycles_without_change"] = 0
                self.memory.beliefs["disruption_signal"] = 0.0
        return {}


# ---------------------------------------------------------------------------
# Agent Registry
# ---------------------------------------------------------------------------

# House index → agent class
_AGENT_CLASSES: dict[int, type] = {
    1: TheSeer,
    2: TheGuardian,
    3: TheProphet,
    4: TheAnchor,
    5: TheDecoder,
    6: TheHealer,
    7: TheOracle,
    8: TheDisruptor,
}


class AgentRegistry:
    """
    Holds and manages all 8 agents.
    Use init_agents() to create a wired registry.
    """

    def __init__(self, agents: dict[int, BaseAgent]) -> None:
        self._agents = agents  # house_index → agent

    def get(self, house_index: int) -> Optional[BaseAgent]:
        return self._agents.get(house_index)

    def all_statuses(self) -> list[dict]:
        return [self._agents[i].status() for i in sorted(self._agents)]

    def agent_for_operator(self, operator_name: str) -> Optional[BaseAgent]:
        for agent in self._agents.values():
            if agent.name == operator_name:
                return agent
        return None


def init_agents(bus: Optional[AgentBus] = None) -> AgentRegistry:
    """
    Instantiate all 8 agents and wire them to the bus.
    Call once at application startup.

    Usage:
        from agent_core import init_agents
        registry = init_agents()   # uses module-level singleton bus
    """
    b = bus or get_bus()
    agents = {
        idx: cls(HOUSE_BY_INDEX[idx], b)
        for idx, cls in _AGENT_CLASSES.items()
    }
    return AgentRegistry(agents)


# ---------------------------------------------------------------------------
# Module-level singleton registry (lazy init on first access)
# ---------------------------------------------------------------------------

_registry: Optional[AgentRegistry] = None


def get_registry() -> AgentRegistry:
    """Return the process-wide AgentRegistry (lazy init)."""
    global _registry
    if _registry is None:
        _registry = init_agents()
    return _registry
