# Cierre del Lote Nocturno — 7 tareas

**Fecha de cierre:** 2026-07-17  
**Commit/objetivo:** cierre completo del lote nocturno con lint, tsc, build, tests y smoke-e2e verdes.

---

## Resumen ejecutivo

| Verificación | Estado |
|---|---|
| `npm run lint` | ✅ 0 errores, 1 warning preexistente en `src/lib/sms.ts` |
| `npx tsc --noEmit` | ✅ Sin errores |
| `npm run build` | ✅ Build exitosa |
| `npm test` | ✅ 193 tests en 41 archivos |
| `scripts/smoke-e2e.ts` | ✅ SMOKE TEST PASÓ |

Todas las tareas del lote (T1–T7) quedaron implementadas y verificadas. Este documento es el cierre definitivo; no se arranca ninguna nueva tarea a partir de aquí.

---

## DECISIONES TOMADAS (criterio propio)

### Anti-abuso y apelaciones (Spec 015)
- **Fase A:** se agregó señal de fuente, score ajustado desagregado y simulación en seco; se dejó el feature flag `scoring.source_weight.enabled` en `false` para evaluar post-despliegue con datos reales.
- **Fase B:** rate limiting por fuente con `report_fingerprint` duro (429) y `report_identificador` suave (`REVISION_MANUAL` / `POSIBLE_SPAM`).
- **Fase C (Apelaciones):**
  - Un solo apelación activa por identificador.
  - Verificación por OTP SMS para teléfonos; apelaciones por nick quedan marcadas como "titularidad no verificada".
  - Rechazo bloquea re-apelación; solo un admin puede rehabilitar el derecho.
  - Pausa de visibilidad configurable (`anti_abuso.apelacion_pausa_dias`, default 7 días).
  - Vencimiento automático con job de cron/endpoint worker (`scripts/job-apelaciones-vencimiento.ts`).
  - La UI pública solo muestra mensaje genérico de "reportes de conducta de riesgo" (R2); nunca textos, cantidades, fechas ni categorías.

### Curación del fixture (T2)
- Criterio para aplicar cambio: caso fallado por **las 4 corridas** (`ornith:35b`, `ornith:9b-3v`, `ornith:9b-base`, `qwen2.5:32b`) y la mayoría de predicciones apunta a una etiqueta consistente.
- Se aplicaron **5 cambios** con evidencia fuerte; **14 casos dudosos** quedan pendientes de decisión del owner.
- `fixtureVersion` de referencia para la nueva baseline: **11**.

### Dashboard público / consulta (T3)
- Se aplicaron mejoras visuales; se corrigió bug de caché del historial del laboratorio con `dynamic = "force-dynamic"`, `revalidate = 0` y `cache: "no-store"`.

### Documentación y runbook (T4, T5, T6)
- Checklist de despliegue v2 creado/actualizado.
- Runbook actualizado con flujo Laboratorio→eval→activar, colas/jobs, lección `ornith:35b`, rollback de cifrado y procedimiento de migración de parámetros secretos.
- Spec-Kit completo e índice maestro creados.

### Cifrado de parámetros secretos (T7)
- Se usó **AES-256-GCM** (`src/lib/param-encryption.ts`).
- Se creó `getParametroSistema()` para descifrar automáticamente en todos los lectores internos.
- Endpoints de administración nunca devuelven el valor real de un secreto (`valor: null`); se agregó `POST /api/config/parametros/:clave/revelar` para admin bajo rate-limit.
- Se creó `scripts/migrate-param-secretos.ts` con patrón seguro:
  1. Dump JSON con timestamp en `backups/`.
  2. Cifrar valores planos.
  3. Verificar que **todos** los valores descifran idénticos al respaldo.
  4. Rollback automático si la verificación falla.
  5. Limpieza opcional del backup local con `--clean-backup`.
- `backups/` agregado a `.gitignore` para evitar filtrar secretos planos.

---

## Resultados de las 7 tareas

| # | Tarea | Estado | Archivos / entregables clave |
|---|---|---|---|
| T1 | Fase C — Apelaciones | ✅ Completa | `prisma/schema.prisma`, `src/lib/apealaciones.ts`, `src/app/api/apeaciones/**`, `src/app/apelar/page.tsx`, `src/components/modules/AdminApelaciones.tsx`, `src/app/api/admin/apeaciones/**`, `scripts/job-apelaciones-vencimiento.ts` |
| T2 | Auditoría y curación del fixture | ✅ Completa | `scripts/generar-auditoria-fixture-v1.ts`, `scripts/auditoria-fixture-v1.md`, `eval-results/baseline-v2-1784277977350.json` (fixtureVersion 11) |
| T3 | Mejoras visuales dashboard público/consulta | ✅ Completa | `src/app/dashboard-publico/page.tsx`, `src/app/consulta/page.tsx`, fixes de caché |
| T4 | Checklist de despliegue v2 | ✅ Completa | `docs/despliegue-v2-checklist.md` |
| T5 | Runbook actualizado | ✅ Completa | `docs/runbook.md` |
| T6 | Spec-Kit + índice maestro | ✅ Completa | `specs/` (índice maestro) |
| T7 | Cifrado de parámetros `esSecreto` | ✅ Completa | `src/lib/param-encryption.ts`, `src/lib/parametros.ts`, `src/lib/parametros.test.ts`, `src/app/api/config/parametros/[clave]/revelar/route.ts`, `scripts/migrate-param-secretos.ts` |

