# SPEC-420 · El borrado por lotes — PostgreSQL admite 32.767 parámetros, producción tenía 37.176

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Dev 02 (`idc-80`) · **Origen**: falla del borrado de SPEC-412 **en producción**, reportada por el CEO 19:1x.

**Impacto en arquitectura:** ninguno. Un helper de lotes en `scripts/demo/_marcado.ts` y su aplicación en `_borrado-marcado.ts`. No cambia el contrato de nada.

---

## Para qué

El borrado de lo sembrado murió en producción con:

```
too many bind variables in prepared statement,
expected maximum of 32767, received 37176
```

`where: { id: { in: [...] } }` gasta **un parámetro por id**, y PostgreSQL admite **32.767 por sentencia preparada**. La limpieza final del marcador junta los ids de las 18 entidades en una sola lista: **37.176**.

**Lo que sí funcionó, y conviene registrar:** el guion es transaccional y falla en cerrado, así que **no se borró nada** y la base quedó idéntica — 9.067 reportes, 56 colegios, 127 usuarios, 37.176 marcas, contados antes y después. La falla fue ruidosa y reversible, que es como tenía que ser.

### La lección, que vale más que el arreglo

> **La corrida de ensayo escribió 30.254 marcas y pasó. Producción tenía 37.176. El techo son 32.767.**
>
> **Una base de prueba más chica que producción no prueba el límite.** No estaba mal probado: estaba probado *a otra escala*, y esa escala caía justo por debajo del techo. Vale para cualquiera que verifique con datos propios — el número de filas es parte de la prueba, no un detalle del entorno.

---

## Qué trae

### 1) `enLotes` · `borrarEnLotes` · `contarEnLotes` (en `_marcado.ts`)

Parten una lista de ids en tandas de **2.000** —margen amplio a propósito, porque la consulta puede llevar otros parámetros además de los ids— y acumulan lo que devuelva cada una, **en orden** (el borrado FK-safe depende de eso).

### 2) Aplicado a **todo** el camino de borrado, no solo a lo que reventó

Se revisaron las 18 entidades y las consultas que las tocan. Quedaron por lotes:

- La limpieza del marcador (la que falló) y el `deleteMany` por entidad.
- Las derivadas: seguimientos, notas, informes, embeddings, fuentes, reintentos, pasos, eventos de match, patrones, avisos, observaciones, bonos, scores y referidos.
- Los `updateMany` que sueltan vínculos antes de borrar (`Usuario`, `Curso`).
- **El reporte previo también.** Un `count` con 9.000 ids gasta 9.000 parámetros igual que un `delete`: el límite no distingue entre leer y escribir, y ese reporte corre **incluso en dry-run**.

### 3) Dos consultas que dejaron de usar listas

- **El conteo de lo real** era `notIn: [...9.000 ids]`. Un `notIn` no se parte en tandas con la misma facilidad, así que pasó a un `LEFT JOIN` contra `demo_marcado`: **cero parámetros** y sin traerse los ids.
- **Los INTOCABLES de `Usuario`** preguntaban por los N ids marcados; ahora preguntan por los **dos correos** protegidos y cruzan en memoria. La lista de correos es fija; la de ids no tenía techo.

### 4) Una convención que el candado hace cumplir

**La única variable que puede aparecer dentro de un `in:` en `_borrado-marcado.ts` es `t`**, el trozo que entrega `enLotes`. Cualquier otra es una lista sin techo. Un test lee el archivo y lo exige — la regla se verifica leyendo, sin entender el flujo.

---

## Verificación

### A escala de producción, que es el punto

Contra una base propia (`pi_420_test`, creada y destruida) se sembraron **40.000 reportes marcados** — por encima del techo de 32.767:

```
[escala] marcas: 40000 · techo de PostgreSQL: 32767 · ¿por encima? true
[escala] plan OK — 40000 marcadas
[escala] borrado OK — reportes: 40000 · marcas limpiadas: 40000
[escala] quedan: 0 reportes, 0 marcas
```

Y la segunda corrida, con lo que quedó de la fallida, borró **80.000** sin despeinarse.

### La prueba negativa reproduce el error de producción, literal

Se revirtió el lote en la limpieza del marcador y la misma corrida devolvió:

```
[escala] FALLÓ: Assertion violation on the database:
  too many bind variables in prepared statement, expected maximum of 32767, received 40000
```

Mismo mensaje, mismo límite. Y otra vez **no se borró nada**: la transacción revirtió y las 40.000 filas siguieron ahí. Restaurado el lote, la corrida completa vuelve a pasar.

### Gate

13 tests nuevos (`scripts/demo/lotes.test.ts`): el tamaño de lote contra el techo real, el reparto sin pérdida, la suma de conteos, el orden de las tandas, el caso vacío sin viajes a la base, y el candado de la convención **con contraprueba**. `tsc` limpio · `lint` 0 errores · suite unitaria completa en verde.

---

## Lo que NO se tocó

- **El marcado retroactivo.** Ya iba por lotes desde SPEC-412 (`marcar()` en tandas de 1.000) y por eso las 37.176 marcas se escribieron sin problema. El estado actual es **«marcado, sin borrar»**, que es exactamente donde hay que estar.
- **`scripts/demo/borrar-demo.ts`** (el borrador v1, por prefijo) tiene la misma clase de riesgo en su `alertaIds`. Está fuera del alcance de esta spec y en vías de retiro; queda anotado por si se corre antes de jubilarlo.
