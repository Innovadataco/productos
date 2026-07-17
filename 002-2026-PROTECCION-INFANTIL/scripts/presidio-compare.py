#!/usr/bin/env python3
"""
Compara Presidio contra el detector F2 sobre el fixture PII.
Uso:
    source .venv-presidio/bin/activate
    python scripts/presidio-compare.py scripts/eval-pii-fixture.json eval-results/f2-pii-1784162157696.json
"""
import json
import sys
from pathlib import Path


def normalize(s: str) -> str:
    return s.lower().strip().rstrip(".,;:!?")


def overlaps(a: str, b: str) -> bool:
    na, nb = normalize(a), normalize(b)
    return na in nb or nb in na


def fragment_recall(detected: list[str], expected: list[str]) -> float:
    if not expected:
        return 1.0 if not detected else 0.0
    found = sum(1 for e in expected if any(overlaps(d, e) for d in detected))
    return found / len(expected)


def main():
    fixture_path = sys.argv[1]
    f2_path = sys.argv[2]

    with open(fixture_path, "r", encoding="utf-8") as f:
        fixture = json.load(f)
    with open(f2_path, "r", encoding="utf-8") as f:
        f2 = json.load(f)

    try:
        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine import NlpEngineProvider
    except ImportError:
        print("Presidio no instalado.")
        raise SystemExit(1)

    config = {
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": "es", "model_name": "es_core_news_sm"}],
    }
    provider = NlpEngineProvider(nlp_configuration=config)
    analyzer = AnalyzerEngine(nlp_engine=provider.create_engine(), supported_languages=["es"])

    results = []
    for ex, f2r in zip(fixture["examples"], f2["details"]):
        text = ex["text"]
        expected = ex["piiEsperada"]
        presidio_results = analyzer.analyze(text=text, language="es")
        presidio_fragments = [text[r.start : r.end] for r in presidio_results]

        f2_detected = f2r["combined"]["piiDetectada"]

        results.append(
            {
                "text": text,
                "expectedPii": ex["contienePii"],
                "expectedFragments": expected,
                "f2Detected": f2r["combined"]["contienePii"],
                "f2Fragments": f2_detected,
                "f2FragmentRecall": round(fragment_recall(f2_detected, expected), 4),
                "presidioDetected": len(presidio_results) > 0,
                "presidioFragments": presidio_fragments,
                "presidioEntities": [r.entity_type for r in presidio_results],
                "presidioFragmentRecall": round(fragment_recall(presidio_fragments, expected), 4),
            }
        )

    # Métricas caso
    total = len(results)
    f2_tp = sum(1 for r in results if r["expectedPii"] and r["f2Detected"])
    f2_fp = sum(1 for r in results if not r["expectedPii"] and r["f2Detected"])
    f2_fn = sum(1 for r in results if r["expectedPii"] and not r["f2Detected"])
    pres_tp = sum(1 for r in results if r["expectedPii"] and r["presidioDetected"])
    pres_fp = sum(1 for r in results if not r["expectedPii"] and r["presidioDetected"])
    pres_fn = sum(1 for r in results if r["expectedPii"] and not r["presidioDetected"])

    summary = {
        "total": total,
        "f2": {
            "recall": round(f2_tp / (f2_tp + f2_fn), 4) if (f2_tp + f2_fn) else 0,
            "precision": round(f2_tp / (f2_tp + f2_fp), 4) if (f2_tp + f2_fp) else 0,
            "falsePositives": f2_fp,
            "fragmentRecall": round(sum(r["f2FragmentRecall"] for r in results) / total, 4),
        },
        "presidio": {
            "recall": round(pres_tp / (pres_tp + pres_fn), 4) if (pres_tp + pres_fn) else 0,
            "precision": round(pres_tp / (pres_tp + pres_fp), 4) if (pres_tp + pres_fp) else 0,
            "falsePositives": pres_fp,
            "fragmentRecall": round(sum(r["presidioFragmentRecall"] for r in results) / total, 4),
        },
    }

    out_dir = Path("eval-results")
    out_dir.mkdir(exist_ok=True)
    out_file = out_dir / f"presidio-comparison-{int(__import__('time').time() * 1000)}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "details": results}, f, indent=2, ensure_ascii=False)

    print(json.dumps(summary, indent=2))
    print(f"\nDetalle guardado en: {out_file}")


if __name__ == "__main__":
    main()
