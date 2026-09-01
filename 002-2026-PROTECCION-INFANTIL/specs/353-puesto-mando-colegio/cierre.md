# SPEC-353 · Puesto de mando del colegio (A-69 · C6) — Cierre

**Fecha**: 01-09-2026 · **Dev**: PI-2 · **Rama**: `work/pi-SPEC-353-puesto-mando-colegio`

## Qué quedó construido

### US1 — La frase accionable ("qué hacer hoy")
- `AlertaColegioRepository.identificadorCruzado7d`: cruce por VALOR de identificador
  que toca >1 estudiante en alertas visibles de 7 días — devuelve SOLO conteos,
  jamás valores (anti-enumeración en ambas dimensiones).
- `AlertaColegioRepository.ultimaAlertaSinAbrir` y
  `ComiteConvivenciaSolicitudesRepository.abiertosConAntiguedad` (conteos + fechas).
- `HomeRector` DTO: `+casosComite`, `+ultimaAlertaSinAbrirEn`, `+identificadorCruzado`
  dentro del `Promise.all` existente (una carga, cero N+1).
- `src/lib/colegio/que-hacer-hoy.ts`: módulo puro, prioridad
  **cruzado > alertas sin abrir > comité > calma**, título multi-pendiente
  ("Dos/Tres cosas necesitan su atención hoy"), usted formal, espejo de
  `calcularSugerenciaHome` del padre.
- `QueHacerHoyCard` entre HeroEstado y EmbudoEstado (retardo 90): ámbar solo si
  algo espera; calma sin color de alerta; **nunca rojo**.

### US2 — Configuración de avisos con el diseño A-62
- `ConfiguracionPageClient` rediseñada in-place: 4 frases R5 con `Switch` y PATCH
  inmediato (optimista + reversión en fallo), umbrales como frase
  ("Avisar a partir de [N] reportes en [M] días") persistiendo en blur, cabecera
  "Le escribimos a **{correo}**" con override en línea (se aplica a los 4 tipos;
  vacío = correo del rector).
- Contrato `GET/PATCH /api/colegio/preferencias-avisos` **intacto** (FR-008):
  sus tests de integración pasan sin una línea modificada (T007).

## Evidencia (CI verde ≠ funciona — recorrido real en navegador, puerto 5006)

1. **Calma**: colegio sin pendientes → "Todo al día · No hay nada que espere por
   usted en este momento" + "Ver el movimiento" (sin color de alerta). ✅
2. **Comité**: solicitud PENDIENTE de 5 días → caja ámbar "Algo necesita su
   atención hoy · El comité tiene un caso desde hace 5 días" + botón Seguir. ✅
3. **Alerta sin abrir**: alerta `nueva` sembrada → "Dos cosas necesitan su
   atención hoy · Un aviso espera su atención en la bandeja" + Ver ahora. ✅
4. **Cruzado** (prioridad máxima): mismo valor en 2 estudiantes con alertas <7d →
   "Tres cosas necesitan su atención hoy · Una misma cuenta aparece en los casos
   de dos estudiantes esta semana…" — sin exponer el valor del identificador. ✅
5. **Configuración**: toggle Resumen semanal OFF → PATCH inmediato → recarga →
   sigue OFF. Umbral curso 3→5 en blur → recarga → 5. ✅
6. **390 px**: home (tarjeta ámbar completa) y configuración (frases con inputs
   embebidos fluyendo) legibles. Consola sin errores. ✅

Datos del recorrido sembrados en BD **dev** (colegio `dev2.rec344final`),
reversibles con `reset-piloto` del CEO.

## Gate (T008)
`tsc` limpio · lint 0 errores · unit 1876/1876 (incl. 9 de que-hacer-hoy, 3 de la
tarjeta, 7 del rediseño) · integración focalizada verde (12 repos + 6 endpoint
preferencias sin tocar) · `next build` verde · `arch:check` VERDE.

## Impacto en arquitectura
Solo lectura agregada nueva (conteos) en DAL; ningún cambio de esquema, ninguna
columna persistida de estado derivado (anti I-211); contrato de preferencias
intacto. Sin migraciones.

## Deuda declarada
- El header de la Configuración aplica el override de correo a los 4 tipos en
  4 PATCH; si algún día se quiere correo por tipo, la UI necesitará filas propias
  (el backend ya lo soporta).
