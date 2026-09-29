# Feature Specification: El titular ve quién accedió a sus datos (MOTOR)

**Feature Branch**: `work/pi-SPEC-785-rastro-de-accesos-motor`
**SPEC**: 785
**Created**: 2026-09-29
**Status**: IMPLEMENTADO
**Input**: Radicado CEO `f2012d7` · auditoría de derechos (Estrategia, Ley 1581/2012 art. 8 lit. a · art. 4 lit. f) · SOLO el motor (la superficie la arma SPEC-772 parte 2)

Impacto en arquitectura: **aditivo, sin schema, motor sin superficie.** Agrega `LecturaReporteRepository.rastroDeAccesosDelTitular` (consulta con `select` lista-blanca) y la derivación `rastroDeAccesosDelTitular` (`src/lib/dal/services/rastro-accesos-titular.ts`) con su DTO `AccesoAlDatoTitularDto`. FUENTE = `LecturaReporte` (SPEC-584), NO `AuditLog`. NO agrega tabla, endpoint, página ni ítem de nav — la superficie llega con SPEC-772 p2 (para no construir dos vistas del mismo derecho). El motor queda declarado `hueco-funcional` (allowlist de huérfanos, salida autoexigida). NO toca motor de IA, proxy ni navegación.

---

## Por qué LecturaReporte y no AuditLog (decisión de modelo · CEO)

El radicado apuntaba a `AuditLog`, pero `LecturaReporte` (SPEC-584) es fuente superior para ESTA invariante, medido:
1. **`rol` como INSTANTÁNEA del momento de la lectura.** Con `AuditLog` habría que mirar el rol ACTUAL del actor; si cambió de rol, le mostraríamos al padre una versión FALSA de quién lo leyó. Un rastro que reescribe el pasado según el presente no es un rastro.
2. **Sin campo de metadatos operativos → la fuga es imposible por CONSTRUCCIÓN.** No hay crudos que recortar por nombre (la parte frágil de la propuesta AuditLog). Estructura en vez de una lista que alguien mantiene.

## Requirements *(mandatory)*

- **FR-001**: El motor DEBE devolver los accesos de TERCEROS al dato del titular (padre): `rol` (instantánea), calidad (`tipoActor`: PLATAFORMA/EXTERNO), qué campo (`texto`/`textoOriginal`) y `momento`. NUNCA la identidad del lector.
- **FR-002**: El DTO DEBE exponer por LISTA BLANCA (`select`), nunca la fila cruda: solo momento/rol/tipoActor/campo. Cero `usuarioId` (lector), hash, ip/ua, ids de contenido/código.
- **FR-003**: El filtro DEBE ser por TITULAR en las DOS direcciones — `reporte.usuarioId === titular` O `evento.expediente.padreUsuarioId === titular`. De más muestra accesos de otra familia; de menos deja el derecho incompleto **y no se nota**. Se prueba en las dos direcciones con dato plantado.
- **FR-004**: DEBE excluir el AUTOACCESO del titular (su propia actividad es otra función). Conserva lecturas cuyo lector fue anonimizado (`usuarioId` null por SetNull, SPEC-701): el `rol` instantánea sobrevive.
- **FR-005**: La consulta DEBE ser PURA (no registra su propia ejecución). Ver «auto-registro».

## Auto-registro (decisión escrita · CEO)

Consultar el rastro NO se auto-registra: el motor es consulta pura (no escribe), y el rastro excluye al titular, así que su propia consulta nunca aparecería aunque se registrara (la sonda no actúa sobre lo que mide). Defendible y sin crecimiento sin fondo.

## LÍMITES DECLARADOS (cosas que el usuario podría asumir y NO están)

Dos límites de la misma naturaleza; **se declaran, no se resuelven acá** — cada uno con condición de salida a la superficie (SPEC-772 p2):

- **L-1 · ALCANCE (círculo de confianza).** El rastro cubre accesos al TEXTO del reporte/expediente (`LecturaReporte`). NO cubre el acceso del admin al **círculo de confianza** (vive solo en `AuditLog`, y ese eje se lee por SQL crudo). **Salida:** cuando SPEC-772 p2 arme la superficie, O se suma ese acceso como fuente secundaria, O el texto de la pantalla dice EXPLÍCITAMENTE qué cubre y qué no. **Condición dura:** el rastro NUNCA se presenta como «todos los accesos». Un rastro parcial ROTULADO como parcial es honesto y útil; uno parcial presentado como completo es falsa tranquilidad — peor que no tener la función.
- **L-2 · AUTOACCESO / SUPLANTACIÓN.** Se excluye el acceso del propio titular (FR-004): su actividad es otra función (seguridad de cuenta, no habeas data). **Consecuencia:** si alguien SUPLANTA al padre y entra con su cuenta, ese acceso NO aparece (se registra como acceso del titular). Alguien podría esperar que un «rastro de accesos» revelara justamente eso. **No se cambia el alcance** (la actividad propia es otra función); se declara para no dar falsa expectativa. **Salida:** si «mi actividad de cuenta» se construye, es una vista aparte de seguridad, no este rastro.

## Candados (conducta, dato REAL plantado)

- **C-fuga-otra-familia**: se siembra un acceso al reporte de OTRA familia y se afirma que NO aparece en el rastro del titular. Control positivo: el propio SÍ aparece. (Filtro en las dos direcciones — vía reporte y vía expediente.)
- **C-sin-crudos**: el DTO NO trae identidad del lector (nombre/email/usuarioId), ni hash, ni ip/ua, ni ids — solo momento/rol/tipoActor/campo (lista blanca por construcción).
- **C-autoacceso**: un acceso del propio titular NO aparece; un acceso con lector anonimizado (usuarioId null) SÍ aparece (no se pierde por el filtro de autoacceso).

## Success Criteria *(mandatory)*

- **SC-001**: El rastro del titular A nunca incluye un acceso al dato de la familia B (verificado por candado).
- **SC-002**: El rastro incluye TODOS los accesos de terceros al texto del titular (reporte y expediente), incluidos los de lectores ya anonimizados.
- **SC-003**: Ningún campo de identidad/contenido/operativo sale en el DTO.

## Assumptions

- La superficie (pantalla, endpoint, nav, copy) la construye SPEC-772 p2; este motor la alimenta.
- El copy que rotula el alcance (L-1) y cualquier aviso son de Diseño, con la superficie.
- `LecturaReporte` ya registra las lecturas del texto (SPEC-584); 785 solo DERIVA y expone.

## FUERA de alcance (a propósito)

Superficie/endpoint/nav (SPEC-772 p2) · acceso al círculo por AuditLog (L-1) · «mi actividad de cuenta» (L-2) · clasificación/score de IA ([ABOGADO]) · revocación (SPEC-782) · rectificación (SPEC-780) · mecanismo de petición (SPEC-772).
