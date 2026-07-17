# Research — Decisiones exploratorias del rediseño del clasificador IA

## Spike: Microsoft Presidio como tercera capa de PII

**Fecha**: 2026-07-15  
**Entorno**: Python 3.11, `presidio-analyzer` 2.2.363, spaCy `es_core_news_sm`, 100% local.  
**Fixture**: `scripts/eval-pii-fixture.json` (24 casos).

### Cómo se corrió

```bash
python3.11 -m venv .venv-presidio
source .venv-presidio/bin/activate
pip install presidio-analyzer spacy
python -m spacy download es_core_news_sm
python scripts/presidio-spike.py scripts/eval-pii-fixture.json
python scripts/presidio-compare.py scripts/eval-pii-fixture.json eval-results/f2-pii-1784162157696.json
```

### Resultado agregado

| Métrica | Detector F2 (det + LLM) | Presidio default |
|---|---|---|
| Recall caso | 100.0% | 71.4% |
| Precisión caso | 100.0% | 76.9% |
| Falsos positivos | 0 | 3 |
| Fragment recall | 88.9% | 54.2% |

Detalle: `eval-results/presidio-comparison-1784162841906.json`.

### Qué detecta Presidio que F2 no

- Nombres de adultos agresores (`Carlos Pérez`, `José Martínez`) y nombres de plataformas (`WhatsApp`, `Instagram`) como entidad `PERSON`.
- Bajo nuestras reglas de negocio, estos son **falsos positivos**: el teléfono/nick/nombre del agresor no es PII de la víctima.

### Qué detecta F2 que Presidio no

- Teléfonos atribuidos a NNA (`3001234567`, `3009876543`, etc.).
- Direcciones colombianas concretas (`carrera 45 # 12-34`, `Avenida 68 # 24-10`, etc.); Presidio solo devuelve tokens sueltos como `Avenida` o `La Salle`.
- Colegios/instituciones con nombre propio (`colegio San José`, `liceo Nacional`).
- Datos escolares (`grado 10B`, `salón 5B`).
- Contextos ruidosos con errores ortográficos (`cole sanhose`, `clle 12 # 3-45`).

### Falsos positivos de cada lado

- **F2**: 0 a nivel caso. A nivel fragmento presenta alucinaciones puntuales en textos ruidosos (ej. detecta `niño`, `casa`, `escuela`, `amigos` en casos donde no aparecen).
- **Presidio**: 3 falsos positivos a nivel caso (nombres de adultos + plataformas) y detección genérica de ubicaciones que no son PII actionable en el dominio.

### Conclusión

**Descartar Presidio como tercera capa por defecto.**

Su fortaleza (nombres propios) ya está cubierta por nuestra capa determinística + LLM, y su debilidad principal —no entender direcciones/teléfonos colombianos ni la regla "agresor no es PII"— coincide exactamente con el hueco crítico del dominio.

Podría reconsiderarse en el futuro para:
- Soporte multilingüe adicional.
- Un reconocedor custom de entidades colombianas entrenado dentro de Presidio.

Ambas opciones exceden el alcance y timebox actuales.
