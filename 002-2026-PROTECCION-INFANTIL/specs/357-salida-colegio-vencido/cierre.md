# SPEC-357 · Cierre — la salida del colegio encerrado (I-254)

**Fecha**: 01-09-2026 · **Dev**: PI-2 · **Rama**: `work/pi-SPEC-357-salida-vencido`

## Los tres candados, y por qué cada uno

### 1. La caja siempre abierta (FR-001)

- `guardias.ts`: `/dashboard/colegio/suscripcion` entra en `camino.exentasColegio`.
  Sin esto el guardián devolvía 307 al paso pendiente: el rector veía su única
  salida y el sistema se la cerraba.
- `camino/colegio/plan/page.tsx`: la doble valla (que redirige al paso derivado)
  ya no corre cuando el servicio está vencido. Es la pantalla donde se compra;
  con la vigencia caída, manda ella.
- Fila nueva en `NUNCA_TAPADAS_COLEGIO` (middleware.test.ts).

### 2. Criterio único de "vigente" (FR-002)

`existeSuscripcionVigenteParaTitular` (pagos-repository) miraba **solo el
estado**; el guardián de vigencia mira **la fecha**. Esa asimetría es la joya de
la contradicción que documentó Calidad: la misma suscripción era "vigente" para
prohibirle comprar y "vencida" para prohibirle trabajar. Ahora ACTIVA/EN_GRACIA
exigen además `fechaFin >= ahora`. `PENDIENTE_AUTORIZACION` se conserva sin
filtro de fecha a propósito: es una compra esperando el clic de un
administrador, no una ventana de servicio (y con filtro, un rector podría
duplicar solicitudes mientras espera).

### 3. Los pasos del camino no se cierran por vigencia (FR-003/004)

`src/lib/colegio/vigencia-camino.ts` — una sola función,
`verificarVigenciaColegioSalvoCamino`, aplicada a **28 handlers** de las cinco
familias que el camino necesita (enumeración 22v5 en el commit):
profesores (3), cursos (10), alumnos (7), carga (3), materias (3),
identificadores-profesor (2).

La excepción está acotada a propósito:

- solo cuando el corte es `vencido` — un colegio `inactivo` (dado de baja por un
  administrador) **sigue cortado**; el camino no puede ser una puerta trasera
  para volver a operar. Este agujero apareció al escribir el test del caso
  inactivo y se cerró antes de existir;
- solo para SCHOOL_ADMIN — el comité consume, no configura;
- solo mientras `derivarPasoPendienteColegio` devuelva un paso. Apenas el camino
  cierra, la vigencia vuelve a mandar exactamente como antes.

No es una exención nueva de producto: el middleware ya eximía estas rutas del
guardián de vigencia (SPEC-344/355) y el handler las cerraba por dentro. Son las
dos capas del mismo guardián puestas de acuerdo (familia I-211).

## Tests (candado 24v2)

Cuatro casos afirmaban «colegio vencido → 403» usando un colegio de fixture que
está **a mitad del camino** — es decir, afirmaban el encierro. Se actualizaron
con assert fuerte y nombre nuevo, cubriendo las dos mitades de la regla:
`profesores`, `cursos`, `materias` (los tres: a medias 200/201 · cerrado 403) y
`carga` (camino cerrado → 403). Fixture compartido nuevo en `reporte-test-utils`
(`terminarCaminoColegio`, `vencerColegio`) para no repetir el armado en cuatro
archivos.

Cobertura nueva: `vigencia-camino.test.ts` (4 casos: en camino / camino cerrado /
vigente / inactivo) y 2 casos de criterio en `pagos-repository.test.ts`.

## Gate

`tsc` limpio · lint 0 errores · unit **1925/1925** · integración de todo lo
tocado (api/colegio + lib/colegio + lib/pagos + lib/routing + pagos-repository)
**472/472** · `next build` verde · `arch:check` VERDE.

## Fuera de alcance (orden del CEO)

`/api/reportes` (I-253 · Dev PI-1) y `/api/colegio/alertas` (I-251 · spec
agrupada de guardianes desalineados). No se tocaron.

## Verificación pendiente en vivo

El recorrido del encierro completo (colegio vencido en el paso 3 → carga
profesor → va a la caja → compra) lo cierra el CEO/Calidad en prod tras el
deploy; acá quedó fijado por tests de handler real, que es donde vivía el 403.
