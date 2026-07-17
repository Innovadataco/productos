#!/usr/bin/env python3
"""
Spike: comparar detección PII de Presidio (es_core_news_sm) contra el fixture F2.
Uso:
    source .venv-presidio/bin/activate
    python scripts/presidio-spike.py scripts/eval-pii-fixture.json
"""
import json
import sys
from pathlib import Path

try:
    from presidio_analyzer import AnalyzerEngine
    from presidio_analyzer.nlp_engine import NlpEngineProvider
except ImportError as e:
    print("Presidio no instalado. Ejecutar:")
    print("  python3 -m venv .venv-presidio")
    print("  source .venv-presidio/bin/activate")
    print("  pip install presidio-analyzer spacy")
    print("  python -m spacy download es_core_news_sm")
    raise SystemExit(1)


def normalize(s: str) -> str:
    return s.lower().strip().rstrip(".,;:!?")


def main():
    fixture_path = sys.argv[1] if len(sys.argv) > 1 else "scripts/eval-pii-fixture.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        fixture = json.load(f)

    examples = fixture["examples"]

    # Configurar Presidio con spaCy español
    config = {
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": "es", "model_name": "es_core_news_sm"}],
    }
    provider = NlpEngineProvider(nlp_configuration=config)
    analyzer = AnalyzerEngine(nlp_engine=provider.create_engine(), supported_languages=["es"])

    results = []
    presidio_only = []
    ours_only = []
    presidio_fps = []
    ours_fps = []

    for ex in examples:
        text = ex["text"]
        expected = [normalize(x) for x in ex["piiEsperada"]]
        expected_pii = ex["contienePii"]

        presidio_results = analyzer.analyze(text=text, language="es")
        presidio_fragments = [text[r.start : r.end] for r in presidio_results]
        presidio_detected = len(presidio_results) > 0

        # Determinístico local (no depende de TS para este spike)
        # Importamos el módulo TS vía subprocess para no reescribir en Python.
        results.append(
            {
                "text": text,
                "expectedPii": expected_pii,
                "expectedFragments": ex["piiEsperada"],
                "presidioDetected": presidio_detected,
                "presidioFragments": presidio_fragments,
                "presidioEntities": [r.entity_type for r in presidio_results],
            }
        )

    out_dir = Path("eval-results")
    out_dir.mkdir(exist_ok=True)
    out_file = out_dir / f"presidio-spike-{int(__import__('time').time() * 1000)}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"fixture": fixture_path, "results": results}, f, indent=2, ensure_ascii=False)

    print(f"Presidio analizó {len(examples)} casos.")
    print(f"Resultado guardado en: {out_file}")
    print("\nResumen por entidad:")
    from collections import Counter

    entities = Counter()
    for r in results:
        for e in r["presidioEntities"]:
            entities[e] += 1
    for entity, count in entities.most_common():
        print(f"  {entity}: {count}")


if __name__ == "__main__":
    main()
