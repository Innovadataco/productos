# Plan · SPEC-403 — La comisión de la red es un parámetro

## De dónde sale

I-288 y el brief A-75 §4: el número correcto es 10 % y lo cambia Jelkin sin desplegar. Estaba quemado en 15 dentro de `api/padre/citas/route.ts`.

## Por qué se construyó sobre SPEC-425

`lib/profesional/cita/comision.ts` nació en SPEC-425, que además ya cambió `api/padre/citas` para importarlo. Ramar desde `main` mientras 425 estaba abierto obligaba a crear el módulo otra vez y a tocar la misma ruta: conflicto asegurado en los dos archivos. Se trabajó encima de esa rama y, con #330 ya en `main`, este PR va rebasado contra `main` con solo su propio commit.

**Lección del apilado** (para la próxima, no es culpa de nadie): al mergear #330 con `deleteBranchOnMerge=true`, GitHub **no reapuntó** el PR apilado a `main` — lo **cerró**. Si vuelve a hacer falta apilar, el PR de arriba se reapunta a `main` a mano ANTES de mergear el de abajo.

## Decisiones

| Decisión | Por qué |
|---|---|
| `update: {}` en el seed | Un despliegue no puede deshacer el ajuste del admin. Es plata. |
| Falla en cerrado si falta | Cobrar un número inventado es peor que no dejar crear la solicitud. Precedente: `verificacion.requisitos`, SPEC-418. |
| Valida 0-100 y entero | Un valor corrupto en el parámetro cobraría cualquier cosa. |
| La solicitud conserva su porcentaje | Cambiar el parámetro no puede reescribir lo ya cobrado. |

## Riesgos

| Riesgo | Cómo se acota |
|---|---|
| Que alguien vuelva a quemar el número | Candado estático sobre los tres archivos, con contraprueba. |
| Que el seed pise el valor del admin | Candado que exige `update: {}` + prueba real: se puso 12, se re-sembró, siguió en 12. |
| Cambio de precio al desplegar | Anotado en la spec: el seed lo crea en 10 y el padre pasa a pagar 10 %. |