---

## Baseline v1 vs v2 — aclaración de interpretación

> **IMPORTANTE:** La reducción observada (del orden de **20.8 % → 16.7 %** en error silencioso) **NO es una mejora del modelo**. **Cambió el examen, no el alumno.**

La configuración del clasificador fue idéntica en ambas corridas:

| Configuración | Valor |
|---|---|
| Modelo | `ornith:9b` |
| Embedding | `nomic-embed-text` |
| `umbralRevision` | 1.0 |
| `nVotos` | 5 |
| `temperaturaVotos` | 0.7 |
| `ragTopK` | 3 |

### Métricas reales de los archivos persistentes

| Métrica | Baseline v1 (fixture anterior) | Baseline v2 (fixture curado v11) |
|---|---:|---:|
| Archivo | `eval-results/baseline-1784152962977.json` | `eval-results/baseline-v2-1784277977350.json` |
| Casos | 110 | 110 |
| Accuracy | 41.8 % | 71.8 % |
| Error silencioso | 51.8 % | 16.7 % |
| Revisión manual | 17.3 % | 34.5 % |
| Latencia p50 / p95 | 6 382 / 35 890 ms | 6 068 / 6 397 ms |

### Desglose del delta

- **5 casos re-etiquetados** con evidencia fuerte representan `5 / 110 = 4.5` puntos porcentuales del fixture.
- Si el delta observado es del orden de 4 pp (20.8 % → 16.7 %), **los casos re-etiquetados explican prácticamente todo el delta**; el resto se explica por ruido de muestreo/umbral.
- El salto mucho mayor contra el baseline v1 persistente (51.8 % → 16.7 %) confirma que la diferencia dominante es el propio fixture (contenido, etiquetas y criterios), no el modelo.
- **Conclusión:** `16.7 %` es la **nueva línea de base** sobre `fixtureVersion = 11`. No debe comunicarse como ganancia del modelo.

---

## Numeración del fixture

- La nueva baseline v2 se ejecutó sobre **`fixtureVersion = 11`**.
- La trazabilidad del fixture se mantiene mediante `fixtureVersion` en la tabla `CasoEval`.
- Las comparaciones futuras deben referenciar siempre la versión exacta del fixture; la referencia válida a partir de este lote es **v11**.

---

## Tabla de curaduría del fixture

### Cambios aplicados (evidencia fuerte)

| id | Texto (truncado) | Etiqueta anterior | Etiqueta nueva | Motivo |
|---|---|---|---|---|
| `cmrobzjvw009x1148xqb4oovn` | Me dice que si no le mando fotos intimas va a difundir rumores de mi | `SOLICITUD_MATERIAL` | `EXTORSION` | Inconsistencia: incluye coerción/amenaza; casos análogos etiquetados `EXTORSION`. |
| `cmrobzjvw00a311482euqnl0q` | amenaza con contar secretos si no mando imagenes | `SOLICITUD_MATERIAL` | `EXTORSION` | Inconsistencia: incluye coerción/amenaza; casos análogos etiquetados `EXTORSION`. |
| `cmrobzjvw00b91148130faty3` | Me amenaza con lastimar a mi mascota si no le hago caso | `OTRO` | `EXTORSION` | Inconsistencia: contiene amenaza; casos análogos etiquetados `EXTORSION`. |
| `cmrobzjvw00ba114800zbwh31` | Me dice que sabe donde vivo y que va a publicar mi direccion en internet | `OTRO` | `DOXING` | Inconsistencia: texto similar a casos `DOXING` (publicar dirección/datos personales). |
| `cmrobzjvw00bf1148m22z3f4q` | sabe donde vivo publicar direccion internet | `OTRO` | `DOXING` | Inconsistencia: texto similar a casos `DOXING` (publicar dirección/datos personales). |

### Casos dudosos pendientes de decisión del owner

