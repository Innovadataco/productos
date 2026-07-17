# Reporte — Cierre de Gaps Críticos

**Estado:** COMPLETO  
**Branch:** `feature/001-scaffolding`  
**Commit:** `feat(gaps): cierra F1 UI scoring, F5 onboarding, F7 alertas email`

---

## GAP 1: F7 Alertas Email

**Estado:** COMPLETO

| Criterio | Estado |
|----------|--------|
| Modelo en schema | ✅ `AlertaSuscripcion` creado con relaciones a `Usuario` y `Plataforma`, índices y `@@unique([usuarioId, identificador, plataformaId])` |
| Migración aplicada | ✅ `20260715000000_alertas_suscripcion` + `20260715000001_alertas_suscripcion_unique` |
| API endpoints | ✅ `GET /api/alertas`, `POST /api/alertas/suscribir`, `DELETE /api/alertas/:id` |
| Worker envía emails | ✅ `enviarAlertasSuscriptores()` en `src/lib/email.ts` invocado desde `/api/reportes/procesar` |
| Máximo 1 email / 24h | ✅ Filtro por `ultimoEmailEn` y cooldown de 24h |
| Contenido del email | ✅ Identificador, total de reportes y link a consulta pública |

### Endpoints implementados
- `GET /api/alertas` — lista suscripciones activas del usuario autenticado.
- `POST /api/alertas/suscribir` — crea/reactiva una suscripción; valida que el identificador exista y sea público.
- `DELETE /api/alertas/:id` — desactiva la suscripción (solo dueño o admin).

### Worker
En `/api/reportes/procesar`, tras clasificar/corregir un reporte, se invoca `enviarAlertasSuscriptores()` de forma asíncrona. Solo se notifica cuando el estado final es `CLASIFICADO` o `CORREGIDO`.

---

## GAP 2: F5 Onboarding

**Estado:** COMPLETO

| Criterio | Estado |
|----------|--------|
| Componente creado | ✅ `src/components/onboarding/OnboardingTour.tsx` |
| Utilidades de persistencia | ✅ `src/lib/onboarding.ts` (`isOnboardingComplete`, `markOnboardingComplete`, `resetOnboarding`) |
| 3 pasos funcionan | ✅ Bienvenida → Consultar → Reportar |
| Persistencia localStorage | ✅ Key `onboarding_completed` |
| Overlay bloquea fondo | ✅ `bg-black/60` + cierre al hacer clic fuera o saltar |
| Responsive | ✅ `max-w-md` y padding en móvil |
| Animaciones suaves | ✅ `animate-floatUp` + transiciones en indicadores |
| Repetir tour | ✅ Botón "Tour" en `NavHeader` para usuarios autenticados |

### Integración
- `src/app/layout.tsx` monta `<OnboardingTour />` globalmente.
- Se muestra automáticamente en la primera visita si `localStorage` está vacío.
- `NEXT_PUBLIC_DISABLE_ONBOARDING=true` lo desactiva (usado en tests E2E).

---

## GAP 3: F1 Scoring UI

**Estado:** COMPLETADO (ya existía, se extendió)

| Criterio | Estado |
|----------|--------|
| Componente visual | ✅ `src/components/modules/ScoreDisplay.tsx` |
| Círculo con número grande | ✅ 0-100 con anillo de progreso |
| Color según nivel | ✅ Verde/Ámbar/Naranja/Rojo |
| Texto RIESGO [NIVEL] | ✅ BAJO/MEDIO/ALTO/CRÍTICO |
| Recomendación clara | ✅ Texto accionable por nivel |
| Detalles desplegables | ✅ Botón "Ver detalles" con total reportes, categoría principal y ciudades |
| Integrado en consulta | ✅ `ConsultaResultado` pública los datos cuando el usuario está autenticado |
| Responsive | ✅ Diseño flexible column/fila |
| Contraste accesible | ✅ Fondos claros (`green-100`, etc.) con texto oscuro (`green-900`, etc.) |

