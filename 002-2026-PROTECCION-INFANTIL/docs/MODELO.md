# MODELO — Clasificación de reportes y cálculo de riesgo

> Explica **cómo decide** el sistema cuando entra un reporte. Los valores exactos
> (modelo, umbrales, pesos) viven en el **código** y en `ParametroSistema` (BD); este
> documento explica el **flujo y los conceptos** y enlaza a la fuente para lo volátil.
> No copiar aquí valores que cambian — se desactualiza.

## 1. Flujo, de lo barato a lo caro

```
Reporte entrante
   │
   ├─ 1. Guardas deterministas (reglas, sin IA)      ← barato
   ├─ 2. Anonimización (regex + IA)
   ├─ 3. Clasificador IA (Ollama) → {categoría, confianza}
   ├─ 4. Confianza vs umbral → estado (auto | revisión humana)
   ├─ 5. Desempate (2º modelo + votos) si hay duda
   └─ 6. Score / severidad del identificador          ← caro
```

Principio: **la IA es cara y falible (~20% de error)**; las capas baratas (rate-limit, keywords, dedup) filtran antes para no malgastarla.

## 2. Las capas

### 2.1 Guardas (reglas, sin IA)
Red de seguridad determinista antes/aparte del modelo:
- `src/lib/ai/keywords-riesgo.ts` — señales de riesgo por palabras clave.
- `src/lib/ai/pii-detector.ts` · `pii-patterns.ts` — detección de datos personales.
- `src/lib/ai/anonimizador.ts` — anonimiza víctima/denunciante (regex + IA).

### 2.2 Clasificador IA — `src/lib/ai/classifier.ts` (`clasificarReporte`)
- **Recibe:** texto anonimizado + un *system prompt* con las 12 categorías, sus fronteras excluyentes y **ejemplos few-shot** recuperados por RAG (embeddings `nomic-embed-text` + pgvector, `dataset-retrieval.ts`).
- **Modelo:** Ollama, configurable (`reportes.classification_model`; en producción `ornith:9b`).
- **Devuelve:** `{ categoria, confianza }`. **Determinista** (temperatura/seed fijos → mismo input, mismo output).

### 2.3 Umbral y estado
- `umbralRevision` (política **F5 = 1.0**): si `confianza ≥ umbral` → **auto-clasificado**; si no → **REVISION_MANUAL** (humano).
- El umbral alto manda casi todo a revisión a propósito: **minimiza el error silencioso** (clasificar mal con alta confianza; ~21.9% con la política F5).

### 2.4 Desempate (cascada)
Un **segundo modelo** (`modeloDesempate`) + votos resuelve los casos donde el primero no está seguro (RAG + votos, la política ganadora del A/B).

### 2.5 Score / severidad — `src/lib/riesgo-consulta.ts`
Cada categoría tiene una **severidad** (0–95): `COMPARTIMIENTO_SEXUAL`=95, `SOLICITUD_ENCUENTRO`/`DIFUSION_NO_CONSENTIDA`=90 … `CONTACTO_INSISTENTE`=30, `OTRO`=20, `SPAM`=0.

El score del identificador combina 3 factores (pesos **parametrizables**, default 50/30/20):
```
score ≈ confianza × pesoConfianza + factorCantidad × pesoCantidad + gravedad × pesoGravedad
```
Claves: `risk.peso_confianza`, `risk.peso_cantidad`, `risk.peso_gravedad`.

## 3. Las 12 categorías (enum `CategoriaConducta`, `prisma/schema.prisma`)
`CONTACTO_INSISTENTE`, `SOLICITUD_MATERIAL`, `OFRECIMIENTO_REGALOS`, `SUPLANTACION_IDENTIDAD`, `SOLICITUD_ENCUENTRO`, `COMPARTIMIENTO_SEXUAL`, `EXTORSION`, `CONTENIDO_GENERADO_IA`, `DIFUSION_NO_CONSENTIDA`, `DOXING`, `OTRO`, `SPAM`. Se muestran al usuario final agrupadas en 5 grupos (`categoria-grupos.ts`).

## 4. Cómo se evalúa — `src/lib/ai/eval-runner.ts`
Corre el clasificador sobre casos con `categoriaEsperada` y compara predicho vs esperado:
- **accuracy**, **precisión** de auto-clasificados, **error silencioso** (incorrecto con alta confianza), activación de **guardas** (doxing, keywords).
- El **"modelo de validación" no es un modelo aparte**: la validación son las guardas + el umbral + el desempate + el Comité humano.

## 5. Parametrización (vive en BD, no en este doc)
Configurable desde el panel admin (`ParametroSistema`): modelo de clasificación, umbral de revisión, pesos del score, `system.ollama_base_url`, `ia.simulacion_timeout_minutos`, etc. **Cambiar comportamiento no requiere tocar código.**

## 6. Fuente de verdad (código)
`classifier.ts` · `keywords-riesgo.ts` · `pii-detector.ts` · `anonimizador.ts` · `riesgo-consulta.ts` · `eval-runner.ts` · `dataset-retrieval.ts` · `prisma/schema.prisma` (enum + severidad).

---
> **📋 Control** · v1.0 · 2026-07-22 18:43 (-05) · Autor: ZEUS · Verificado contra el código en esta fecha.
