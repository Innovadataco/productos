# Plan 017 — Índice del módulo de documentación navegable

> Estado: **EN DISEÑO** — esqueleto propuesto. Se espera aprobación del owner antes de generar el contenido completo o construir la UI.
> Fecha: 2026-07-18.

Este documento es el **índice maestro** de 3 capas. Cada tema incluye la fuente real del repo de donde se derivará el contenido.

---

## Capa 1 — Qué y por qué

Público general, aliados, prensa, donantes, instituciones. No requiere login. Sin PII, sin detalles técnicos, sin instrucciones de operación.

### 1.1 Motivación y contexto social

- Grooming y explotación sexual infantil en LATAM: por qué la plataforma existe.
- La barrera de denuncia: miedo, desconfianza, desconocimiento de canales.
- Propuesta de valor: un registro agregado, anónimo y verificable que ayuda a detectar patrones sin exponer a las víctimas.

**Fuentes:**
- `specs/003-frontend-publico/spec.md` — motivación y público objetivo.
- `specs/02-reportes-comunitarios/spec.md` — alcance del módulo de reportes.
- `README.md` — introducción del proyecto.

### 1.2 Marco normativo y prudencia jurídica

- Menores de edad, datos sensibles y responsabilidad de plataforma.
- MASNNA / NNA: protección de la identidad y la dignidad.
- Por qué no se publican contenidos de reportes ni datos personales.
- Avisos legales: términos, privacidad, cookies.

**Fuentes:**
- `specs/006-paginas-legales/spec.md`.
- `src/app/(legal)/terminos/page.tsx` y `src/app/(legal)/privacidad/page.tsx`.

### 1.3 Catálogo de funcionalidades

Cada funcionalidad con 1–2 frases y un ejemplo concreto.

| Funcionalidad | Qué hace | Ejemplo |
|---|---|---|
| **Reportar** | Cargar un identificador sospechoso de forma anónima o autenticada. | Un usuario reporta un número de WhatsApp que pide fotos a una menor. |
| **Consulta pública** | Saber si un número/nick tiene reportes sin exponer quién lo reportó. | Un padre consulta el número antes de permitir contacto. |
| **Clasificación IA** | El modelo local clasifica el texto y decide si es publicable o va a revisión. | "Solicitud de material" con confianza baja → revisión humana. |
| **Scoring y visibilidad** | Calcula cuándo un identificador es visible en el dashboard público. | 3 reportes autenticados sobre el mismo número activan la alerta pública. |
| **Dataset y aprendizaje** | Casos corregidos por admins alimentan el modelo local (RAG). | Un admin corrige una categoría; ese texto pasa a ejemplos de entrenamiento. |
| **Apelaciones (Fase C)** | El titular de un identificador puede apelar para darlo de baja. | Un número fue reportado por error; el titular apela y se pausa la visibilidad. |
| **Anti-abuso** | Rate-limit, fingerprint y detección de ráfagas para evitar spam o vigilancia. | Un usuario intenta reportar 50 veces el mismo número en una hora. |
| **Círculo de Confianza** | Padres registran contactos cercanos y ven su estado agregado. | Un padre agrega el número del entrenador y ve que está clasificado. |
| **Panel de administración** | Dashboard, cola de revisión, configuración y auditoría. | Un admin revisa reportes pendientes y confirma/corrige clasificaciones. |

**Fuentes:**
- `specs/README.md` — índice de specs.
- Cada `specs/*/spec.md` (001, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016, 018).
- `IMPLEMENTATION-REPORT.md`.

---

## Capa 2 — Cómo funciona

Para administradores, operadores y usuarios autenticados que necesitan operar la plataforma.

### 2.1 Flujo de un reporte de punta a punta

1. Un usuario (anónimo o autenticado) carga un reporte en `/reportar`.
2. Anti-abuso: rate-limit, fingerprint, detección de ráfagas.
3. El reporte entra en `PENDIENTE` y la cola `reporte-procesamiento`.
4. El worker lo procesa: embedding, deduplicación, clasificación con votos, detección de PII, guardas de doxing/keywords/rafaga.
5. Resultado: `CLASIFICADO`, `CORREGIDO`, `REVISION_MANUAL`, `POSIBLE_SPAM`, `DUPLICADO` o `REQUIERE_ANONIMIZACION`.
6. Si es visible, el identificador aparece en `/consulta` y eventualmente en `/dashboard-publico`.
7. Si entra a revisión humana, un operador/admin lo confirma, corrige o da de baja.
8. El titular puede apelar desde `/apelar` (Fase C).

**Fuentes:**
- `specs/02-reportes-comunitarios/spec.md`.
- `specs/010-rediseño-clasificador-ia/spec.md` y `reporte-cierre.md`.
- `specs/015-anti-abuso/spec.md`.
- `specs/018-operadores-casos/diseno.md`.
- `src/lib/ai/classifier.ts`, `src/lib/queue.ts`, `src/app/api/reportes/procesar/route.ts`.

