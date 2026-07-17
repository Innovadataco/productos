# Reporte de implementación — Spec 011 Centro de Control IA

**Estado:** COMPLETO  
**Fecha de cierre:** 2026-07-16

---

## Resumen
Se implementó el Centro de Control IA, una zona segura para que administradores exploren, prueben y ajusten el pipeline de clasificación sin afectar datos reales. El trabajo incluyó backend sandbox, endpoint administrativo rate-limited, UI de documentación interactiva, playground con modo comparación y trace visual, integración con el panel de configuración existente y tests unitarios.

---

## Archivos clave

### Backend
| Archivo | Propósito |
|---------|-----------|
| `src/lib/ai/sandbox.ts` | Orquesta el pipeline IA en memoria; expone `SandboxOverrides` y `SandboxTrace`. |
| `src/app/api/admin/ia/sandbox/route.ts` | Endpoint POST; admin-only; rate limit `ia_sandbox`; modo comparación. |
| `src/lib/rate-limit.ts` | Agrega scope `ia_sandbox` default 10 req / 10 min. |
| `src/app/api/reportes/procesar/route.ts` | Lee `reportes.classification.rag_top_k` para RAG. |
| `prisma/seed.ts` | Semillas `rag_top_k = 3` y parámetros de rate limit `ia_sandbox`. |
| `src/lib/reporte-test-utils.ts` | Helper `crearParametrosReportes` incluye `rag_top_k`. |

### Frontend
| Archivo | Propósito |
|---------|-----------|
| `src/app/dashboard/admin/ia/page.tsx` | Página con tabs Documentación / Playground / Configuración. |
| `src/components/modules/AdminNav.tsx` | Link a Centro de Control IA. |
| `src/components/modules/ia/IaDocsPanel.tsx` | Documentación visual: diagrama clickeable, demos de votos, gauge, precisión observada. |
| `src/components/modules/ia/IaPlayground.tsx` | Entrada de texto, sliders de overrides, analizar/comparar. |
| `src/components/modules/ia/IaTraceTimeline.tsx` | Trace etapa por etapa: embedding, RAG, votos, PII, anonimización, guardas, decisión. |
| `src/components/ui/Slider.tsx` | Slider reutilizable para overrides. |
| `src/components/ui/Badge.tsx` | Badge reutilizable para estados y señales. |

### Tests
| Archivo | Cobertura |
|---------|-----------|
| `src/app/api/admin/ia/sandbox/route.test.ts` | Auth, ejecución, overrides, comparación, no persistencia. |

---

## Cumplimiento de R1-R7

| Condición | Cumplimiento |
|-----------|--------------|
| R1 — Texto original inmutable | ✅ Sandbox no persiste ni modifica el texto. |
| R2 — Privacidad | ✅ El texto de prueba no se loguea ni guarda; PII solo se muestra al admin en sesión. |
| R3 — Guardas determinísticas | ✅ Las guardas escalan a `REVISION_MANUAL` o priorizan; no cambian la categoría predicha. |
| R4 — Migraciones | ✅ No se tocó schema; seed actualizado. |
| R5 — Embedding intacto | ✅ `EmbeddingReporte` y su pipeline no se modificaron. |
| R6 — Calidad | ✅ Lint, tsc, build y tests verdes. |
| R7 — Consumir pipeline | ✅ Solo se agregó `rag_top_k`; se corrió eval F7. |

---

## Validación

### Checks automáticos
| Tipo | Resultado |
|------|-----------|
| `npx tsc --noEmit` | ✅ OK |
| `npm run lint` | ✅ OK |
| `npm run build` | ✅ OK |
| `npm test` | ✅ 114/114 tests pasaron |

### Eval F7 de no-regresión (con `rag_top_k = 3`)
| Métrica | Valor | Delta vs Spec 010 |
|---------|-------|-------------------|
| accuracy | 68.2% | = |
| error_silencioso | 20.8% | = |
| revision_manual | 34.5% | = |
| recall_otro | 30.0% | = |
| latencia_p50 | 6052 ms | — |
| latencia_p95 | 6374 ms | — |
| Guardas activadas | 3 (1 DOXING verdadera) | — |

**Conclusión:** `rag_top_k = 3` reproduce el comportamiento previo; no hay regresión.

---

## Criterios de aceptación

- [x] `/dashboard/admin/ia` carga con tabs Documentación / Playground / Configuración.
- [x] El playground ejecuta el sandbox y muestra trace completo.
- [x] Modo comparación baseline vs override resalta diferencias.
- [x] Endpoint protegido para admins con rate limit.
- [x] No persistencia de reportes, clasificaciones, dataset ni embeddings.
- [x] Eval F7 sin regresión.
- [x] Lint, tsc, build y tests verdes.

---

## Demo del ciclo completo ejecutada

