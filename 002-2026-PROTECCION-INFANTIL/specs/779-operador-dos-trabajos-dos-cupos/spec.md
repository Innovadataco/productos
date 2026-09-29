# SPEC-779 · El operador tiene DOS trabajos y DOS cupos

**Feature Branch**: `work/pi-SPEC-779-cupo-sesiones-operador`
**Created**: 2026-09-29
**Status**: DESARROLLO (motor + pantalla; pendiente cert de Diseño de la pantalla)
**Base**: `main` (`7c10b8d57` al radicar; el defecto vive en `main` desde SPEC-750/#733)
**Origen**: observación de Jelkin — el operador carga CASOS (reportes/comité) y atiende SESIONES (videollamadas de citas); la sesión es carga NUEVA sobre un puesto lleno.

## El defecto (medido, no hipótesis)

`asignador-citas.ts` (SPEC-750) reusaba el modelo de asignación de CASOS para las CITAS:
- Llenaba el campo `casosAbiertos` con CITAS (`contarAsignadasAOperador`, **sin corte de fecha** → contaba todas las CONFIRMADA de siempre) y **NO filtraba por cupo**.
- El ponderador compartido calcula `peso = (cupoMaximo - casosAbiertos) / cupoMaximo`. Con más citas que `cupoMaximo` (default 10), el peso se volvía **negativo** y `weightedRandom` **degradaba** (devolvía siempre el primer candidato) — el balanceo se apagaba y nada se ponía rojo.
- `cupoMaximo` fue configurado por un admin pensando en CASOS; gobernaba también las sesiones.

## Alcance — tres piezas

1. **Cupo PROPIO de sesiones.** Parámetro `operadores.cupo_sesiones_default`, separado de `cupoMaximo` (casos). El asignador de citas FILTRA por él; sin operador con cupo → no asigna → sube al admin como capacidad (contrato SPEC-750). Corte por fecha: `contarSesionesVigentesDeOperador` cuenta solo sesiones no terminadas.
2. **Peso negativo IMPOSIBLE, no prohibido.** El filtro por cupo vive AHORA dentro de `seleccionarOperador` (invariante estructural): excluye a quien esté en/sobre su cupo y devuelve `null` si no queda nadie — ningún llamador puede olvidarlo. El nombre dejó de mentir: `OperadorCandidato` pasó de `cupoMaximo/casosAbiertos` a `cupo/cargaActual` (genéricos). El camino de CASOS conserva su conducta.
3. **Las dos cargas donde se ve y se decide.** La pantalla del admin muestra CASOS y SESIONES, cada una contra SU tope (FORMA-SPEC779). El conteo que pinta sale de la MISMA fuente que el asignador (`contarSesionesVigentesDeOperador` + `obtenerConfigAsignacion`): lo que el admin VE y lo que el sistema DECIDE no pueden discrepar.

## Forma (Diseño) — prohibiciones

Dos cargas contra su propio tope (`Casos {n}/{topeCasos}` · `Sesiones {m}/{topeSesiones}`) con barra de llenado (el vacío es el margen). **Nunca** un total combinado ni una barra única; **nunca** un semáforo agregado «disponible/ocupado». Al tope → ámbar + «al tope» (D-120: CERO rubí); bajo el tope → cielo. Sobre-tope → número REAL (no se recorta). «Al tope de casos, vacío de sesiones» y su reverso se ven OPUESTOS. En la lista, además, un chip HECHO «Al tope: casos/sesiones/casos y sesiones».

## Candados

- Invariante estructural (`asignador-cupo`): over-cupo → excluido/`null`, nunca colapsa. RED-first probado quitando el filtro (4 candados caen).
- Integración con dato real (`asignador-citas-cupo`): over-cupo no se asigna; mutación en ambos sentidos; corte de fecha (sesiones pasadas no cuentan).
- Render (`CargaDosTrabajos`): dos cargas / sin total / sin semáforo / ámbar-no-rubí / opuestas / número real sobre-tope; `chipAlTope` HECHO por trabajo.

## Impacto en arquitectura:

- **Esquema:** NINGÚN cambio. El cupo de sesiones es un PARÁMETRO (`operadores.cupo_sesiones_default`), no una columna — no hay migración ni dependencia de Datos. (Un cupo de sesiones PER-OPERADOR sería una columna nueva: follow-up con Datos si se pide.)
- **Superficie compartida:** el ponderador `seleccionarOperador` cambia de firma (devuelve `OperadorCandidato | null`) y su tipo `OperadorCandidato` renombra campos; el camino de CASOS se actualiza preservando conducta.
- **Fuente única:** `ESTADOS_OCUPAN_OPERADOR` se exporta para que la pantalla cuente sesiones con la misma fuente que el asignador. Sin ruta ni endpoint nuevos (se extienden `metricas` y la lista de operadores).

## Fuera de alcance

Vigilar al operador durante la sesión · cambiar el modelo de asignación de CASOS · riel horario del calendario (SPEC-750 filtra por FECHA) · cupo de sesiones per-operador (columna; follow-up).