---

## Fase 008: SEO y Metadatos

**Estado:** COMPLETO

| Criterio | Estado |
|----------|--------|
| Metadata base | ✅ `src/app/layout.tsx` con `metadataBase`, `alternates.canonical`, OpenGraph, Twitter, appleWebApp |
| Viewport | ✅ Export `viewport` con `themeColor`, `width`, `initialScale` |
| Metadata por página | ✅ `/`, `/reportar`, `/seguimiento`, `/terminos`, `/privacidad`, `/offline` |
| robots.txt | ✅ `src/app/robots.ts` expone `/robots.txt` |
| sitemap.xml | ✅ `src/app/sitemap.ts` expone `/sitemap.xml` |
| JSON-LD | ✅ Datos `WebSite` / `Organization` en `/` |

### Archivos clave
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/reportar/page.tsx`
- `src/app/seguimiento/page.tsx`
- `src/app/terminos/page.tsx`
- `src/app/privacidad/page.tsx`
- `src/app/offline/page.tsx`
- `src/app/robots.ts`
- `src/app/sitemap.ts`
- `src/components/modules/HomePageClient.tsx`

---

## Fase 009: Dashboard Público

**Estado:** COMPLETO

| Criterio | Estado |
|----------|--------|
| Ruta pública | ✅ `/dashboard-publico` |
| API pública | ✅ `GET /api/estadisticas-publicas` |
| Métricas | ✅ Total reportes, identificadores visibles, score promedio |
| Distribuciones | ✅ Por plataforma y por nivel de riesgo |
| Últimos identificadores | ✅ Lista de últimos 10 identificadores visibles |
| Navegación | ✅ Link en `NavHeader` (desktop y móvil) |
| Protección proxy | ✅ `/dashboard-publico` y `/api/estadisticas-publicas` agregados a `PUBLIC_ROUTES` |

### Archivos clave
- `src/app/dashboard-publico/page.tsx`
- `src/app/api/estadisticas-publicas/route.ts`
- `src/components/modules/PublicDashboard.tsx`
- `src/components/modules/NavHeader.tsx`

---

## Deudas técnicas corregidas

| Problema | Solución |
|----------|----------|
| Login no funcionaba en HTTP/producción | `COOKIE_SECURE=false` en `.env` + helper `isSecureRequest()` en `src/lib/auth.ts` |
| Menú admin no navegaba | Corrección de sintaxis en `NavHeader.tsx` (etiqueta `</Link>` → `</a>`) y uso de `Link` de Next.js |
| Colores horribles en dashboard admin | `AdminDashboard.tsx`, `BarChart.tsx`, `DonutChart.tsx`, `Sparkline.tsx` adaptados al tema oscuro |
| Configuración vacía | Ejecutado `npm run db:seed` para crear parámetros por defecto |
| Bandeja no mostraba reportes recientes | Corregido `fechaHasta` en `/api/admin/reportes-revision` para incluir fin del día |
| Lint error en `ThemeProvider.tsx` | Movida declaración de `applyTheme` antes del `useEffect` |

---

## Validación Final

| Tipo | Resultado |
|------|-----------|
| Lint | ✅ OK |
| Unitarios | **108/108** pasaron (tras `prisma migrate reset` y seed F7) |
| TypeScript (`tsc --noEmit`) | ✅ OK |
| Build | ✅ OK |
| E2E | **23/23** pasaron (`npx playwright test --workers=1`) |
| Servidor | ✅ Corriendo en `http://192.168.2.23:5005` |

### Comandos ejecutados (post-F7)
```bash
npm run lint                          # OK
npm run test                          # 108 passed
npx tsc --noEmit                      # OK
npm run build                         # OK
npx playwright test --workers=1       # 23 passed
npx tsx prisma/seed.ts                # parámetros F5/F6/F7 creados
```

