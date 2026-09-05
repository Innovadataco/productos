# SPEC-464 · Lote 3 · Admin: rojos a rubí + densidad

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: paquete de Diseño `LOTE-3-ADMIN-PROFESIONAL.md` · orden de Jelkin · **Autoridad de forma**: Diseño (certifica)

**Impacto en arquitectura:** ninguno. Migración de color en pantallas admin. No rediseña la estructura operativa.

---

## Qué se hizo

**Rojos → `rubi` (criticidad legítima del backoffice; ninguno es alarma sobre un niño — verificado en fuente, a diferencia del colegio).** En las 8 pantallas admin del paquete:
- Banners de error `bg-red-50 text-red-800 dark:...` → `bg-rubi/10 text-rubi` (colegios, colegios/nuevo, apelaciones, gestión, clasificación).
- Asteriscos de obligatorio `text-red-500` → `text-rubi` (colegios).
- Errores de formulario `text-red-600 dark:text-red-400 role=alert` → `text-rubi` (estructura-colegio, círculo-padre).
- Barra de severidad de carga del operador `bg-red-500` → `bg-rubi` (operadores/asignar).

**De paso (paquete §A, «el residual se limpia de paso»):** en las MISMAS clases que toqué, el hermano semántico apareado — éxito `emerald`→`pino`, atención `amber`→`ambar`, riel `slate`→`tinta` — para no dejar un semáforo medio tokenizado. No se persiguió color fuera de las líneas de los rojos (eso lo migran los muebles).

**Densidad (§C):** respetada — cambio de color, sin tocar estructura, espaciado ni verbos. El admin sigue denso; no se agregó aire ni bienvenida.

## Candados

- `tokens:check` baja por conteo (**NO se toca el PISO** — regla SPEC-466): 978 < piso 1021 → VERDE. Floor-safe, fuera de la cadena de serialización.
- `admin-sin-rojo-crudo.candado.test.ts` (fuente, sin BD): **barrido de `src/app/dashboard/admin/**` → 0 `red-*` crudo.** Contraprueba por mutación (rojo de vuelta en una pantalla → rojo).

## Lo que NO entra
Todo lo que cae con un mueble (Tabla/Badge/Alerta/Button/Input) no se toca acá — lo migra su ola.

## Certificación
La da **Diseño** (muestreo por código tras login; críticas con recorrido de Calidad).
