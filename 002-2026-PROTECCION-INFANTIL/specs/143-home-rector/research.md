# Research: SPEC-143 — Home operativo del rector

**Fecha**: 2026-08-03 · **Spec**: [spec.md](./spec.md)

## D-R1 · Fuente de cada bloque (exploración verificada 2026-08-03)

| Bloque §5.1 | Fuente | Estado |
|---|---|---|
| Saludo + fecha | `Usuario.nombre` (verifyAuth) + helper de fecha en español | crear helper |
| Ficha/vigencia | `UsuarioRepository.findConColegioYUbicacion` (ya usado por la page) | reusar |
| KPI estudiantes/cursos | `Estudiante/CursoRepository.contarPorColegio` — **NO filtran estado** | crear variantes `contarActivos` (no cambiar semántica existente: la consume `/api/colegio/estadisticas`) |
| KPI profesores | `ProfesorRepository` | crear `contar(colegioId, "activo")` |
| Reportes mes/semana + delta | `AlertaColegio` (`creadoEn`) — vínculo reporte↔colegio | extender repo con filtro de fecha (D2: DISTINCT reporteId) |
| Anillo vigilancia | `Estudiante.count({ colegioId, estado, identificadores: { some: { estado: "activo" } } })` | nuevo |
| Anillo reacción | `Estudiante.count({ colegioId, estado, acudientes: { some: {} } })` — vía estudiante acotado (D1 SPEC-144) | nuevo |
| Tendencia (3 series) | groupBy semana/mes/año sobre `AlertaColegio.creadoEn` | nuevo (en repo, no en cliente) |
| Cursos que merecen mirada | `AlertaColegioRepository.contarVisiblesPorCursoIds` (raw, tenant en ambos lados) | extender con `creadoEn >= 30d` + top N + `Curso.profesorTitular` en el select |
| Última señal (colegio) | `AlertaColegio` `max(creadoEn)` — D3(a), puede no existir nunca → copy "sin señales aún" | nuevo |
| Última revisión del sistema | heartbeat del worker: archivo `worker.heartbeat` en `WORKER_RUN_DIR` (misma fuente de `src/app/api/health/worker/route.ts`) — D3(b), global y verdadero | nuevo helper `leerHeartbeatWorker()` en `src/lib` (la ruta health se refactoriza para usarlo, mismo comportamiento) |
| Semáforo | conteo de alertas `estado: "nueva"` + alertas 7d | nuevo, función pura |
| Canales oficiales | `src/components/modules/CanalesOficiales.tsx` | reusar tal cual |

`ColegioResumenRepository.homeRector` = UNA función que dispara las consultas en
`Promise.all` y ensambla el DTO. Cero N+1 por construcción (counts/groupBys, no
findMany+loop).

## D-R2 · Recharts en App Router

Recharts es client-side: `TendenciaReportes.tsx` lleva `"use client"` y recibe las 3
series por props (27 puntos en total: 12 semanas + 12 meses + 3 años — payload
trivial). El toggle cambia estado local sin refetch. `AreaChart type="monotone"`,
gradiente sutil bajo la línea, un color por serie (`stroke` desde token cielo/pino),
grid mínimo, sin leyenda (una serie), tooltip con copy humano. Accesibilidad:
resumen `sr-only` con los totales del periodo (el SVG de recharts no es navegable).

## D-R3 · Semáforo (D1 aprobada con ajuste: ámbar = 72 h)

Función pura `resolverEstado({ alertasNuevas, alertas72h }): EstadoSistema` —
rubí si `alertasNuevas > 0` · ámbar si `alertas72h > 0` · pino si no. Determinista,
explicable en una frase al rector, y alineada con "cada pantalla termina en un
verbo" (rubí = "tienes alertas sin gestionar → ver alertas"). ZEUS: 72 h (no 7
días) para que el estado decaiga solo y no haya fatiga de alarma.

Palabras de la declaración (§4.1): pino → *tranquilos* · ámbar → *algo* (que mirar) ·
rubí → *necesita que actúes hoy*. **CONDICIÓN DE COPY (ZEUS)**: en ámbar el texto
dice explícitamente que ya está atendido ("hubo algo y ya lo atendiste") — el ámbar
nunca se lee como trabajo pendiente cuando no lo hay.

## D-R4 · Dependencias nuevas

`recharts` (§4.4, series temporales) y `lucide-react` (§4.1, íconos de la home) —
ninguna está instalada hoy. Se fijan versiones en package.json y se regenera
`docs/architecture/06-stack.md` (el oráculo de stack de arch:check lo exige, como en
SPEC-157).

## D-R5 · Lo que se retira y lo que NO se toca

- La page actual (ficha + `ConsultaPublica` + `PublicDashboard variant="resumen"`)
  se reemplaza ENTERA. `ConsultaPublica`/`PublicDashboard` siguen en la landing
  pública `/` — no se borran.
- `layout.tsx` del colegio (auth, vigencia, `ColegioSideNav`) NO se toca; la page
  nueva NO repite auth (simplificación heredada de la exploración: la page actual
  duplicaba la verificación del layout).
- La decisión C2/C3 de SPEC-129 queda SUPERADA: se documenta en el cierre y en el
  spec de 129 (nota), no se reabre.
- Acciones rápidas → rutas existentes; la acción "Profesores" queda a la vista de
  cursos hasta que SPEC-148 cree su ruta (documentado, no se fabrica una ruta
  muerta).

## D-R6 · Sin k-anonimato en la home

El k=3 de SPEC-142 aplica a PATRONES institucionales agregados. La home muestra los
datos PROPIOS del colegio (sus estudiantes, sus alertas) — no hay agregación
cross-tenant ni PII: no aplica k. I-29 intacto: cero scores, cero categorías
técnicas, cero textos.