### Pruebas manuales realizadas
- Login admin funciona y redirige al panel.
- Menú admin navega a Panel, Configuración y Dashboard.
- `/dashboard/admin/configuracion` carga y permite editar parámetros.
- `/dashboard/admin` muestra reportes con filtros de fecha.
- `/dashboard/admin/estadisticas` muestra gráficos con colores del tema.
- `/dashboard-publico` carga y muestra métricas públicas.
- `/api/estadisticas-publicas` responde sin autenticación.
- `/robots.txt` y `/sitemap.xml` son accesibles.

---

## Fase 010 — Clasificador IA: F6 cascada de desempate

**Estado:** IMPLEMENTADO Y DESHABILITADO POR DEFECTO

| Criterio | Estado |
|----------|--------|
| Cascada en `clasificarConVotos` | ✅ activa solo si `modeloDesempate` está configurado |
| Prompt de desempate con RAG + conteo de votos | ✅ implementado |
| A/B `qwen2.5:32b` vs `ornith:35b` | ✅ ejecutado sobre 110 ejemplos |
| P4 (`error_silencioso` ≤ 22.92%) | ❌ ambos modelos fallan (31.7% y 30.4%) |
| Parámetro por defecto vacío | ✅ `reportes.classification.modelo_desempate = ""` en `prisma/seed.ts` |
| Reporte de evaluación | ✅ `specs/010-rediseño-clasificador-ia/f6-report.md` |

### Resultado del A/B F6

| Modelo de desempate | `error_silencioso` | `% REVISION_MANUAL` | % resuelto bien / mal confirmado |
|---|---|---|---|
| Línea base F5 | 21.9% | 33.6% | — |
| `qwen2.5:32b` | 31.7% | 5.5% | 37.8% / 45.9% |
| `ornith:35b` | 30.4% | 7.3% | 37.8% / 40.5% |

La cascada baja la revisión manual pero introduce demasiados errores silenciosos al confirmar la moda del modelo base. Por tanto F6 permanece desactivada hasta nuevo diseño.

## Fase 010 — Clasificador IA: F7 guardas, priorización y precisión observada

**Estado:** COMPLETO

| Criterio | Estado |
|----------|--------|
| Diccionario estático de keywords críticas | ✅ `src/lib/ai/keywords-riesgo.ts` con ≥20 términos/frases y normalización NFD |
| Guarda generalizada en procesamiento | ✅ `OTRO` + keywords → `REVISION_MANUAL` + `prioridadAlta=true`; `REVISION_MANUAL` + keywords → `prioridadAlta=true`; sin reclasificar |
| Detección de ráfagas | ✅ `src/lib/ai/rafaga.ts`; parámetros `reportes.rafaga.n=3` y `reportes.rafaga.horas=24` |
| Confirmación de clasificación correcta | ✅ Endpoint `POST /api/admin/reportes-revision/[id]/confirmar` |
| Métricas de precisión observada | ✅ `/api/admin/estadisticas` expone `precisionObservada` por categoría |
| Panel admin priorizado | ✅ Cola ordenada por `prioridadAlta DESC`, badges keywords/rafaga |
| Privacidad en alertas de alta prioridad | ✅ Email indica prioridad alta sin incluir texto ni términos |
| Eval de no-regresión F7 | ✅ `error_silencioso` 20.8%, `% REVISION_MANUAL` 34.5%, 3 guardas activadas |
| Reporte de evaluación | ✅ `specs/010-rediseño-clasificador-ia/f7-report.md` y `final-report.md` |

### Resultado del eval F7

| Métrica | Valor |
|---|---|
| Accuracy | 68.2% |
| `error_silencioso` | 20.8% (↓ 1.1 pp vs F5) |
| `% REVISION_MANUAL` | 34.5% (↑ 0.9 pp vs F5) |
| Recall `OTRO` | 30.0% |
| Latencia p50 / p95 | 6048 ms / 6391 ms |

