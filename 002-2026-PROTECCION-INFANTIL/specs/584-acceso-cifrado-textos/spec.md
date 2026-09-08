# SPEC-584 · Control de acceso auditado al texto cifrado del reporte (Fases 2 y 3)

**Status**: DESARROLLO
**Rama:** `work/pi-SPEC-584-acceso-cifrado`
**Diseño aprobado:** `_DISENO-CIFRADO-ACCESO-2026-09-07.md` (7 decisiones del dueño, Jelkin)

Impacto en arquitectura: dos tablas nuevas (`LecturaReporte`, `CodigoAccesoContenido`)
fuera del schema Prisma histórico pero declaradas en él, propagación de actor por
AsyncLocalStorage en la frontera DAL, dos rutas anónimas/compartidas nuevas
(`/api/reportes/[id]/solicitar-acceso`, `/api/reportes/acceso/*`, página
`/canjear-acceso`) con tres scopes de rate limit nuevos y carve-out en el proxy
para el canje compartido padre/profesional.

Continúa la Fase 1 (SPEC-581, en main): el texto del reporte vive cifrado en
`ContenidoReporte` (AES-256-GCM, DEK por fila en `LlaveReporte`). Esta spec
construye el CONTROL DE ACCESO sobre ese texto: quién lo lee, cuándo y con qué
autorización — con trazabilidad completa y sin exponer el contenido.

## Historias de usuario

- **US-1 (auditoría interna):** Como responsable de protección de datos, quiero que
  CADA lectura del texto de un reporte por admin/operador/comité quede registrada
  (quién, cuándo, qué campo, hash del contenido) para responder solicitudes de
  habeas data (Ley 1581 de 2012) y detectar accesos anómalos.
- **US-2 (aviso al padre):** Como padre dueño de un reporte, quiero recibir un
  correo cada vez que un miembro del equipo lea el texto de mi reporte, para
  mantener control sobre mis datos.
- **US-3 (acceso externo):** Como padre, quiero generar un código temporal para
  que un profesional de confianza lea el texto de mi reporte, sin entregarle mi
  cuenta ni el acceso permanente.
- **US-4 (canje profesional):** Como profesional autenticado, quiero canjear el
  código que me pasó el padre y leer el texto durante una sesión acotada (15 min).

## Requerimientos funcionales

- **FR-001:** El sistema DEBE registrar en `LecturaReporte` cada visualización de
  un campo cifrado (`texto` | `textoOriginal`) de un reporte o evento de
  expediente, con fecha/hora, actor (usuario o externo), campo, hash SHA-256 del
  contenido visto, IP y user agent. NUNCA el texto literal.
- **FR-002:** La identidad del actor DEBE propagarse por AsyncLocalStorage
  (`conActor`), sin cambiar las firmas de los lectores existentes.
- **FR-003:** La escritura de la auditoría DEBE ser fail-loud (sin rastro no hay
  lectura). La notificación al padre es best-effort y jamás tumba la lectura.
- **FR-004:** El sistema DEBE notificar por correo al padre dueño (reportante
  autenticado) cada lectura por plataforma del texto de su reporte. El reporte
  anónimo NO genera notificación (no hay padre).
- **FR-005:** El detalle del reporte (admin/operador/comité) DEBE mostrar el
  «Historial de accesos al texto». Los padres NO lo ven.
- **FR-006:** El padre dueño DEBE poder solicitar un código temporal (8 caracteres
  sin 0/O/1/I, 30 min de vigencia, un solo código activo por reporte, máx 3
  solicitudes/hora). El código se envía por correo y se muestra una vez en pantalla.
- **FR-007:** El canje DEBE exigir usuario autenticado (PARENT o PROFESIONAL),
  validar hash + vigencia + un solo canje (409 en carrera), abrir sesión de 15 min
  y devolver un token opaco (UUID; en reposo solo su hash). El padre solicitante
  DEBE recibir correo con quién canjeó.
- **FR-008:** La lectura con sesión DEBE revalidar la expiración en cada llamada,
  devolver SOLO el texto de trabajo (nunca `textoOriginal`) y auditar como actor
  EXTERNO vinculado al código.
- **FR-009:** El reporte anónimo DEBE rechazar el flujo externo (404, sin revelar
  existencia).
- **FR-010:** Todo canje DEBE registrar AuditLog (`CODIGO_ACCESO_SOLICITADO` /
  `CODIGO_ACCESO_CANJEADO`) sin el código en claro.

## Criterios de aceptación

1. Leer el detalle de un reporte como operador crea exactamente una fila de
   `LecturaReporte` con el hash correcto del texto visto.
2. Leer un listado (batch) crea una fila por reporte, no por campo duplicado.
3. El reporte anónimo audita la lectura interna pero crea cero notificaciones.
4. El flujo completo código → canje → lectura funciona end-to-end y cada paso
   queda auditado; el reintento de canje responde 409; la sesión vencida, 410.
5. `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, los tests nuevos de
   integración, `npm run build`, `npm run arch:check` y `npm run indices:check`
   quedan en verde.

## Edge cases

- Descifrado sin actor en el ALS (lector no instrumentado): audita con
  `usuarioId = null`, la lectura no se pierde.
- Carrera de dos canjes simultáneos: gana uno (update condicional), el otro 409.
- Código expirado entre la solicitud y el canje: 410 con mensaje claro.
- Nuevo código solicitado con uno activo: el anterior expira (un solo activo).
- Sesión vencida entre dos lecturas: la primera sirve, la segunda 410.

## Supuestos

- El profesional canjea con su cuenta autenticada (decisión 3 del dueño); el proxy
  abre `/api/reportes/acceso` y `/canjear-acceso` solo a PARENT/PROFESIONAL.
- El texto `textoOriginal` (evidencia legal) jamás sale por la vía externa.
- La notificación por cada lectura de listado (bandejas) puede generar varios
  correos a padres distintos; es la conducta decidida (decisión 5).

## Implementación (al cierre)

Ver `plan.md`, `tasks.md` y los commits de la rama.