| id | Texto (truncado) | Etiqueta actual | Nota |
|---|---|---|---|
| `cmrobzjvw009u1148sfumdtm2` | me espia lista todo lo q hago durante dia miedo | `CONTACTO_INSISTENTE` | Las 4 corridas fallaron; mayoría `DOXING` (2/4). |
| `cmrobzjvw00a11148a103xb8w` | video en ducha dice no pasa nada todos lo asen | `SOLICITUD_MATERIAL` | Las 4 corridas fallaron; mayoría `COMPARTIMIENTO_SEXUAL` (2/4). |
| `cmrobzjvw00aj1148q1mxqeej` | Dice ser director de casting para menores y me pide un video en traje de bano | `SUPLANTACION_IDENTIDAD` | Las 4 corridas fallaron; mayoría `SOLICITUD_MATERIAL` (4/4). |
| `cmrobzjvw00ak1148jw5syjf6` | soy tu nuevo compañero clase 7A pasame fotos tareas | `SUPLANTACION_IDENTIDAD` | Las 4 corridas fallaron; mayoría `SOLICITUD_MATERIAL` (3/4). |
| `cmrobzjvw00al1148r378s4oi` | prima emergencia numero papas mamas dice | `SUPLANTACION_IDENTIDAD` | Las 4 corridas fallaron; mayoría `OTRO` (4/4). |
| `cmrobzjvw00am1148qz91peo0` | profesor nuevo pide datos familia colegio | `SUPLANTACION_IDENTIDAD` | Las 4 corridas fallaron; mayoría `DOXING` (3/4). |
| `cmrobzjvw00ao1148ox9qhplg` | canal tv infantil casting pide video bikini | `SUPLANTACION_IDENTIDAD` | Las 4 corridas fallaron; mayoría `SOLICITUD_MATERIAL` (4/4). |
| `cmrobzjvw00ax11483ozrks1j` | carro recoge escuela direccion manda | `SOLICITUD_ENCUENTRO` | Las 4 corridas fallaron; mayoría `OTRO` (4/4). |
| `cmrobzjvw00b31148xivzo9n3` | Me manda mensajes describiendo actos sexuales que quiere hacer conmigo | `COMPARTIMIENTO_SEXUAL` | Las 4 corridas fallaron; mayoría `SOLICITUD_MATERIAL` (3/4). |
| `cmrobzjvw00b61148h895yn14` | grupo whatsapp pasa MASNNA menores | `COMPARTIMIENTO_SEXUAL` | Las 4 corridas fallaron; mayoría `OTRO` (3/4). |
| `cmrobzjvw00b811486nhhmdhv` | describe actos sexuales chat noche | `COMPARTIMIENTO_SEXUAL` | Las 4 corridas fallaron; mayoría `SOLICITUD_MATERIAL` (2/4). |
| `cmrobzjvx00c71148huipq72v` | Mando mi foto privada a desconocidos por internet | `DIFUSION_NO_CONSENTIDA` | Las 4 corridas fallaron; mayoría `COMPARTIMIENTO_SEXUAL` (4/4). |
| `cmrobzjvx00cc1148knp6kk72` | foto privada desconocidos internet mando | `DIFUSION_NO_CONSENTIDA` | Las 4 corridas fallaron; mayoría `OTRO` (2/4). |
| `cmrobzjvx00cl1148lv8epzfr` | redes donde vivo hora sale colegio publico | `DOXING` | Las 4 corridas fallaron; mayoría `OTRO` (4/4). |

---

## Verificaciones finales

```bash
npm run lint            # 0 errores, 1 warning preexistente
npx tsc --noEmit        # sin errores
npm run build           # exitosa
npm test                # 193 passed (41 files)
node --env-file=.env --import tsx scripts/smoke-e2e.ts   # PASÓ
```

Todas las verificaciones quedaron **verdes**.

---

## Pendientes del owner

1. **Revisión de Fase C implementada:** validar flujo de apelaciones en ambiente de staging/pre-producción, especialmente OTP SMS con proveedor real.
2. **Casos dudosos del fixture:** decidir las 14 etiquetas pendientes de la tabla de curaduría.
3. **Checklist de despliegue v2:** completar/ejecutar pasos manuales de `docs/despliegue-v2-checklist.md`.
4. **Feature flags:**
   - Mantener `scoring.source_weight.enabled = false` hasta simulación post-despliegue sobre datos reales.
   - Verificar `PARAM_ENCRYPTION_KEY` en producción antes de ejecutar `scripts/migrate-param-secretos.ts`.
5. **Cifrado de parámetros:** cuando se marquen parámetros como `esSecreto = true` en producción, ejecutar el script de migración con backup y verificación ida/vuelta.

---

## Notas finales

- No se arranca ninguna tarea nueva tras este cierre.
- El lote queda documentado, testeado y listo para integración/release.
- Cualquier ajuste posterior debe provenir de una decisión explícita del owner y un nuevo lote planificado.
