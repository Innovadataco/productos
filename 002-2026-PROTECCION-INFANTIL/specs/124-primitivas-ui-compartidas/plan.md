# Plan de Implementación: SPEC-124 — Primitivas UI compartidas (R7)

## Inventario de duplicaciones (patrones reales, archivo:línea)

### 1. Tabla copy-paste — `<table className="w-full text-left text-sm">`

21 tablas con marcado casi idéntico (contenedor + `overflow-x-auto` + thead
`bg-slate-100/70 dark:bg-slate-800/60 text-subtle` o `border-b
border-slate-200 dark:border-slate-800` + tbody `divide-y divide-slate-100
dark:divide-slate-800` + th `px-4 py-3 font-medium`):

| Archivo | Línea | Zona |
| --- | --- | --- |
| `src/components/modules/AdminDashboard.tsx` | 231 | fría |
| `src/components/modules/AdminAntiAbusoSimulacion.tsx` | 109 | fría |
| `src/components/modules/AdminReportesTable.tsx` | 238 | fría |
| `src/components/modules/SpamRevisionPanel.tsx` | 133 | fría |
| `src/components/modules/ConsultaEnriquecidaClient.tsx` | 177 | fría |
| `src/components/modules/AdminReporteExpediente.tsx` | 174 | fría |
| `src/components/modules/audit-log/AuditTable.tsx` | 51 | fría |
| `src/app/dashboard/admin/padres/PadresPageClient.tsx` | 286 | fría |
| `src/app/dashboard/admin/operadores/gestion/page.tsx` | 345 | fría |
| `src/app/dashboard/admin/operadores/asignar/page.tsx` | 125 | fría |
| `src/app/dashboard/admin/estadisticas/clasificacion/page.tsx` | 210, 293 | fría |
| `src/app/dashboard/admin/dataset-entrenamiento/DatasetEntrenamientoPageClient.tsx` | 139 | fría |
| `src/components/modules/ComiteBandeja.tsx` | 127 | **PROHIBIDA (Comité)** |
| `src/app/dashboard/admin/comite/gestion/GestionPageClient.tsx` | 535 | **PROHIBIDA (Comité)** |
| `src/app/dashboard/admin/comite/apelaciones/ApelacionesBandejaClient.tsx` | 254 | **PROHIBIDA (Comité)** |
| `src/app/dashboard/admin/colegios/ColegiosPageClient.tsx` | 382 | **PROHIBIDA (Colegios)** |
| `src/app/dashboard/colegio/**` (5 tablas) | — | **PROHIBIDA (Colegios)** |
| `src/components/modules/ia/**` (7 tablas) | — | fuera de alcance (IA) |

### 2. Tarjeta de métrica — 4 implementaciones + 1 especializada

- `src/components/modules/MetricCard.tsx:3` — canónica "centrada" (valor 3xl
  arriba, `suffix`, `sub`, hover scale). Usada por `PublicDashboard.tsx:105-108`
  y `src/app/dashboard/circulo-confianza/page.tsx:354-357, 538-541, 598-601`.
- `src/components/modules/AdminDashboard.tsx:195` — copia "panel" (label
  arriba, valor abajo, hover shadow). 12 usos locales (líneas 107-112, 163-168).
- `src/components/modules/AdminAntiAbusoSimulacion.tsx:197` — misma copia
  "panel" + `tone` up/down. 4 usos locales (líneas 100-103).
- `src/components/modules/ConsultaEnriquecidaClient.tsx:238` — copia
  "centrada mono" (valor 2xl font-mono). 3 usos locales (líneas 169-171).
- `src/components/modules/ia/eval/MetricCard.tsx:14` — especializada con
  baseline/formato; FUERA de alcance.

### 3. Alerta inline — cajas `bg-{color}-50` repetidas

Patrón dominante: `rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-sm
text-red-600/700 dark:text-red-300/400` (y variantes emerald/amber/sky):

- `src/components/modules/AdminReporteDetalle.tsx:92-93` (error + éxito)
- `src/components/modules/ComiteSolicitudDetalle.tsx:125-126` — PROHIBIDA
- `src/components/modules/SpamRevisionPanel.tsx:129` (éxito)
- `src/components/modules/ConsultaEnriquecidaClient.tsx:134` (error)
- `src/app/dashboard/circulo-confianza/page.tsx:348` (error, ya con role=alert)
- `src/app/login/page.tsx:59`, `src/app/registro/page.tsx:88`,
  `src/app/cambiar-password/page.tsx:94,124` (formularios auth)
- `src/app/dashboard/admin/padres/PadresPageClient.tsx:219-220, 228`
  (mensajes de guardado + aviso)

### 4. "Cargando" — ~25 copias de dos formas

Forma centrada (`mx-auto h-8 w-8 animate-spin rounded-full border-4
border-slate-200 border-t-accent` + `<p className="mt-3 text-sm
text-subtle">Cargando...</p>`):

- `src/components/modules/ApelacionesClient.tsx:147-148, 298-299`
- `src/components/modules/DashboardUsuarioClient.tsx:62-63, 101-102`
- `src/components/modules/MisReporteDetalle.tsx:85-86`
- `src/app/mis-reportes/page.tsx:76-77, 91-92`
- `src/app/seguimiento/page.tsx:31-32`

Forma tabla/inline (`h-5/h-6 w-5/w-6 animate-spin ... border-2 ...` + texto):

- `src/components/modules/AdminReportesTable.tsx:255-256`,
  `SpamRevisionPanel.tsx:148-149`, `AdminReporteExpediente.tsx:289-290`,
  `audit-log/AuditTable.tsx:41-42`, `ComiteBandeja.tsx:141-142` (PROHIBIDA)
