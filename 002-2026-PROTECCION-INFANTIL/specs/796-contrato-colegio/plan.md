# Plan · SPEC-796 · Contrato firmado del colegio

## Dependencia
Sobre el modelo `ContratoColegio` de Datos (PR #786, D-121). #786 entra a `main` ANTES de este PR;
luego se rebasa 796 sobre `main`.

## Capas
1. **Storage** `contrato-colegio-storage.ts`: cifrado AES, id opaco, PDF-only, `eliminarContrato` (solo purga demo). (Entregado como WIP mientras llegaba el modelo.)
2. **DAL** `contrato-colegio.ts`: `crear` · `vigentePorColegio` · `porId`.
3. **Servicio** `contrato-colegio.service.ts`: `adjuntarContratoColegio` (snapshots + storage + registro) · `contratoColegioVista` (DTO solo `adjuntadoEn`) · `leerContratoColegioVigente`. Q-3: usa el DAL, no el singleton.
4. **Endpoints**: POST subida admin (`/api/admin/pagos/cliente/[id]/contrato`) · GET descarga admin (`/pdf`) · GET descarga colegio por sesión (`/api/colegio/contrato/pdf`).
5. **UI**: componente admin `AdjuntarContratoColegio` (3 momentos de la forma) en la ficha cliente; recableo de `ContratoCard` + `suscripcion-vista.service/types` de `contratoPDFUrl` (deprecado) al registro nuevo con copy de la forma; SIN-contrato intacto.

## Candados
- `contrato-colegio-storage.test.ts` (unit).
- `contrato-colegio.service.candado.test.ts` (integración): no-fuga con dato real (RED-first), aislamiento por colegio, dueño lee / otro null, append-only.
- `contrato-colegio-forma.candado.test.ts`: sin palabras de validez, SIN-contrato intacto, enlace guardado.

## Gates
tsc · eslint · 3 candados (RED-first en el crítico) · arch:check (regenerar artefactos si drift por rutas/stack, último paso) · `test:unit` completo (specs-discipline). Migración de Datos aplicada a la BD de test para la integración.

## Fuera de alcance
Consumidor de retención (el plazo es `[ABOGADO]`; adjuntar/ver/registrar no lo necesitan) · DROP de `contratoPDFUrl` (lo mide el CEO, PR aparte) · texto del contrato · firma electrónica · pasarela de pago.
