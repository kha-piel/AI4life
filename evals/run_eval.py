import asyncio
import json
import statistics
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.providers.fixture import FixtureVisionProvider
from app.schemas import LabelTarget


ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset.jsonl"
REPORT_DIR = ROOT / "reports"


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, round((len(ordered) - 1) * fraction))
    return ordered[index]


async def evaluate() -> dict[str, Any]:
    provider = FixtureVisionProvider()
    rows = [
        json.loads(line)
        for line in DATASET_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    field_checks: list[bool] = []
    abstention_checks: list[bool] = []
    latencies_ms: list[float] = []
    cases: list[dict[str, Any]] = []

    for row in rows:
        started = time.perf_counter()
        image_bytes = b"\xff\xd8\xff" + row["fixture_id"].encode()
        expected = row["expected"]

        requested_field = LabelTarget(row["requested_field"])
        result = await provider.analyze_label(
            [(image_bytes, "image/jpeg")],
            row.get("ocr_text"),
            "vi-VN",
            requested_field,
        )
        actual = getattr(result, expected["field"])
        match = actual == expected["value"]
        field_checks.append(match)
        abstention_ok = (actual is None or actual == []) == expected["abstain"]
        abstention_checks.append(abstention_ok)
        case_result = {
            "requested_field": requested_field.value,
            "field": expected["field"],
            "match": match,
            "abstention_ok": abstention_ok,
        }

        latency_ms = (time.perf_counter() - started) * 1000
        latencies_ms.append(latency_ms)
        cases.append(
            {
                "fixture_id": row["fixture_id"],
                "kind": "label",
                "latency_ms": round(latency_ms, 3),
                **case_result,
            }
        )

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "provider": "fixture",
        "dataset_type": "synthetic",
        "sample_size": len(rows),
        "metrics": {
            "field_accuracy": sum(field_checks) / len(field_checks),
            "abstention_correctness": (
                sum(abstention_checks) / len(abstention_checks)
                if abstention_checks
                else None
            ),
            "latency_p50_ms": round(statistics.median(latencies_ms), 3),
            "latency_p95_ms": round(percentile(latencies_ms, 0.95), 3),
        },
        "cases": cases,
        "limitations": [
            "Synthetic fixtures verify deterministic plumbing, not model quality.",
            "No real camera, OCR, lighting, blur, or user accessibility data is included.",
        ],
    }


def render_markdown(report: dict[str, Any]) -> str:
    metrics = report["metrics"]
    return "\n".join(
        [
            "# Evaluation card — fixture provider",
            "",
            f"- Dataset: {report['dataset_type']} ({report['sample_size']} cases)",
            f"- Field accuracy: {metrics['field_accuracy']:.1%}",
            f"- Abstention correctness: {metrics['abstention_correctness']:.1%}",
            f"- Latency p50/p95: {metrics['latency_p50_ms']} / {metrics['latency_p95_ms']} ms",
            "",
            "## Limitations",
            "",
            *[f"- {item}" for item in report["limitations"]],
        ]
    )


async def main() -> None:
    report = await evaluate()
    markdown = render_markdown(report)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "latest.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (REPORT_DIR / "latest.md").write_text(markdown + "\n", encoding="utf-8")
    print(markdown)


if __name__ == "__main__":
    asyncio.run(main())
