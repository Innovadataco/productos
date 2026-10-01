# SPEC-793 · ¿En qué sala ocurre la sesión de un menor? — allowlist de proveedores del enlace

> **Status**: `IMPLEMENTADO` · precondición para el PRIMER enlace real, no para construir.
> **Rama**: `work/pi-SPEC-793-allowlist-proveedor-enlace` (base `main`). **Radicado**: `RADICADO-SPEC-793-2026-09-29.md`.

## 1 · Por qué

`validarEnlaceReunion` (SPEC-750) aceptaba **cualquier** URL `https` sin marcado HTML — **sin lista de
proveedores**. Un operador podía pegar el enlace de **cualquier servicio de video del planeta**, y ahí
ocurre una **sesión de salud mental sobre un menor**. No es el límite que 750 declaró: 750 dijo, bien,
que **no controlamos la sala**; nadie decidió **cuáles salas son aceptables**. «No controlamos el
proveedor» ≠ «no sabemos cuál es». El peso: tratamiento de datos por un tercero no evaluado (Ley 1581),
transferencia internacional (art. 26), y proveedores que graban por defecto o exigen cuenta.

## 2 · Medición (antes de asumir)

- **Enlaces publicados hoy: CERO.** Medido en la BD de test (0) y declarado en el radicado para prod
  («no hay un solo enlace publicado en producción»). El control se pone **antes** del primer enlace real.

## 3 · Qué hace

1. **Allowlist de proveedores validada EN SERVIDOR** (`enlace-validacion.ts`): el host del enlace debe
   pertenecer a un proveedor **aprobado**; si no, se rechaza con motivo legible. Se conserva todo lo de
   750 (https, no-HTML).
2. **La lista vive en el CÓDIGO, no en configuración** (decisión del CEO, contra la costumbre de
   parametrizar): agregar un proveedor es una decisión con **peso legal** (acuerdo de tratamiento, dónde
   viven los datos), no una conveniencia operativa. En código exige un PR que alguien revisa; como
   parámetro, un admin lo agrega un martes y nadie se entera. **La fricción es el control.**
3. **Cada entrada lleva escrito POR QUÉ** está aprobada (quién es, dónde trata los datos, qué falta
   revisar). Una lista sin razones se copia sin pensar.
4. **Lista inicial = PROPUESTA mínima, TODOS `aprobado: false`** (pendiente de Jelkin + [ABOGADO]).
   Fail-closed: hasta que Jelkin apruebe uno en un PR, **ningún enlace pasa**. El CONTENIDO (cuáles
   proveedores) **no lo elijo yo ni el CEO** — es de Jelkin con el abogado; Estrategia prepara la propuesta.
5. **Match por host EXACTO o SUBDOMINIO propio**, nunca «contiene»: `meet.google.com.atacante.co` (un
   subdominio de `atacante.co` que solo contiene el nombre aprobado) se **rechaza**.

## 4 · Candados

| Candado | Qué prueba |
|---|---|
| `enlace-proveedor-aprobado.candado.test.ts` (unit) | El MECANISMO con proveedores de PRUEBA (no los reales): aprobado entra / cualquier otro se rechaza / pendiente no cuenta / subdominio entra / **look-alike se rechaza** / fail-closed. **Content-independent**: NO se pone rojo cuando Jelkin cambie la lista (prueba el mecanismo, no el contenido). + forma de la lista real (cada entrada tiene su porqué y dominios; sin fijar cuáles). |
| `enlace-allowlist-servidor.candado.test.ts` (integración) | La validación es de **SERVIDOR** (`publicarEnlaceSesion`, el camino del endpoint): fail-closed con la lista real (rechaza y no persiste), control positivo con un proveedor de prueba aprobado, y look-alike rechazado en el servidor. |

- **Control positivo por mutación:** quitar el chequeo de allowlist → el caso «otro dominio» pasa → rojo.
- **NO reconciliar** — ver §5.

## 5 · Hallazgo (tests de 750 que el cambio tocó)

Dos tests de SPEC-750 asumían el comportamiento viejo (cualquier https aceptado): `enlace-sesion.test.ts`
(publicaba `meet.example.com`) y `sesion-operador.candado.test.ts` C-c (publicaba `video.example` para
probar que la URL no entra a `AuditLog`). Con la allowlist esos hosts se rechazan. **Es exactamente el
agujero que 793 cierra.** Como `validarEnlaceReunion`/`publicarEnlaceSesion` ahora aceptan la lista de
proveedores como parámetro inyectable, ambos tests **inyectan un proveedor de PRUEBA** que aprueba su
host, preservando su invariante original (formato / no-fuga-de-URL) sin depender de la lista real.

## 6 · Fuera de alcance

**Cuáles** proveedores se aprueban (Jelkin + abogado; la spec deja el mecanismo + propuesta pendiente) ·
grabación/presencia/controles del paso 8 (no los tenemos, y así se declara) · caducidad/vida del enlace
(750 ya declaró que no la controlamos).

---
> **Impacto en arquitectura:** amplía una regla pura de validación (capa de servicios) y su consumo en
> `publicarEnlaceSesion` (inyección de la lista, default = código). No toca schema, ni el stack, ni la
> navegación; no regenera artefactos.
