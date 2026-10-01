# SPEC-787 · Bandeja del verificador · «Reportes que no coinciden»

**Feature Branch**: `work/pi-SPEC-787-bandeja-incidentes-verificador`
**Created**: 2026-09-29
**Status**: DESARROLLO (cablea el hueco-funcional `estado-efectivo-incidente.ts`; la pantalla queda a certificación de Diseño vía CEO)
**Base**: `main` (incluye SPEC-753 merged: EncuestaCita, IncidenteContradiccionEncuesta, `estado-efectivo-incidente.ts`, `plazo-incidente.ts`, cruce).

## Contexto

SPEC-753 detecta contradicciones entre la encuesta del PADRE y la del PROFESIONAL y registra un `IncidenteContradiccionEncuesta` con su reloj legal/interno. El estado se **deriva** (`estadoEfectivoIncidente`), nunca se persiste. Hasta ahora nadie los mira: `estado-efectivo-incidente.ts` es un **hueco-funcional declarado**. Esta spec construye la **bandeja del verificador** que los lista, los presenta de forma SIMÉTRICA y permite registrar la resolución — y con eso **cablea** el hueco.

## Superficie PROPIA (no se extiende la cola de verificación de profesionales)

La cola existente `dashboard/admin/verificacion/incidentes` (SPEC-408) es otro dominio (citas SIN_CONFIRMAR, otro criterio de orden). Esta bandeja vive en su **propia** página `dashboard/admin/verificacion/reportes-no-coinciden`, con su propio endpoint. Se reutiliza el patrón de tarjeta/lista, no la cola.

## Decisiones (radicado + FORMA-SPEC753-INCIDENTE-VERIFICADOR + CEO 29-09)

1. **`esIncumplimiento` es FUENTE ÚNICA.** El resumen (conteo «N fuera del plazo») y el detalle (bandera por incidente) leen la MISMA `esIncumplimiento(estado)`. No puede existir un resumen «al día» sobre un detalle «vencido». Candado con control positivo: mover `now` sobre un vencimiento sube el conteo Y la bandera JUNTOS.
2. **Orden por el VENCIMIENTO real (`venceEn`), no por creación.** Un incidente legal creado después puede vencer antes; va primero. Lo garantiza el repo (`orderBy: { venceEn: "asc" }`) y lo clava un candado (creado-después-vence-antes → va primero).
3. **Presentación SIMÉTRICA.** Ninguna versión se muestra como «la verdadera». Las dos columnas (padre/profesional) tienen el MISMO shape y el MISMO tono. Control positivo del candado: **invertir quién dijo qué NO cambia el tono de la pantalla** (si cambiara, estaríamos adjudicando sin datos).
4. **«Vencido» NO es un veredicto a favor de nadie.** «Procede a favor del padre por vencerse el plazo» aparece SOLO con el reloj **legal** vencido, y es un default por vencimiento (nuestra demora), no un fallo sobre quién mintió. El interno vencido es «Vencido — fuera del plazo interno», sin «a favor». Ámbar en las confesiones (fuera de plazo/vencido), **CERO rubí**.
5. **CERO contenido de sesión en pantalla.** Las encuestas son mecánicas (enums/bool). La presentación del caso del padre (texto libre) **nunca** viaja al DTO del verificador. Candado: un marcador sembrado en `presentacion` no aparece en el JSON de la bandeja.
6. **Salida autoexigida.** Al cablear, `estado-efectivo-incidente.ts` sale de la allowlist de huérfanos **en el mismo commit** (arch:check lo pondría rojo como huérfano ya cubierto).

## Alcance de esta entrega

DAL (`incidente-contradiccion.ts`) + service/DTO (`bandeja-incidentes.service.ts`, que cablea el estado efectivo) + endpoints GET/resolver + copy + tarjeta simétrica + client + página. Candados de servicio (integración) y de render. La **pantalla queda a certificación de Diseño** (se envía al CEO; no se escribe a Diseño directo).

## Impacto en arquitectura:

- **Esquema:** SIN cambios. Se LEE el esquema de SPEC-753 (IncidenteContradiccionEncuesta, EncuestaCita). No se regenera `01-modelo-datos.md`.
- **Módulos nuevos:** DAL `incidente-contradiccion.ts`; service `bandeja-incidentes.service.ts`; copy `copy-incidente-verificador.ts`; UI `IncidenteContradiccionCard.tsx`, `ReportesNoCoincidenClient.tsx`, página `reportes-no-coinciden/page.tsx`; dos rutas API. Se extrae `claseDeContradiccion` a `plazo-incidente.ts` como fuente única (el cruce la reusa).
- **Módulos que dejan de ser huérfanos:** `estado-efectivo-incidente.ts` — lo importa ahora el service de la bandeja (cableado a producción por las rutas). Sale de la allowlist en este commit.
- **Proxy / navegación:** nueva página bajo `dashboard/admin/verificacion/**` y rutas bajo `api/admin/verificacion-profesionales/**`, gate `admin_verificacion_profesionales` (mismo módulo del verificador; no cambia el proxy).
- **Acceso a datos:** el service NO importa el singleton de Prisma (Q-3): usa el DAL, que recibe `tx?` o cae al singleton. El estado del incidente se sigue DERIVANDO (no se persiste); resolver solo escribe `resueltoEn`/`resueltoPor`.
