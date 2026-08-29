# Research: SPEC-160 — Dataset demo de producción

## Scripts existentes a reutilizar

### `prisma/seed.ts`
- Crea admin inicial y parámetros del sistema.
- No borra datos; es aditivo.
- No sirve directamente para sembrar colegios/estudiantes, pero debe correrse antes en un entorno limpio.
- En producción ya debería haberse ejecutado; no se re-ejecuta.

### `scripts/generar-reportes-demo.ts`
- Genera reportes sintéticos y los procesa contra Ollama real.
- Usa `PrismaClient` directamente.
- Marca reportes con `numeroSeguimiento` prefijo `RPT-DEMO-`.
- **Limitaciones**:
  - No crea colegios, estudiantes ni usuarios.
  - Los identificadores son aleatorios; no están vinculados a estudiantes.
  - Solo borra reportes (`--cleanup`).
- **Reuso**: patrón de llamada a `/api/reportes/procesar`, estructura de plantillas, resumen.

### `scripts/reanudar-demo.ts`
- Resetea reportes demo atascados en `PROCESANDO`.
- Reprocesa pendientes con timeout y reintentos.
- **Reuso**: adaptar para todo el pipeline de procesamiento demo.

### `scripts/verificar-demo.ts`
- Muestra conteos de reportes demo por estado.
- **Reuso**: extender a todas las entidades demo.

### `scripts/simulacion/purgar-simulaciones.sql`
- Borra runs de simulación y reportes asociados.
- **Limitaciones**: solo toca tablas de simulación (`simulacion_runs`, `simulacion_reportes`) y reportes derivados.
- **Reuso**: inspirar orden de borrado, no usar directamente.

### `scripts/simulacion/simulacion-200-antes-curaduria.json`
- Banco de 200 textos curados con categoría esperada.
- **Reuso**: base para generar reportes demo; variar concatenando contexto (plataforma, ciudad, edad).

## APIs relevantes

- `POST /api/admin/colegios`: crea colegio + tenant + SCHOOL_ADMIN.
- `POST /api/admin/operadores`: crea OPERADOR o COMITE_VALIDACION.
- `POST /api/colegio/cursos/unificado`: crea curso + estudiantes + identificadores (requiere SCHOOL_ADMIN autenticado).
- `POST /api/reportes`: crea reporte anónimo o autenticado.
- `POST /api/reportes/procesar`: procesa reporte con motor (requiere `WORKER_SECRET`).
- `POST /api/auth/registro` (o similar): registro de padres.

## Riesgos identificados

1. **Correos reales**: si un usuario demo se crea con email externo, los avisos salen fuera. Mitigación: validación de dominio `@innovadataco.com` en el script.
2. **Datos reales**: purga mal diseñada puede borrar producción. Mitigación: `DemoMarcado` + validación cruzada + backup manual + prueba en snapshot.
3. **Performance**: 1.000 estudiantes, 5.000 identificadores y cientos de reportes en una corrida pueden saturar la BD. Mitigación: batching y delays.
4. **Motor Ollama**: procesar cientos de reportes es lento. Mitigación: corrida resumible y posible división en lotes.
5. **FK sin cascade**: purga manual ordenada requerida.
