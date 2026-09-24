# Implementation plan — MVP AIVision

## Scope lock

- Android-first Expo application.
- FastAPI modular monolith.
- No database, account system, RAG, agent framework, or persistent image storage.
- Focused label reading is the only product path.
- The user selects one target field before opening the camera.
- Fixture provider is explicit and deterministic; Groq is the default live vision provider and OpenAI remains optional.

## Dependency order

| Task | Deliverable | Depends on | Status |
|---|---|---|---|
| TASK-01 | Root workspace, environment template, shared commands | — | done |
| TASK-02 | API schemas, error envelope, configuration | TASK-01 | done |
| TASK-03 | Fixture, Groq and OpenAI vision providers with explicit fallback policy | TASK-02 | done |
| TASK-04 | Upload validation, rate limit and focused label endpoint | TASK-02, TASK-03 | done |
| TASK-05 | Mobile domain types, API client, state reducer | TASK-02 | done |
| TASK-06 | Accessible home, label camera, result and error flows | TASK-05 | done; device review pending |
| TASK-07 | Remove exploration; add target selection and focused TTS | TASK-05, TASK-06 | done; device review pending |
| TASK-08 | Backend and mobile unit/API tests | TASK-03, TASK-07 | done |
| TASK-09 | Deterministic evaluation dataset and report command | TASK-03 | done |
| TASK-10 | Docker, README commands, demo verification | TASK-04, TASK-08, TASK-09 | done |
| TASK-11 | EAS APK, Render HTTPS and revocable invite-code access | TASK-04, TASK-08, TASK-10 | done |
| TASK-12 | Camera-ready gate, bounded capture/API retries and focused label contract | TASK-04, TASK-07, TASK-11 | done; device test pending |
| TASK-13 | Up to three camera/library images per analysis and AIVision launcher icon | TASK-12 | done; device test pending |

## Verification result

- FastAPI: 29 tests passed.
- Mobile domain/state/config: 15 tests passed.
- TypeScript typecheck and ESLint passed.
- Expo Android production export passed.
- Docker API healthcheck reached `healthy`.
- Render-like Docker smoke test passed on `$PORT`: health `200`, missing token `401`, valid token `200`.
- Fixture evaluation generated JSON and Markdown reports.

## Acceptance checkpoints

1. Fixture mode runs without an external AI key and is visibly labeled.
2. Every label target traverses selection → camera/library queue → API → validated
   response → Vietnamese speech.
3. External provider timeout or malformed output becomes a controlled fallback or error.
4. Uploads with unsupported type, spoofed signature, empty body, or excess size are rejected.
5. Core TypeScript and Python tests pass.
6. Evaluation command produces JSON and Markdown reports without inventing real-world model quality.
7. API starts with Docker Compose; mobile starts through Expo on the host.

## Explicit risks

- No physical Android device is attached to this workspace, so TalkBack, camera focus, TTS voice, and haptics require final device verification.
- Synthetic fixture evaluation verifies system plumbing, not real model accuracy.
- Voice command selection remains out of scope until the button-first journey is stable on physical devices.
