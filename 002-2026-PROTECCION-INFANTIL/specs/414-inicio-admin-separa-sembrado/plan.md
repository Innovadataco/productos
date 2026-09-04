# Plan · SPEC-414 — El Inicio del admin separa lo sembrado de lo real

## Análisis en fuente, antes de codificar

| Archivo | Qué se sacó |
|---|---|
| `src/lib/dal/services/inicio-admin.ts` | 9 señales. **Solo una** descontaba `DemoMarcado`… y su consulta apuntaba a una tabla inexistente (I-294). |
| `prisma/schema.prisma:2602` | `DemoMarcado` lleva `@@map("demo_marcado")`. Ese `@@map` es la causa exacta del defecto. |
| `calcularEstadoInicio` (agregador) | `Promise.allSettled` sin logging: un rechazo desaparecía. El comentario prometía un `logger` que no se importaba. |
| `src/app/dashboard/admin/inicio/page.tsx` | Server component con `force-dynamic`. El modo puede vivir en la URL: no hace falta estado de cliente. |
| `src/app/dashboard/colegio/cursos/unificado/page.tsx:9` | El patrón de `searchParams` en este repo (Next 16: promesa que se espera). |
| `src/app/api/admin/inicio/senales/route.test.ts` | Ya es un test de INTEGRACIÓN con BD real: el lugar natural para probar el corte de verdad. |
| `src/lib/test-utils.ts:114` | `resetDatabase` exige que el nombre de la BD contenga `test` — guard puesto tras arrasar la BD compartida el 01-09. La base de trabajo se llamó `pi_spec414_test` para respetarlo. |

**Decisión de diseño:** las señales de CARGA devuelven `{ senal, sembrados }` en vez de solo la señal. Así el conteo sale del mismo lugar que hace el filtro y no hay dos fuentes de verdad que se puedan desincronizar.

**Decisión 2:** el total de sembrados NO es la suma del desglose. Se cuenta aparte, sobre `demo_marcado`, porque un reporte puede caer en dos colas y sumarlo dos veces sería un número falso en pantalla.

## Orden de trabajo

1. Tipos y el corte CARGA/SALUD en el servicio.
2. El agregador: tareas con nombre, `logger.error`, `degradadas`.
3. La pantalla: interruptor + bloque de degradadas.
4. El endpoint: `?prueba=1`.
5. Candados estáticos + tests de pantalla + integración contra BD real.
6. **Prueba negativa**: reintroducir el defecto y ver que ahora se ve.

## Riesgos

| Riesgo | Cómo se acota |
|---|---|
| El Inicio queda casi vacío en producción y lo reportan como bug | Queda escrito en la spec y el interruptor devuelve la vista anterior con un clic. |
| Alguien "arregla" el nombre de tabla al revés (modelo en vez de físico) | Test estático con contraprueba. |
| Vuelve el silencio de `allSettled` | Test estático que exige logger + `degradadas` + cero `catch {}` vacíos. |
| Una señal de SALUD empieza a filtrar por descuido | Test estático: las de SALUD deben conservar la firma sin parámetro. |
| Correr los tests contra la BD compartida | Base propia `pi_spec414_test`, creada y destruida. |
