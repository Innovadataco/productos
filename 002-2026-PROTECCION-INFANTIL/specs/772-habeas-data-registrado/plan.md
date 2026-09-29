# Plan · SPEC-772 · habeas data registrado y venceable

## Compuerta §4 — este plan PARA acá
`spec.md` + `plan.md` = DISEÑO. El CEO aprueba (D-1..D-4) antes de `tasks.md`+implementación.
**La puerta de entrada es SPEC-752 (Dev-3), NO se construye acá.** Prioridad: el `ci.yml` de 774 preempta.

## Espejo de la Apelación (SPEC-110) — lo que se copia y lo que cambia
| Apelación (existe) | SPEC-772 (nuevo) |
|---|---|
| `ApelacionIdentificador` (sujeto: identificador reportado) | `SolicitudHabeasData` (sujeto: datos del titular) |
| `src/lib/apelaciones.ts` (service, días hábiles, estados) | `src/lib/habeas-data.ts` (service espejo) |
| plazo por `ParametroSistema` (interno) | plazo LEGAL 10/15 (art. 14/15) — constante [NORMA] o param-con-piso (D-3) |
| `sumarDiasHabilesColombia` (768) | igual |
| estado en enum | enum + **fuente única `estadoEfectivoSolicitud`** (espejo #718, con `RESUELTA_TARDE`) |

## Blast radius (medido)
- **Nuevo:** `prisma/schema.prisma` (modelo `SolicitudHabeasData` + enum de tipo/estado; FK a `Usuario`; `venceEn` NOT NULL; migración aditiva — **carril de Datos**, se radica). `src/lib/habeas-data.ts` (service). `src/lib/habeas-data/estado-efectivo.ts` (fuente única). API bajo `src/app/api/padre/…` (crear/consultar solicitud) — **el mecanismo de atrás**, no la puerta.
- **Reuso (rectificar):** `PATCH /api/padre/perfil` (8 campos), `PATCH /api/padre/hijos/[id]`, `hijos/identificadores/[id]`. No se duplican.
- **Corrige:** `src/app/privacidad/page.tsx` §6 (copy de Diseño).
- **NO se toca:** el texto del reporte (inmutable); la supresión de contenido de reporte (bloqueo [ABOGADO]); la puerta (752).

## Candados (tras aprobación §4)
- **`estadoEfectivoSolicitud`** unit puro: `RESUELTA_TARDE` cuando `resueltaEn > venceEn`; `VENCIDA_SIN_RESOLVER`; control positivo por mutación; `now` inyectable, falla conservador. Espeja el candado de `estadoEfectivoDeCita`.
- **`venceEn` NOT NULL**: compuerta de inserción (imposibilidad estructural, no validación de UI). Datos lo pone en el schema; el candado lo prueba.
- **Vencimiento dos direcciones, ancla finde + festivo** (los casos de 768).
- **Supresión con identidad verificada en el SERVIDOR** (control positivo por remoción de la identidad).
- **PII / FKs**: la tabla cuelga del titular → del menor; se trata como PII.

## [ABOGADO] — se MARCAN, no se resuelven
Tres tensiones (supresión vs conservación · consentimiento operador · rectificación vs inmutabilidad — esta última hallada acá, con la hipótesis-adenda del CEO escrita como hipótesis). Van a Estrategia/abogado (paquete v5).

## Gate de calidad (al implementar)
`tsc` + `lint` + `test:unit` completo (specs-discipline) + candados + `build`. El modelo/migración se radica a **Datos** (D-121, carril de datos). Verificar por exit code.

## Secuencia
§4 (este doc) → **PARÁ, aprobación CEO (D-1..D-4)** → radicar el modelo a Datos (migración aditiva, `venceEn` NOT NULL) → `estadoEfectivoSolicitud` + candado → service espejo + API del mecanismo → reuso de rutas de rectificación → copy de privacidad (Diseño) → gate → PR. **Interrumpible por el `ci.yml` de 774 cuando entre #752.**
