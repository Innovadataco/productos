# Plan · SPEC-447 — El profesional publica su disponibilidad

## Análisis en fuente

| Archivo | Qué se sacó |
|---|---|
| `api/profesional/franjas/route.ts` | `POST` completo y correcto: valida `fin > inicio`, crea con `tomada: false`. **No** valida solape ni modalidad. `GET` lista las futuras. |
| `api/profesional/franjas/[id]/route.ts` | `DELETE` con `borrarSiLibre` (`deleteMany` con guardia `tomada: false`): seguro ante carrera, 400 si está tomada. Nada que reescribir. |
| `dal/repositories/franja-disponible.ts` | Ya tenía `crear`, `findById`, `listarDeProfesional`, `borrarSiLibre`. Faltaba solo la consulta de solape. |
| Barrido de consumidores (`src/`, `scripts/`, `tests/`) | **Cero.** La única mención fuera de tests es el comentario de la propia ruta. |
| `lib/fechas/formato-bogota.ts` | Ya centraliza el formateo con `date-fns-tz` (v3: `fromZonedTime`). Faltaba el camino **inverso**. |
| `PerfilProfesional` | `duracionMinutos`, `atiendeVirtual`, `atiendePresencial` ya existen: la pantalla no pide nada que el perfil no sepa. |
| `docs/architecture/03-pantallas.md` | `/dashboard/profesional` ya deja pasar a PARENT en la puerta. La ruta nueva hereda esa convención preexistente. |

## Decisiones

- **La conversión de hora va al módulo de zona horaria, no a la pantalla**, y con `fromZonedTime` en vez de una constante de 5 h. Si Colombia cambiara de offset, la biblioteca lo sabe y una constante nuestra no.
- **El solape incluye las tomadas.** Una franja reservada ocupa la agenda igual que una libre.
- **Pegadas se permiten.** `[10:00, 10:45)` y `[10:45, 11:30)` no se pisan; rechazarlas obligaría a dejar huecos artificiales.
- **No se agrega `PATCH`.** «Editar» = retirar + publicar. El radicado dice que la API no se reescribe.
- **No se toca la puerta para PARENT.** Es preexistente y de otro alcance; se reporta.

## Riesgo

| Riesgo | Cómo se acota |
|---|---|
| Que la pantalla vuelva a desaparecer y la ruta quede muerta | Candado de clase que exige consumidor en `src/app/**` o `src/components/**`, excluyendo `src/app/api/**`. Probado muriendo. |
| Que la agenda se corra cinco horas | Candados de ida y vuelta sobre el día completo + afirmación del instante UTC exacto en la fila de base. |
| Que se comprometan dos citas a la misma hora | Validación de solape con contraprueba, y el caso «pegada» probado para que no se vuelva demasiado estricta. |
| Que se borre una franja con familia esperando | `borrarSiLibre` ya lo impedía; ahora hay contraprueba que afirma que **la fila sigue ahí**. |
| Que la ruta elegida deje huérfano el candado de Calidad | La fijó el CEO antes de construir y hay test que afirma que la página vive ahí. |