### 2.2 Módulos del panel de administración

#### Dataset de entrenamiento
- Qué es un caso de entrenamiento (`CasoEval`).
- Cómo se agregan semillas manuales vs. casos anonimizados de producción.
- Activación/desactivación de casos y su impacto en RAG.

**Fuentes:**
- `specs/014-laboratorio-ia/spec.md`.
- `src/app/dashboard/admin/dataset-entrenamiento/page.tsx`.
- `src/app/api/admin/dataset-entrenamiento/route.ts`.

#### Apelaciones
- Cola de apelaciones pendientes.
- Estados: `RECIBIDA`, `EN_REVISION`, `ACEPTADA`, `RECHAZADA`.
- Cómo aceptar, rechazar y rehabilitar el derecho a apelar.
- Efecto en la visibilidad del identificador.

**Fuentes:**
- `specs/012-baja-reportes/spec.md`.
- `src/app/dashboard/admin/apelaciones/page.tsx`.
- `src/components/modules/AdminApelaciones.tsx`.

#### Configuración del sistema (`/dashboard/admin/configuracion`)
- Scoring: pesos de cantidad, recencia, severidad, autenticación, diversidad.
- Visibilidad pública: umbral de reportes y ratio autenticados.
- Modelos: modelo de clasificación, embedding, anonimización.
- Alertas y límites.
- Cómo un cambio se aplica de inmediato (sin deploy).

**Fuentes:**
- `docs/configuracion/parametros-sistema.md`.
- `specs/001-multi-role-auth-config/spec.md`.
- `src/app/dashboard/admin/configuracion/page.tsx`.
- `src/components/modules/ConfigPanel.tsx`.

#### Centro de Control IA
- **Documentación:** qué hace cada guarda y parámetro.
- **Playground:** probar un texto con overrides sin afectar datos reales.
- **Modelos:** seleccionar y activar modelos de Ollama.
- **Eval:** correr evaluaciones contra fixtures, comparar resultados.
- **Configuración:** ajustar parámetros del pipeline de clasificación.

**Fuentes:**
- `specs/011-centro-control-ia/spec.md`.
- `specs/013-admin-motor-ia/spec.md`.
- `specs/014-laboratorio-ia/spec.md`.
- `src/app/dashboard/admin/ia/page.tsx`.

#### Anti-abuso
- Simulación de score: probar cómo cambiaría la visibilidad de un identificador.
- Ver fingerprints, ráfagas y fuentes reportadas.
- Retención de hashes y parámetros de rate-limit.

**Fuentes:**
- `specs/015-anti-abuso/spec.md`.
- `src/app/dashboard/admin/anti-abuso/page.tsx`.

#### Estadísticas
- Reportes por estado, plataforma, ubicación, tiempo.
- Dashboard público vs. dashboard admin.

**Fuentes:**
- `specs/009-dashboard-publico/spec.md`.
- `specs/004-panel-admin/spec.md`.
- `src/app/dashboard/admin/estadisticas/page.tsx`.
- `src/components/modules/AdminDashboard.tsx`.

#### Círculo de Confianza
- Cómo un usuario agrega contactos.
- Estados por contacto: sin reportes, en revisión, clasificado.
- Vista agregada y notificaciones ciegas.

**Fuentes:**
- `specs/016-circulo-confianza/spec.md`.
- `src/app/dashboard/circulo-confianza/page.tsx`.

### 2.3 Operar la cola de revisión

- Cómo entrar a `/dashboard/admin/reportes-revision`.
- Filtrar por: sin asignar, asignados a mí, prioridad alta, por estado.
- Acciones: confirmar clasificación, corregir categoría, dar de baja, escalar.
- Cuándo un caso pasa de `REVISION_MANUAL` a `CLASIFICADO`/`CORREGIDO`.

**Fuentes:**
- `specs/018-operadores-casos/diseno.md`.
- `src/app/api/admin/reportes-revision/*.ts`.

---

## Capa 3 — Por dentro

Para equipo técnico, DevOps y auditoría. Requiere rol `ADMIN` o `SCHOOL_ADMIN`.

### 3.1 Arquitectura y stack

- Next.js 16 + React Server/Client Components.
- Prisma + PostgreSQL + pgvector.
- pg-boss para colas.
- Ollama local para modelos de IA.
- Estructura de carpetas (`src/app`, `src/components`, `src/lib`, `prisma`, `scripts`).

**Fuentes:**
- `README.md`.
- `docs/despliegue.md`.
- `docs/runbook.md`.

### 3.2 Modelos de IA

- **Clasificación con votos:** por qué se usan N votos, temperatura y semillas.
- **RAG:** recuperación de ejemplos similares del dataset.
- **PII y anonimización:** detección combinada, anonimizador, guardas.
- **Guardas determinísticas:** doxing, keywords críticas, ráfagas.
- **Embeddings:** `nomic-embed-text`, deduplicación por similitud.

