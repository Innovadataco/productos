# SPEC-656 · «Encontrar psicólogo» sin psicólogos: separar el vacío estructural del vacío por filtro

**Status**: DESARROLLO
**Rama:** `work/pi-SPEC-656-directorio-vacio-estructural` · **Autor de la spec:** Dev 1 · **Radicado:** `RADICADO-SPEC-656-2026-09-11.md`
**Origen:** Estrategia (REPORTE-054) a pedido del CEO · **Relacionado:** I-387 · SPEC-655 · **Forma (autoridad Diseño):** copy de los dos vacíos, pendiente.

**Impacto en arquitectura:** cero esquema, cero migración, cero ruta de urgencia nueva. El predicado de «verificado» ya está factorizado (`PerfilProfesionalRepository.vigenciaVigente` = estado ACTIVO ∧ verificación APROBADO no-vencida); se agrega un `count` que lo REUSA (conteo y lista no pueden discrepar) y el API devuelve un booleano `hayVerificados` (aditivo; un `count` no proyecta campos ⇒ no toca el allowlist H-2). El puente de urgencia **reusa el componente que ya existe** (`<CanalesOficiales/>`: Línea 141 ICBF · CAI Virtual · Te Protejo), ya montado en el perfil del profesional y en el bloque de consulta vacía — **no se inventa una segunda ruta de urgencia** (pedido explícito del CEO). La detección es una función pura (`clasificarVacioDirectorio`) con candado de unidad.

## Lo que pasa hoy (verificado contra código)
En producción hay **cero profesionales verificados** — el directorio exige `estado ACTIVO` **Y** verificación `APROBADO` no vencida (`perfil-profesional.ts:229-247`, `listarActivos`), y eso es la lectura correcta de la ley. **Lo que falta no es filtro, es gente.** Pero `DirectorioProfesionales.tsx:178` pinta un único vacío: «Ningún profesional coincide con los filtros. Prueba cambiar la ciudad o la modalidad.» Eso le dice al padre **dos cosas falsas**: que hay filtros que ajustar, y que el problema es su búsqueda. Y lo lee **justo después de reportar algo sobre su hijo** — el peor momento para un callejón que lo culpa.

## La distinción es detectable, no interpretable
Correr la consulta base **sin filtros** y contar:

| vacío | cuándo | qué dice |
|---|---|---|
| **ESTRUCTURAL** | 0 verificados EN TOTAL (`hayVerificados=false`) | en primera persona: todavía no hay ninguno; **nunca** culpar la búsqueda. + salida honesta. |
| **POR FILTRO** | hay verificados, 0 con esos filtros (`hayVerificados=true`, lista vacía) | ahí **sí** «amplía tu búsqueda» (el copy de hoy ya sirve para este caso). |

## Requisitos funcionales
- **FR-001 (detección):** `clasificarVacioDirectorio(cantidadListada, hayVerificados)` → `con-resultados | estructural | por-filtro`. Con 0 verificados en total, el resultado es **`estructural`, jamás `por-filtro`**. Candado de unidad, verificado por mutación.
- **FR-002 (dato):** `GET /api/padre/profesionales` devuelve `hayVerificados` = ¿hay ≥1 verificado sin filtros? El conteo solo corre cuando la lista filtrada sale vacía (con resultados en mano no se recuenta).
- **FR-003 (vacío estructural):** asume el problema en primera persona (copy de Diseño), **reusa `<CanalesOficiales/>`** (no inventa ruta de urgencia) y ofrece volver al expediente. No contiene ningún affordance de «cambiar filtros».
- **FR-004 (vacío por filtro):** conserva «amplía tu búsqueda» (voz «tú»).
- **FR-005 (candado de render):** en el caso estructural (`hayVerificados=false`) la pantalla **no** muestra el copy que culpa la búsqueda ni el affordance de filtros, y **sí** muestra los canales oficiales. Muere si alguien vuelve a pintar el vacío estructural como «por filtro».

## Restricciones que NO se tocan
- **Una sola ruta de urgencia:** el vacío estructural usa `<CanalesOficiales/>`, el mismo camino de emergencia del resto del producto. Prohibido un segundo juego de números/ruta que le diga al padre algo distinto en el mismo momento (pedido del CEO a Diseño).
- **Allowlist H-2 (Ley 2375/2024):** la respuesta del directorio no gana ningún campo de profesional; `hayVerificados` es un booleano agregado.
- **Voz del padre = «tú»** (SPEC-501).

## Dependencias y secuencia
- **Bloquea el cierre:** el **copy de los dos vacíos lo escribe Diseño** (carril Diseño→Dev). No se inventa copy. El mecanismo (FR-001/FR-002) es sustancia ya acordada y se construye en paralelo.
- **Decisión CEO (resuelta):** «avísame cuando haya» **DIFERIDO**. La capa 2 entra SOLO como encuadre («estamos sumando/verificando psicólogos»), **sin** la promesa «te avisamos» ni el botón. Razón: es mecanismo nuevo (persistencia + disparo) y además el proveedor de correo está sobre-cupo (el aviso no saldría) ⇒ prometerlo sería I-397 doble. Queda «pendiente ratificación Diseño» en el PR; la capa 2 de Diseño entra entera cuando el mecanismo y el correo vuelvan (la copy ya está escrita). Los otros dos puentes (canales oficiales + descargar el informe) sí son render y quedan cableados.

## Fuera de alcance
- «Avísame cuando haya» (backend) salvo que el CEO lo meta en esta ola.
- El filtro de verificación en sí (`vigenciaVigente`) — es correcto, no se toca.
