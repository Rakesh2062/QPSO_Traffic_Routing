# QPSO-Based Traffic Routing Platform — Build Prompts

This folder contains structured prompts for building the platform described
in the Problem Statement: a quantum-inspired metaheuristic (QPSO) framework
for solving Vehicle Routing Problems and shortest-path problems under
simulated traffic, benchmarked against classical metaheuristics and exact
methods.

## Files in this folder

| File | Purpose |
|---|---|
| `00-database-schema.md` | PostgreSQL schema — tables, relationships, migration order |
| `01-backend-fastapi-qpso.md` | FastAPI backend, QPSO engine, baseline wrappers, job orchestration |
| `02-fitness-function.md` | Standalone spec for the QPSO fitness function (`fitness.py`) |
| `03-redis-integration.md` | Live progress streaming, job status cache, cancellation flag |
| `04-frontend-nextjs.md` | Next.js frontend — pages, components, API/WebSocket contracts |

## Why this order matters

Feeding all of these to an agent at once tends to produce a wide, shallow
result — a bit of everything, nothing fully wired together. Building in
this sequence means each stage has something real (not guessed) to build
against:

1. **Database schema first.** Every later prompt references specific table
   names, field names, and JSONB shapes. Generate the SQLAlchemy models and
   run the Alembic migration before moving on — confirm the tables actually
   exist.

2. **Backend + QPSO engine second.** Paste the database schema as context
   alongside this prompt so the agent writes real queries against real
   columns instead of inventing its own schema mid-build.

3. **Fitness function as a separate, later task — not part of step 2.**
   Once the QPSO swarm loop exists and is testable, hand over
   `02-fitness-function.md` as its own tightly scoped task. This is the one
   piece where a specific algorithm matters more than "something
   reasonable," so it shouldn't be built while the agent is also juggling
   routing endpoints.

4. **Redis integration as a follow-up patch, not bundled into the backend
   build.** Get the core API and QPSO engine working synchronously first
   (even without live progress). Then ask the agent to "add live progress
   streaming and job cancellation to the existing job runner." This makes
   it easy to tell whether a bug is in the algorithm or in the plumbing.

5. **Frontend last.** By this point the API contracts (REST shapes,
   WebSocket message format) are real and tested. Paste the actual working
   endpoint responses or finalized Pydantic schemas alongside the frontend
   prompt, not the earlier guessed contract.

## Checkpoint instruction

Add this to every prompt when handing it to an agent, regardless of stage:

> After implementing this, list what you built, what you stubbed or mocked,
> and what's still needed to integrate with the next component.

This surfaces silently deferred work before you move to the next stage,
rather than discovering it later when integration breaks.

## Testing gate between stages

Don't move to the next prompt until the current one passes a real check:

- [ ] Migrations applied, tables exist and match the schema
- [ ] QPSO engine tested standalone against a synthetic graph (fixed seed →
      reproducible fitness trajectory)
- [ ] API endpoints hit directly (curl/Postman) with real responses
- [ ] Redis pub/sub and job cancellation verified against a running job
- [ ] Frontend pointed at the live backend, not mock data

Slower than "generate everything at once," but it's the difference between
a demo that works and one that only looks like it works until the second
button is clicked.
