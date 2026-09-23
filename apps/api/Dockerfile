FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY apps/api/pyproject.toml ./
RUN mkdir app \
    && touch app/__init__.py \
    && pip install ".[dev]" \
    && rm -rf app

COPY apps/api/app ./app
COPY apps/api/tests ./tests
COPY evals ./evals

RUN useradd --create-home --uid 10001 appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
