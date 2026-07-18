> # Research — Anonimización reforzada + encriptación del original

**Date**: 2026-07-18
**Feature**: specs/025-anonimizacion-reforzada/spec.md

---

## Decisión D1: Mantener detector actual + LLM, evaluar Presidio como capa adicional

### Detector actual (`src/lib/ai/pii-patterns.ts` + `src/lib/ai/pii-detector.ts`)

**Capa 1 — Determinística**: regex especializadas para:
- Nombres propios de menores en contexto familiar/escolar.
- Instituciones educativas (colegios, escuelas, universidades).
- Direcciones colombianas (calle/carrera/av/diagonal/transversal + números).
- Teléfonos personales de NNA/denunciante.

**Capa 2 — LLM (`ornith:9b`)**: prompt específico que clasifica PII de menores y auto-identificación del denunciante, con reglas de negocio (no marcar identificador del agresor, nombres de adultos agresores, palabras sueltas como "mamá").

**Fusión**: OR lógico; si cualquiera detecta PII, `contienePii = true`.

### Presidio (`.venv-presidio`)

**Qué es**: toolkit de Microsoft para detección y anonimización de PII. Soporta NER pre-entrenado y reglas personalizadas. Tiene soporte para español limitado en modelos spacy (`es_core_news_sm`).

**Evaluación**:

| Aspecto | Detector actual | Presidio |
|---------|-----------------|----------|
| Cobertura NER genérica | Media (regex + LLM) | Alta (spacy NER) |
| Contexto de grooming/menores | Alta (reglas de negocio) | Media (requiere adaptación) |
| Latencia | Baja (regex) + LLM | Media/alta (modelo spacy) |
| Costo operativo | Ninguno extra | Mantener venv + modelo español |
| Falsos positivos (nombres agresor) | Bajo (excluye explícitamente) | Alto (detectaría cualquier nombre) |
| Integración | Ya en producción | Requiere wrapper nuevo |

**Decisión**: No reemplazar el detector actual. Evaluar **Presidio como capa adicional opcional** en un experimento del Laboratorio de IA (Spec 014) para medir:
- Recall adicional sobre PII de menores no capturada por regex/LLM.
- Precisión: tasa de falsos positivos sobre nombres de agresores.
- Latencia sumada al pipeline.

Si el experimento mejora métricas sin degradar precisión, se integra como tercera capa bajo feature flag (`anonimizacion.presidio.enabled`).

---

## Decisión D2: Cifrado con wrapper AES-256-GCM existente

**Herramienta**: `src/lib/param-encryption.ts` (`encryptParameter` / `decryptParameter`).

**Rationale**:
- Ya probado en producción para `ParametroSistema.esSecreto`.
- Usa `PARAM_ENCRYPTION_KEY` de 32 bytes.
- Permite rotar clave y detectar campos cifrados por prefijo `enc:`.

**Aplicación**: `textoOriginal` se cifra al crear el reporte y se descifra solo en endpoint de revelado con autorización.

---

## Decisión D3: Validación por operador, no por admin

**Decisión**: El operador (primer línea de revisión) valida si la anonimización es correcta.

**Rationale**:
- Reduce carga del admin.
- El operador ya está entrenado para revisar casos.
- El admin conserva la capacidad de revelar original en casos excepcionales.

---

## Open questions

1. ¿Quién más allá de ADMIN puede revelar original? Por ahora: solo ADMIN.
2. ¿Se requiere aprobación de dos ojos (operador + comité) para revelar? Por ahora: no; audit log suficiente.
3. ¿Presidio se evalúa antes o después del despliegue inicial? Después, en fase de afinamiento (SPEC-050).