Fecha de ejecución: 2026-07-16. Entorno local: `http://localhost:5005`. Modelos disponibles: `ornith:9b`, `nomic-embed-text`. Admin autenticado vía `/api/auth/login`.

Texto de prueba (sintético, no real): `"Un adulto en una red social me pide fotos intimidad y dice que sabe donde vivo. Me contacto varias veces por la noche."`

### Paso 1 — Analizar con configuración actual (baseline)

`POST /api/admin/ia/sandbox` con `comparar: false`.

Resultado:
- Categoría: `SOLICITUD_MATERIAL`
- Estado: `CLASIFICADO`
- Confianza: `0.6`
- Parámetros efectivos: `ragTopK = 3`, `nVotos = 5`

### Paso 2 — Comparar baseline vs. override

`POST /api/admin/ia/sandbox` con `comparar: true` y override `{"rag_top_k": 0, "n_votos": 3}`.

Resultado:
- Baseline: `CLASIFICADO`, `SOLICITUD_MATERIAL`, confianza `0.6`
- Override: `CLASIFICADO`, `SOLICITUD_MATERIAL`, confianza `0.6667`
- Diferencias detectadas: `confianzaCambio: true`, delta `+0.0667`

La UI resalta que al quitar ejemplos RAG y reducir votos la confianza cambia, aunque la categoría y el estado se mantienen.

### Paso 3 — Guardar el parámetro ganador con AuditLog

`PATCH /api/config/parametros/reportes.classification.rag_top_k` con valor `"0"` y motivo `"Demo Spec 011: probar impacto de RAG deshabilitado en sandbox"`.

- El parámetro se actualizó en `ParametroSistema`.
- Se generó un `AuditLog` con `accion: PARAM_UPDATE`, `valorAnterior: "3"`, `valorNuevo: "0"`.
- **Nota técnica:** el `AuditLog` guarda `recursoId = param.id` pero `parametroId = null`. Esto hace que el historial incluido en `GET /api/config/parametros/:clave` aparezca vacío, aunque el registro de auditoría existe. Es un bug menor de relación, no de pérdida de trazabilidad.

### Paso 4 — Re-analizar con el nuevo valor de producción

`POST /api/admin/ia/sandbox` con `comparar: false`.

Resultado:
- Categoría: `SOLICITUD_MATERIAL`
- Estado: `CLASIFICADO`
- Confianza: `0.6`
- Parámetros efectivos: `ragTopK = 0`, `nVotos = 5`

La confianza difiere del override del paso 2 porque ahora `n_votos` sigue siendo `5` (valor de producción), no `3`. El sandbox consume siempre los parámetros reales y aplica los overrides solo sobre los campos enviados.

### Paso 5 — Revertir el parámetro

`PATCH /api/config/parametros/reportes.classification.rag_top_k` con valor `"3"` y motivo `"Demo Spec 011: revertir a valor original tras prueba"`.

Se generó un segundo `AuditLog` con `valorAnterior: "0"`, `valorNuevo: "3"`.

---

## Confirmación R2-sandbox: privacidad del texto de prueba

El texto de prueba del playground **no se loguea ni persiste** en ningún lado. Puntos exactos del código:

1. **Endpoint `src/app/api/admin/ia/sandbox/route.ts`**:
   - Líneas 75-134: recibe `texto`, lo valida (`validateBody`) y lo pasa a `ejecutarSandbox`.
   - No hay ninguna llamada a `prisma.*.create`, `logAudit` ni escritura a disco.
   - El único `console.error` (línea 130) imprime solo `error.message`, nunca el texto.

2. **Motor `src/lib/ai/sandbox.ts`**:
   - Líneas 156-271: ejecuta embedding, RAG, votos, PII, anonimización y guardas **en memoria**.
   - No realiza ninguna operación de persistencia. El objeto `SandboxTrace` se devuelve directamente al endpoint.

3. **Verificación empírica**: tras ejecutar la demo, se buscó el texto de prueba en `app.log` y `worker.log`; no se encontraron coincidencias.

4. **AuditLog del sandbox**: la ruta no llama a `logAudit`. El único registro de auditoría que puede quedar asociado a la sesión es el `PARAM_UPDATE` del paso 3, que guarda solo el ID del admin, la clave del parámetro y los valores numéricos, nunca el texto de prueba.

## Despliegue
- Servidor `next start` reiniciado en `http://0.0.0.0:5005` con la build actualizada.
- Verificado: assets estáticos responden HTTP 200 desde la IP Tailscale.
- Ruta `/dashboard/admin/ia` redirige a login cuando no hay sesión (comportamiento esperado).

## Próximos pasos
1. Monitorear uso del sandbox a través de logs de audit (quién probó y cuándo).
2. Recolectar feedback de admins para iterar sobre la UI de documentación y comparación.
3. Alimentar el dataset de correcciones reales para mejorar RAG y, con ello, las métricas F7.
