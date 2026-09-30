# QPSO Traffic Routing

A full-stack optimization platform for traffic-aware routing and vehicle assignment using a quantum-inspired particle swarm optimization (QPSO) engine. The project compares QPSO against classical baselines such as PSO, genetic algorithms, ant colony optimization, and OR-Tools on synthetic and road-network scenarios.

## Overview

This project combines:

- A FastAPI backend for scenario creation, benchmarking, and optimization job orchestration
- A QPSO-based routing engine for dynamic traffic and fleet scheduling problems
- Redis-backed progress tracking and cancellation signals for long-running jobs
- PostgreSQL persistence for scenarios, results, and convergence history
- A Next.js frontend for scenario creation, benchmarking dashboards, and result visualization

The system is designed to let users build traffic graphs, define routing scenarios, run multiple optimization algorithms, and compare convergence, route quality, fitness, and runtime metrics.

## Project structure

```text
.
├── README.md
├── requirements.txt
├── alembic.ini
├── pytest.ini
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── benchmarking/
│   │   ├── core/
│   │   ├── engine/
│   │   ├── jobs/
│   │   └── main.py
│   ├── alembic/
│   ├── db/
│   ├── models/
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── next.config.ts
│   └── ...
└── ...
```

## Key capabilities

- Traffic routing on graph-based networks using objective weights and constraints
- Multiple optimization algorithms in one evaluation pipeline
- Scenario persistence and historical result retrieval
- Benchmark summaries with aggregated fitness and comparative improvement metrics
- Live job status polling and cancellation flow over Redis
- Visual dashboard for graph/studio views, convergence charts, and benchmark output

## Tech stack

### Backend

- Python 3.11+
- FastAPI
- SQLAlchemy + AsyncPG
- Alembic migrations
- Redis
- NetworkX + NumPy
- OR-Tools
- Pytest

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Recharts
- Leaflet
- Zustand state management

## Prerequisites

Before running the app locally, install:

- Python 3.11+
- Node.js 20+
- PostgreSQL
- Redis

## Local setup

### 1) Clone and install backend dependencies

```bash
cd "D:\Codes\QPSO Traffic Routing"
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

### 2) Configure environment variables

Create a `.env` file in the project root (or in the backend working directory depending on where the app reads settings from). The app expects values similar to:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/qpso_routing
REDIS_URL=redis://localhost:6379
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:3000
```

If your runtime uses the application settings object directly, ensure the values match the names used in `backend/app/core/config.py`.

### 3) Start PostgreSQL and Redis

Make sure a local PostgreSQL instance is running and a database named `qpso_routing` exists. Then start Redis on its default port (`6379`).

### 4) Run the backend

```bash
cd "D:\Codes\QPSO Traffic Routing"
.\.venv\Scripts\Activate.ps1
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:

- http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- Health checks: http://localhost:8000/health

### 5) Run the frontend

```bash
cd "D:\Codes\QPSO Traffic Routing\frontend"
npm install
npm run dev
```

Open:

- http://localhost:3000

## Backend API overview

The FastAPI app exposes routes for scenario execution, benchmarking, and result access.

### System endpoints

- `GET /` — API metadata
- `GET /health` — backend health and dependency status
- `GET /db-health` — database and Redis status

### Scenario endpoints

- `POST /api/scenarios` — create and queue a scenario job
- `GET /api/scenarios/{scenario_id}` — fetch current job status
- `GET /api/scenarios/{scenario_id}/results` — retrieve algorithm outputs and convergence history
- `POST /api/scenarios/{scenario_id}/cancel` — request cancellation
- `GET /api/scenarios/presets/all` — preset scenario definitions

### Benchmark endpoints

- `GET /api/benchmark` — aggregated benchmark statistics across historical runs

## Core backend modules

- `backend/app/engine/` — graph model, traffic simulation, baseline algorithms, and QPSO modules
- `backend/app/jobs/` — job runner and worker orchestration
- `backend/app/api/` — endpoint definitions and contract handlers
- `backend/app/benchmarking/` — metric aggregation and comparison logic
- `backend/models/` — SQLAlchemy models for graphs, scenarios, runs, and convergence data
- `backend/alembic/` — migration history and schema changes

## Frontend overview

The frontend includes pages for:

- scenario creation and configuration
- graph visualization and route studio views
- result dashboards and benchmark comparison charts
- historical scenario review
- settings and configuration management

This is implemented through the app router structure under `frontend/src/app` and supporting chart/map components under `frontend/src/components`.

## Testing

Run Python tests from the project root:

```bash
cd "D:\Codes\QPSO Traffic Routing"
pytest
```

Run frontend validation:

```bash
cd "D:\Codes\QPSO Traffic Routing\frontend"
npm run lint
npm run build
```

## Notes

- The backend automatically creates database tables during startup in development mode, while Alembic remains available for migration-based schema management.
- Redis is used for short-lived job status caching and cancellation flags during long-running optimization tasks.
- Production deployments should use environment-specific credentials and secure secret management for database and Redis access.

## Future improvements

Potential enhancements for the project include:

- stronger persistence and audit history for scenarios and param sets
- richer optimization benchmarking and statistical reporting
- deployment automation with Docker Compose or Kubernetes
- more advanced traffic simulation fidelity and larger graph workloads
- additional result exports and downloadable benchmark reports

## License

This project is currently configured as a local development workspace without a formal license file. If you plan to distribute or deploy it publicly, add a license such as MIT or Apache 2.0 before release.
