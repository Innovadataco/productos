# SPEC-013 · research.md · UI chat + Vega-Lite

## Decisiones

### D-013-01 · `react-vega` sobre alternativas
- `react-vega` (oficial): wrapper directo, tipos incluidos, mantenido por el equipo Vega.
- `visx` (Airbnb): componentes de bajo nivel · más flexible pero implica reescribir cada gráfico.
- `recharts`: fácil pero limitado y sin especificación Vega-Lite (JSON spec) declarativa.

`bi-vanna` (SPEC-012) devuelve `graficoSpec` como JSON Vega-Lite generado por plantilla determinista (candado 10). El renderer natural es `react-vega`. Los otros nos obligarían a mapear el JSON a componentes React caso por caso.

### D-013-02 · Historial en memoria de sesión, NO persistido
En Fase 1 el chat es interno (Jelkin + Fábrica). Persistir historial exige:
- Tabla `bi_chat_sesion` + `bi_chat_mensaje`.
- Multi-usuario · aislamiento por sesión browser vs usuario BD.
- Deep-linking a conversaciones.

Todo eso es Fase 2 (comercial). En Fase 1 el historial vive en React state · se pierde al refrescar. Se documenta como deuda con estimado 2-3 días.

### D-013-03 · Copiar componentes UI base de PI en vez de package compartido
D-15 de PI dice: "hasta que exista una segunda copia y sepamos qué necesita cada consumidor, la duplicación es más barata que el package compartido". Se replica aquí.

Migrar a package compartido `@innovadataco/ui` es Fase 3 cuando PI y BI ambos consuman los mismos módulos comerciales.

### D-013-04 · Rol ADMIN por prop, no por hook global
Hasta INSTRUCTIVO-009, la sesión y roles pasarán por un middleware simple que inyecta el usuario en cada request/component. En SPEC-013 se propaga como prop desde `page.tsx`. Cuando llegue la auth completa, se refactoriza a un hook `useUsuario()`.

### D-013-05 · Botón 👍 aprueba la última consulta OK del historial
El backend recibe `consultaLogId` · no la pregunta ni el SQL. Esto garantiza integridad:
- Aprobar no puede introducir divergencia entre pregunta y SQL (el backend lee del log).
- Auditoría clara (quién aprobó qué log).

### D-013-06 · Sin streaming de tokens
`react-vega` no necesita streaming. El motor ya tarda 5-9 s por consulta · agregar streaming del texto narrativo (que además viene de plantilla determinista · NO es texto libre del LLM) daría poca sensación de progreso. Fase 2 lo aborda con SSE si se requiere.

## Riesgos

1. **Falsos clicks 👍/👎:** un usuario descuidado alimenta cache semántico con SQL malo. Mitigación: sólo ADMIN puede aprobar · en Fase 2 se agrega "confirmar aprobación" modal.
2. **Vega bundle grande:** `next build` puede alertar ~600 KB. Aceptable en tablero interno.
3. **Componentes copiados de PI evolucionan:** si en PI cambian `button.tsx`, aquí no se sincroniza automáticamente. Deuda técnica documentada.

## Verificación en fuente

- `productos/002-2026-PROTECCION-INFANTIL/src/components/ui/` — inventariar antes de copiar (verificar D-15 vigente y qué componentes existen).
- Endpoint `/api/bi/preguntar` (SPEC-011) devuelve `consultaLogId` → confirmar en `RespuestaMotor` (SPEC-011 §4).

## Plan de verificación en vivo (candado 14)

La verificación real (5 preguntas obligatorias del BRIEF §5 · flujo completo con UI y backend) vive en SPEC-014.

En este SPEC solo se hace un smoke local:
1. `npm run dev`
2. Abrir `/chat` en navegador.
3. Escribir "cuántos reportes hoy" y enviar.
4. Ver respuesta con tarjeta numérica.
5. Click en 👍 → confirmar 200 OK en devtools.