**Fuentes:**
- `specs/010-rediseño-clasificador-ia/spec.md` y `reporte-cierre.md`.
- `specs/011-centro-control-ia/spec.md`.
- `specs/013-admin-motor-ia/spec.md`.
- `src/lib/ai/`.

### 3.3 Laboratorio de IA

- Fixtures de evaluación (`scripts/eval-*`).
- Cómo correr una baseline y comparar configuraciones.
- Interpretación de métricas: error silencioso, precisión, recall.

**Fuentes:**
- `specs/014-laboratorio-ia/spec.md` y `reporte-cierre.md`.
- `eval-results/`.
- `scripts/eval-classifier-*.ts`.

### 3.4 Scoring y visibilidad

- Fórmula de score.
- Umbral de visibilidad pública.
- Diferencia entre score del identificador y visibilidad en dashboard.

**Fuentes:**
- `src/lib/scoring.ts`.
- `src/lib/visibility.ts`.
- `docs/configuracion/parametros-sistema.md`.

### 3.5 Migraciones y base de datos

- Convención de migraciones con Prisma.
- Modelos principales: `Reporte`, `Usuario`, `ClasificacionIA`, `EmbeddingReporte`, `DatasetEntrenamiento`, `ApelacionIdentificador`, `ContactoConfianza`, `ParametroSistema`, `AuditLog`.
- Índices HNSW para pgvector.

**Fuentes:**
- `prisma/schema.prisma`.
- `prisma/migrations/`.
- `docs/despliegue.md` (sección de migraciones).

### 3.6 Tests, evals y smoke

- Suite de tests (`npm test`).
- Smoke E2E (`scripts/smoke-e2e.ts`, `scripts/smoke-apelaciones.ts`).
- Evaluaciones de clasificador y PII.
- Cómo agregar un test nuevo.

**Fuentes:**
- `scripts/`.
- `src/**/*.test.ts` y `src/**/*.test.tsx`.
- `docs/lote-pre-despliegue-cierre.md`.

### 3.7 Seguridad y privacidad

- Cifrado de parámetros secretos (`PARAM_ENCRYPTION_KEY`).
- Hash de IPs y fingerprints.
- Cookies seguras y headers.
- Rate-limit.
- Roles y middleware.

**Fuentes:**
- `specs/001-multi-role-auth-config/spec.md`.
- `src/lib/param-encryption.ts`.
- `src/lib/rate-limit.ts`.
- `src/lib/auth.ts`.
- `src/middleware.ts`.

### 3.8 Despliegue y operación

- Checklist de despliegue v2.1.
- Variables de entorno críticas.
- Cómo levantar app + worker.
- Rollback por paso.
- Jobs de mantenimiento (vencimiento de apelaciones, limpieza de fuentes).

**Fuentes:**
- `docs/despliegue.md`.
- `docs/despliegue-v2-checklist.md`.
- `docs/runbook.md`.
- `scripts/worker-supervisor.mjs`.

### 3.9 Deuda técnica y decisiones conscientes

- Inventario de deuda técnica.
- Qué se acepta y por qué.
- Qué necesita spec futura.

**Fuentes:**
- `docs/deuda-tecnica.md`.

---

## Control de acceso por tema

| Tema | Capa | Rol mínimo |
|---|---|---|
| Motivación, catálogo de funcionalidades, marco legal | 1 | Sin login |
| Flujo de reporte (ejemplo general, sin datos reales) | 1 | Sin login |
| Cómo reportar, cómo consultar, cómo apelar | 2 | `PARENT` (autenticado) |
| Cómo operar la cola de revisión | 2 | `OPERADOR` |
| Cómo gestionar operadores | 2 | `ADMIN` / `SCHOOL_ADMIN` |
| Configuración del sistema | 2 | `ADMIN` / `SCHOOL_ADMIN` |
| Arquitectura, modelos, migraciones, tests | 3 | `ADMIN` |
| Despliegue, runbook, secrets | 3 | `ADMIN` |

---

## Componentes UI existentes a reutilizar

- `AdminNav` y `NavHeader` para la navegación entre secciones.
- `GlassCard`, `ChartCard`, `MetricCard` para agrupar contenido.
- `Badge` para etiquetar capas o roles.
- `Button` y `Link` para acciones.
- `IaDocsPanel` como referencia de renderizado de Markdown interno.
- Páginas legales existentes (`terminos`, `privacidad`) como referencia de lectura pública.

---

## Próximos pasos tras aprobación del esqueleto

1. Validar el mapa de acceso por rol con el owner.
2. Decidir si el renderizado se hace en build-time (páginas estáticas) o run-time (lectura de Markdown desde `src/docs`).
3. Generar el contenido real de cada tema a partir de las fuentes listadas.
4. Construir la UI de navegación y el visor.
5. Agregar tests de acceso por rol.