F7 concluye el rediseño del clasificador IA. El KPI de producto (`error_silencioso < 5%`) aún no se cumple; la brecha restante (20.8% → 5%) debe cerrarse iterando con correcciones reales de producción, RAG y las métricas de precisión observada.

## Próximo paso recomendado

- **Spec 010 cerrado.** El rediseño del clasificador IA queda documentado en `specs/010-rediseño-clasificador-ia/final-report.md`.
- **Cerrar brecha hacia KPI < 5%:** alimentar el RAG con correcciones reales de producción y monitorear `precisionObservada` por categoría antes de bajar `% REVISION_MANUAL`.
- **Mantener F6 deshabilitada** (`reportes.classification.modelo_desempate = ""`) hasta un nuevo diseño de regla de decisión.
- Implementar tests E2E para `/dashboard-publico`, `/robots.txt`, `/sitemap.xml` y metadatos.
- Configurar HTTPS en el entorno de producción para poder usar cookies `Secure`.
- Revisar envío real de emails vía Resend en staging.

## Fase 011 — Centro de Control IA

**Estado:** COMPLETO

| Criterio | Estado |
|----------|--------|
| Backend sandbox en memoria | ✅ `src/lib/ai/sandbox.ts` ejecuta embedding → RAG → votos → PII → anonimización → guardas → decisión sin persistir |
| Endpoint sandbox admin-only | ✅ `POST /api/admin/ia/sandbox` con `verifyAuth(ADMIN)` y rate limit `ia_sandbox` |
| Modo comparación | ✅ Baseline vs override con resumen de diferencias de estado, categoría y confianza |
| Documentación interactiva | ✅ `IaDocsPanel` con diagrama clickeable, demos de votos, gauge de confianza y precisión observada |
| Playground | ✅ `IaPlayground` con textarea, sliders de overrides y trace visual |
| Trace visual | ✅ `IaTraceTimeline` muestra cada etapa, latencia, PII, guardas y decisión final |
| Integración con configuración | ✅ Tab Configuración reutiliza `ConfigPanel`; el playground carga valores actuales |
| Navegación | ✅ Link en `AdminNav.tsx` a `/dashboard/admin/ia` |
| Tests | ✅ `src/app/api/admin/ia/sandbox/route.test.ts` cubre auth, overrides, comparación y no persistencia |
| Eval F7 no-regresión | ✅ `error_silencioso` 20.8%, `revision_manual` 34.5%, accuracy 68.2% (sin cambios vs Spec 010) |

### Archivos clave
- `src/lib/ai/sandbox.ts`
- `src/app/api/admin/ia/sandbox/route.ts`
- `src/app/dashboard/admin/ia/page.tsx`
- `src/components/modules/ia/IaDocsPanel.tsx`
- `src/components/modules/ia/IaPlayground.tsx`
- `src/components/modules/ia/IaTraceTimeline.tsx`
- `src/components/ui/Slider.tsx`
- `src/components/ui/Badge.tsx`
- `src/app/api/admin/ia/sandbox/route.test.ts`

### Validación
| Tipo | Resultado |
|------|-----------|
| Lint | ✅ OK |
| TypeScript (`tsc --noEmit`) | ✅ OK |
| Build | ✅ OK |
| Tests | ✅ 114/114 pasaron |
| Eval F7 | ✅ Sin regresión |

### Métricas F7 tras `rag_top_k`
| Métrica | Valor |
|---------|-------|
| accuracy | 68.2% |
| error_silencioso | 20.8% |
| revision_manual | 34.5% |
| recall_otro | 30.0% |
| latencia_p50 | 6052 ms |
| latencia_p95 | 6374 ms |

### Despliegue
- Servidor `next start` reiniciado en `http://0.0.0.0:5005` con la build de Spec 011.
- Assets estáticos verificados (HTTP 200) desde IP Tailscale.

### Próximo paso recomendado
- Recolectar feedback de administradores sobre el playground y la documentación.
