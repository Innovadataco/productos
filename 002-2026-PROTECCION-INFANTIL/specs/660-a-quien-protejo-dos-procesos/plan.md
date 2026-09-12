# SPEC-660 · Plan

## Enfoque

El pedido de Jelkin —que «A quién protejo» se sienta como el Círculo de Confianza— se
resuelve **partiendo un proceso en dos** sobre el mockup vigente
(`dos-procesos-configurar-y-alertar-spec660.html`):

1. **Configurar** (registrar/editar menores y cuentas) se muda a **Mi perfil ›
   «Menores de edad»**. El CRUD deja de vivir en `/dashboard/padre/hijos`.
2. **Enterarse** (¿cómo están?) se queda en **«A quién protejo»**: un gráfico de estado,
   la línea de estado del motor, y el hueco de cobertura. **Cero formularios.**

El acople se desarma **invirtiendo el orden** (expand-then-contract) para no dejar un
transitorio donde el CRUD no exista en ninguna de las dos pantallas:

- **Fase C (Dev 3, primero):** agrega la sección «Menores de edad» a Mi perfil con el
  CRUD completo, **sin quitar nada** de `hijos/`. (#580)
- **Fase B (Dev 1, después — este trabajo):** repunta `hijos/page.tsx` a la pantalla de
  enterarse y **saca el CRUD**. Es la que «cierra la puerta vieja».

Los estados del gráfico salen **solo** de datos que ya llegan —`listarHijos` (estado +
identificadores.activo) y `obtenerHomePadre` (`estadoClasificador`, `resumen`)— así que
ola-1 no toca esquema, migración ni endpoint. La única regla no-presentacional es la
asimetría **I-396** (motor caído ⇒ la ausencia de reportes no es confiable, la presencia
sí), que vive en `derivarEstadoHijo` y queda cerrada por candado de render.

## Contratos que consume (no define)

- **Dev 2 (SPEC-663, #575):** `obtenerHomePadre` expone
  `estadoClasificador: { motorVivo, ultimaVerificacionEn }` (de `leerLatidoMotor`,
  SPEC-670). El dato llega **honesto** (`ultimaVerificacionEn` no se recorta en degradado).
  La decisión de **no** pintar el reloj en la cara del padre cuando el motor está caído es
  del RENDER, y el candado la vigila.
- **Datos (#573):** `tieneReportes: boolean` por hijo (booleano, NO conteo — Diseño
  prohibió números sobre nodos).

## Componentes (todos nuevos, presentacionales, en la unidad de test jsdom)

| Componente | Rol | Candado |
|---|---|---|
| `GraficoProteccion` | SVG de estado; `derivarEstadoHijo(tieneReportes, motorVivo)` | asimetría I-396 · nunca rojo · hueco = cielo · sin contador de reportantes |
| `LineaEstadoProteccion` | línea de estado del motor | no pinta «Revisado hace {X}» en degradado aunque el dato traiga valor · sin «te avisamos» (I-397) |
| `BloqueHuecoCobertura` | por-hacer cielo por hijo activo sin cuentas | cielo nunca ámbar/rojo · nombra al hijo · vacío ⇒ nada |
| `AQuienProtejoView` | ensamblado + estado vacío diseñado | (cubierto por los tres de arriba) |

## Orden de trabajo (ola-1)

1. Construir los tres componentes NUEVOS + sus candados (sin conflicto con nadie).
2. Consumir el contrato de Dev 2 en `LineaEstadoProteccion`.
3. Esperar a que Fase C (Dev 3, #580) esté encaminada.
4. **Fase B:** repuntar `hijos/page.tsx` a `AQuienProtejoView` y sacar el `MisHijos` viejo.
5. Preflight (tsc · tokens · arch · lint · candados) + specs-discipline local.
6. PR. Merge **después** de Fase C para que configurar nunca quede huérfano.

## Fuera de este plan

- **Ola-2 (US4, enterarse con reporte):** bloqueada por FORMA-666 (verificados vs anónimos
  nunca sumados) y va después de SPEC-644 (franja, ya en main).
- Las **mejoras de presentación del listado** de menores son cambios a `MisHijos`, que es
  de Dev 3 — no de este trabajo.
