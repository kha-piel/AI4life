# Implementation plan — MVP Đôi Mắt AI

## Scope lock

- Android-first Expo application.
- FastAPI modular monolith.
- No database, account system, RAG, agent framework, or persistent image storage.
- Label reading is the primary demo path.
- Exploration is sampled scene analysis, not real-time navigation.
- Fixture provider is explicit and deterministic; OpenAI vision is optional via environment variables.

## Dependency order

| Task | Deliverable | Depends on | Status |
|---|---|---|---|
| TASK-01 | Root workspace, environment template, shared commands | — | done |
| TASK-02 | API schemas, error envelope, configuration | TASK-01 | done |
| TASK-03 | Fixture and OpenAI vision providers with fallback | TASK-02 | done |
| TASK-04 | Upload validation, rate limit, label/scene endpoints | TASK-02, TASK-03 | done |
| TASK-05 | Mobile domain types, API client, state reducer | TASK-02 | done |
| TASK-06 | Accessible home, label camera, result and error flows | TASK-05 | done; device review pending |
| TASK-07 | Exploration scan loop, alert deduplication, TTS/haptics | TASK-05, TASK-06 | done; device review pending |
| TASK-08 | Backend and mobile unit/API tests | TASK-03, TASK-07 | done |
| TASK-09 | Deterministic evaluation dataset and report command | TASK-03 | done |
| TASK-10 | Docker, README commands, demo verification | TASK-04, TASK-08, TASK-09 | done |

## Verification result

- FastAPI: 12 tests passed.
- Mobile domain/state: 6 tests passed.
- TypeScript typecheck and ESLint passed.
- Expo Android production export passed.
- Docker API healthcheck reached `healthy`.
- Fixture evaluation generated JSON and Markdown reports.

## Acceptance checkpoints

1. Fixture mode runs without an external AI key and is visibly labeled.
2. Label and scene requests traverse camera → API → validated response → Vietnamese speech.
3. External provider timeout or malformed output becomes a controlled fallback or error.
4. Uploads with unsupported type, spoofed signature, empty body, or excess size are rejected.
5. Core TypeScript and Python tests pass.
6. Evaluation command produces JSON and Markdown reports without inventing real-world model quality.
7. API starts with Docker Compose; mobile starts through Expo on the host.

## Explicit risks

- No physical Android device is attached to this workspace, so TalkBack, camera focus, TTS voice, and haptics require final device verification.
- Synthetic fixture evaluation verifies system plumbing, not real model accuracy.
- Scene mode cannot claim distance or motion direction without depth and multi-frame tracking.
