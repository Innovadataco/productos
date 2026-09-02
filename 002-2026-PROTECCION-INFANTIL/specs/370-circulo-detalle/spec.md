# SPEC-370 · Círculo — el nombre y el mapa dentro de la persona

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: Calidad, verificación en vivo del círculo (15/17)

Dos defectos **propios de SPEC-367**, encontrados al recorrer la pantalla.

## I-264 · "Ver de qué se trata" decía "Sin nombre"

Al abrir el panel de una persona aparecía **"SN · Sin nombre"** en vez del nombre.
Calidad afinó el diagnóstico: el nombre **sí** se ve en la tarjeta de la lista y
en "Necesita tu atención"; **solo se pierde al abrir el detalle**, que se
re-consulta al endpoint.

**Causa (verificada en fuente):** `obtenerDetalleContacto` arma su respuesta a
mano y devolvía solo `etiqueta` (deprecada) — sin `nombre`, `parentesco` ni
`creadoEn`. La LISTA sí los traía (usa `include`), y en SPEC-367 verifiqué la
lista y **asumí que el detalle tenía la misma forma**. No lo verifiqué: ahí
estuvo el error.

**Arreglo:** el detalle devuelve también `nombre`, `parentesco` y `creadoEn`.

## I-265 · Faltaba el mapa dentro de la persona

La decisión 3 de Jelkin es que las estadísticas (mapa/categorías/mensual) vivan
dentro de cada persona. Categorías y mensual se veían; el mapa no.

**Causa:** el bloque "Dónde" estaba condicionado a que hubiera **coordenadas**.
Un reporte con la ciudad en texto pero sin vincular al catálogo (`ciudadRel`
nulo) no aporta lat/lng → cero puntos → sección invisible. No era el componente:
era la condición.

**Arreglo:** el bloque aparece siempre que haya ciudades. El mapa se pinta cuando
se puede ubicar, y las ciudades se listan siempre (con su conteo), así la sección
nunca desaparece y sigue siendo honesta cuando no hay coordenadas.

**Y sin rojo:** el mapa compartido pinta los marcadores con una escala de riesgo
que incluye **rojo**. Se le agregó una paleta opcional `paleta="padre"`
(ámbar/pino, nunca rojo) que usa el círculo; **los otros cuatro callsites
(consulta pública, dashboard, caso del colegio, expediente) conservan su
comportamiento** — el valor por defecto no cambia.

## Impacto en arquitectura: no

Sin modelo ni migración: tres campos que ya existían se agregan a la respuesta
del detalle, y una prop opcional en el mapa compartido.

## Cómo se probó

`DetallePersona.test.tsx` (5): muestra el nombre real (y cae de vuelta a
`etiqueta` en contactos viejos, sin romper); el bloque "Dónde" aparece aunque la
ciudad no tenga coordenadas; con coordenadas sí se pinta el mapa; y sin reportes
no se inventan estadísticas. Los tests del círculo (35 + 7) siguen verdes.
