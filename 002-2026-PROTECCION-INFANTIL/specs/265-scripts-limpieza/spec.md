# SPEC-265 — Scripts reutilizables de limpieza de data de prueba

**Radicado**: 002-PI-168  
**Tipo**: Utilidad operativa  
**Estado**: IMPLEMENTADO  
**Fecha**: 2026-08-26  
**Impacto en arquitectura:** 5 scripts nuevos en `scripts/limpieza/`. Sin cambios en `src/`. Sin migración. AuditLog usa `LOGS_MANTENIMIENTO_PURGA` + `metadatos.tipo` para evitar nuevos valores de enum.

---

## Contexto

El 2026-08-26 ZEUS ejecutó limpieza puntual por SQL inline. No quedó script permanente — cada purga futura obliga a improvisar. SPEC-265 deja 5 scripts reutilizables con `--confirm` obligatorio, backup previo y AuditLog.

---

## Decisión de diseño — AuditLog sin migración

Los nuevos nombres de acción (`COLEGIO_PURGADO`, `PADRE_PURGADO`, etc.) requieren valores nuevos en el enum `AccionAudit` de Postgres → migración. El candado "CERO migraciones" lo prohíbe.

**Solución:** usar `accion: "LOGS_MANTENIMIENTO_PURGA"` (ya existe, SPEC-193) con `metadatos.tipo` = `"COLEGIO_PURGADO" | "PADRE_PURGADO" | "REPORTE_PURGADO" | "SIMULACION_PURGADA" | "RESET_PILOTO_EJECUTADO"` para distinguir sin nueva migración.

---

## Scripts

| Script | Firma | AuditLog `metadatos.tipo` |
|--------|-------|--------------------------|
| `borrar-colegio.ts` | `--id=<colegioId> [--confirm]` | `COLEGIO_PURGADO` |
| `borrar-padre.ts` | `--email=<email> [--confirm]` | `PADRE_PURGADO` |
| `borrar-reporte.ts` | `--id=<reporteId> [--confirm]` | `REPORTE_PURGADO` |
| `borrar-simulacion.ts` | `--id=<simulacionId> [--confirm]` | `SIMULACION_PURGADA` |
| `reset-piloto.ts` | `--confirm --backup=<ruta.sql>` | `RESET_PILOTO_EJECUTADO` |

Sin `--confirm` = dry-run (solo imprime conteos, no borra nada).  
`reset-piloto.ts` sin `--backup=<ruta>` = error inmediato (no llega a dry-run).

---

## Candados

### Preservados siempre (nunca borrar)
`ParametroSistema` · `Plan` · `notificacion_reglas` · `notificacion_plantillas` · `Pais` · `Departamento` · `Ciudad` · `Plataforma` · `ModuloPermisible` · `GuiaAccionCategoria` · `reglas_recomendacion` · `FuenteReporte` · `DatasetEntrenamiento` · `EmbeddingDataset` · `AuditLog` · usuario `soporte@innovadataco.com`

### Reportes excluidos de reset-piloto (D-001 §5, evidencia viva)
`RPT-1RR278` · `RPT-2JFULR` · `RPT-FA1C23`

### Transaccional
Cada script usa `prisma.$transaction()`. ROLLBACK automático si algo falla.

---

## Orden de borrado FK-safe por script

### borrar-colegio.ts
1. Reporte del tenant (cascade borra ClasificacionIA, EmbeddingReporte, TransicionReporte, SolicitudComite vía colegio)  
2. AlertaColegio, SeguimientoCaso, NotaSeguimiento, RegistroAvisoColegio  
3. IntegranteComite, CargaRosterSesion, NotificacionInApp  
4. Estudiante (cascade Identificadores, ContactoConfianza si queda huérfano)  
5. Profesor, Materia, Curso  
6. Suscripcion del colegio  
7. OnboardingColegio, PreferenciaAlertaColegio  
8. `PatronInstitucional`  
9. Usuario admin del colegio + Usuario comiteConvivencia (AuditLog queda con `usuarioId=null` vía SetNull)  
10. Colegio  
11. Tenant  

*NO toca reportes de padres externos (usuarioId externo al tenant del colegio).*

### borrar-padre.ts
1. ContactoConfianza del usuario  
2. Reporte del usuario (cascade derivados)  
3. AuditConsentimiento (si existe)  
4. CodigoVerificacion, TokenRecuperacion  
5. Suscripcion del usuario  
6. BonoPromocional si beneficiario sin otros usos  
7. Usuario PARENT  

### borrar-reporte.ts
1. SolicitudComite (si existe)  
2. CorreccionAdmin  
3. EventoMatch  
4. SeguimientoCaso, NotaSeguimiento (si apunta a este reporte)  
5. IdentificadorReportado (solo si queda huérfano tras borrar el reporte)  
6. Reporte (cascade: ClasificacionIA, EmbeddingReporte, TransicionReporte, ReintentoReporte, AlertaColegio vía reporteId)  

### borrar-simulacion.ts
1. Obtener `reporteIds` de `SimulacionReporte`  
2. `SimulacionReporte` (o cascade al borrar `SimulacionRun`)  
3. `SimulacionRun` (cascade SimulacionReporte si existe)  
4. Reporte derivados de la simulación (por reporteId de paso 1)  

### reset-piloto.ts
1. Verificar `--backup=<ruta>` → error si falta  
2. Ejecutar pg_dump en el archivo indicado (shell spawn)  
3. Listar todos los colegios (excepto preservados) → llamar `borrarColegio()` por cada uno  
4. Listar todos los padres (excepto `soporte@`) → llamar `borrarPadre()`  
5. Listar reportes huérfanos excepto los 3 excluidos → llamar `borrarReporte()`  
6. Listar simulaciones → llamar `borrarSimulacion()`  
7. AuditLog final `RESET_PILOTO_EJECUTADO`  

---

## Invariantes

- CERO cambios en `src/lib/ai/**`  
- CERO migraciones de schema  
- `scripts/limpieza/README.md` documenta los 5 scripts + preserved + uso `--confirm`  
- Import: `import { prisma } from "../../src/lib/prisma"` (patrón establecido en scripts/)  
