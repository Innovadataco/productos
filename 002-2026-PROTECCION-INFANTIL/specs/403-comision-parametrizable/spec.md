# SPEC-403 · La comisión de la red es un parámetro — cierra I-288

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Dev 02 (`idc-80`) · **Origen**: **I-288** · brief A-75 §4 · reasignada del Dev 01 al Dev 02 por el CEO (23:0x) tras centralizar la constante en SPEC-425.

**Impacto en arquitectura:** ninguna migración. Un `ParametroSistema` nuevo (`comision.porcentaje`) y dos consumidores que lo leen. Cambia una conducta: **crear una solicitud de cita falla si el parámetro no está**, en vez de cobrar un número quemado.

> **Se construyó sobre SPEC-425** ([#330](https://github.com/Innovadataco/productos/pull/330), ya en `main` como `7f9856e1`), que es donde nació `lib/profesional/cita/comision.ts`. Este PR sale rebasado contra `main` y trae **solo** el cambio de 403.

---

## Para qué

El porcentaje que la red cobra sobre la tarifa del profesional vivía así:

```ts
// src/app/api/padre/citas/route.ts
const PORCENTAJE_SERVICIO_DEFAULT = 15;
```

Tres problemas, en orden de gravedad:

1. **El número está mal.** El brief §4 dice **10 %**; el producto cobraba 15.
2. **Cambiarlo costaba un despliegue**, para un número que es decisión de negocio y que Jelkin ajusta.
3. **Era privado de una ruta.** SPEC-425 necesitó mostrarle al profesional lo que se le cobra y tuvo que sacarlo de ahí; con dos copias, un día habrían dicho cosas distintas.

---

## Qué trae

**`ParametroSistema` `comision.porcentaje`**, sembrado idempotente en **10**, editable desde admin. Los dos consumidores —`api/padre/citas` al crear la solicitud y el panel del profesional al mostrar el desglose— leen de ahí.

**`update: {}` a propósito.** Si el admin lo ajusta, un despliegue posterior **no** puede pisarle el valor. Es el default documentado de `deploy-prod.sh` («respeta los valores custom»); sembrar con `update` explícito le reescribiría la decisión en silencio, y esto mueve plata.

**Una solicitud ya creada conserva su porcentaje.** `SolicitudCita.porcentajeServicio` guarda el que se aplicó: cambiar el parámetro no reescribe lo que ya se cobró, y el panel muestra el histórico de cada cita, no el vigente.

**Falla en cerrado si el parámetro no está.** Es dinero: cobrar un porcentaje inventado porque el seed no corrió es peor que no dejar crear la solicitud. Mismo criterio que `verificacion.requisitos` y que SPEC-418, aprobado por el CEO. También rechaza un valor no entero o fuera de 0-100.

---

## Verificación

**Contra la base, los dos casos que importan del seed:**

| Situación | Resultado |
|---|---|
| Base limpia → seed | `comision.porcentaje = 10` |
| Admin lo pone en 12 → se re-siembra | **sigue en 12** |

Ese segundo caso es la prueba de que un despliegue no le deshace el ajuste. Se corrió de verdad, no se dedujo del código.

**10 tests de integración verdes** sobre el panel (base propia, creada y destruida). Los tres de esta spec:

- Sin solicitudes, el panel muestra el **porcentaje vigente**; el admin lo cambia a 20 y **la pantalla cambia con él**, sin desplegar.
- Con una solicitud ya cobrada al 15 %, el panel sigue mostrando **15** — el histórico manda sobre el vigente.
- **Sin el parámetro → 500** con el nombre de la clave en el mensaje, no un número inventado.

**9 candados estáticos**: que ningún consumidor declare o pase un porcentaje literal (con contraprueba de que el candado detecta la forma vieja), que los dos lean del mismo parámetro, que el seed use `update: {}` y no `update: { valor }`, y que el redondeo del desglose sea el mismo `round` del cobro.

`tsc` limpio · `lint` 0 errores · suite unitaria completa en verde.

> **Verde en CI ≠ funciona.** Cierra cuando en producción el parámetro diga 10 y un padre pague tarifa + 10 %.

---

## Lo que hay que saber antes de desplegar

**En producción el parámetro no existe todavía**, así que la primera corrida del seed lo crea en 10 — y a partir de ese momento **el padre paga 10 % en vez de 15 %**. Es el número correcto según el brief, pero es un cambio de precio: `deploy-prod.sh` corre el seed, así que ocurre en el mismo despliegue.

Las solicitudes ya creadas **no se tocan**: conservan el 15 % con el que se cobraron.