- `src/app/dashboard/admin/padres/PadresPageClient.tsx:271-272`,
  `operadores/gestion/page.tsx:335-336`, `operadores/asignar/page.tsx:115-116`,
  `operadores/modelo/page.tsx:100-101`,
  `estadisticas/clasificacion/page.tsx:285-286`,
  `dataset-entrenamiento/DatasetEntrenamientoPageClient.tsx:153-154`
- Variantes sueltas: `ConfigPanel.tsx:239-240`,
  `CategoriaGruposEditor.tsx:180-181`, `PermisosRolPanel.tsx:134`,
  `AdminReporteDetalle.tsx:68`, `NavHeader.tsx:122` (skip: nav en uso),
  `ia/**` (fuera de alcance)

### 5. Fetch de datos — máquina de estados copy-paste

Patrón `const [cargando, setCargando] = useState(true)` + `useCallback`/`useEffect`
+ `fetch` + `setCargando(false)` en `finally`:

- `src/components/modules/ApelacionesClient.tsx:62, 73-88`
- `src/app/dashboard/admin/comite/apelaciones/ApelacionesBandejaClient.tsx:99-145` — PROHIBIDA
- `src/app/dashboard/colegio/alertas/AlertasColegioPageClient.tsx:36-61` — PROHIBIDA
- `src/app/dashboard/colegio/estadisticas/ColegioEstadisticasPageClient.tsx:40-60` — PROHIBIDA
- (revisar al migrar: padres, operadores, dataset-entrenamiento, AuditTable)

## Diseño de las primitivas (aditivas, en `src/components/ui/`)

- **`Tabla.tsx`**: `Tabla` (contenedor `glass rounded-2xl overflow-hidden` +
  `overflow-x-auto` + `<table className="w-full text-left text-sm">`; prop
  `sinContenedor` para tablas ya dentro de una card), `TablaHead`
  (`variante: "relleno" | "borde"`), `TablaBody` (divide-y canónico). Th/Td se
  dejan nativos con las clases existentes (no aporta ocultarlos).
- **`TarjetaMetrica.tsx`**: props `label`, `value`, `suffix?`, `sub?`,
  `tone?: "up" | "down"`, `disposicion?: "centrada" | "panel"`, `mono?`,
  `className?`. "centrada" reproduce `modules/MetricCard`; "panel" reproduce
  la copia de AdminDashboard/AntiAbuso (con `motion-reduce:transition-none`).
- **`Alerta.tsx`**: props `tono: "error" | "exito" | "advertencia" | "info"`,
  `children`, `className?`; `role="alert"` por defecto.
- **`Cargando.tsx`**: props `texto?` (default "Cargando..."), `inline?`,
  `tamano?: "sm" | "md"`, `className?`; `role="status"` + `aria-live="polite"`,
  spinner `aria-hidden`.
- **`use-fetch-json.ts`**: hook client `useFetchJson<T>(url, deps?)` →
  `{ datos, cargando, error, recargar }`; `credentials: "include"`, parseo
  defensivo de JSON, mensaje de error genérico.

## Secuencia (un commit por paso)

1. Primitivas + tests (sin migrar nada).
2. Pantallas frías, en este orden (cada una = commit + verificación):
   1. `AdminDashboard.tsx` (TarjetaMetrica panel + Tabla)
   2. `AdminAntiAbusoSimulacion.tsx` (TarjetaMetrica panel+tone + Tabla)
   3. `ConsultaEnriquecidaClient.tsx` (TarjetaMetrica centrada mono + Tabla +
      Alerta) — tiene test
   4. `AdminReportesTable.tsx` (Tabla + Cargando)
   5. `SpamRevisionPanel.tsx` (Tabla + Cargando + Alerta)
   6. `audit-log/AuditTable.tsx` (Tabla + Cargando)
   7. `ApelacionesClient.tsx` (Cargando + Alerta + useFetchJson si aplica)
   8. `DashboardUsuarioClient.tsx` (Cargando)
   9. `PadresPageClient.tsx` (Tabla + Cargando + Alerta)
   10. `operadores/gestion/page.tsx`, `operadores/asignar/page.tsx`,
       `operadores/modelo/page.tsx` (Tabla + Cargando)
   11. `estadisticas/clasificacion/page.tsx` (Tabla + Cargando)
   12. `DatasetEntrenamientoPageClient.tsx` (Tabla + Cargando)
   13. `PublicDashboard.tsx` + `circulo-confianza/page.tsx`: cambio de import
       `modules/MetricCard` → `ui/TarjetaMetrica`; borrar
       `modules/MetricCard.tsx` (un commit conjunto: misma primitiva).
   14. `AdminReporteDetalle.tsx` (Alerta) — tiene test
   15. `AdminReporteExpediente.tsx` (Tabla + Cargando) — tiene test
   16. `MisReporteDetalle.tsx` + `mis-reportes/page.tsx` + `seguimiento/page.tsx`
       (Cargando)
3. Deuda explícita (NO migrar): Colegios, Comité, `ia/**`, `NavHeader`,
   formularios auth si sobra tiempo se evalúan.

## Verificación

- Por primitiva: `npx vitest run src/components/ui/<X>.test.tsx` (bajo candado).
- Por pantalla: tests de componente existentes de esa pantalla + `tsc --noEmit`.
- Final (bajo candado): `npx tsc --noEmit` + `npm run lint` + suite completa
  `npm run test` + `npm run build`.
