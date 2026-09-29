# Tasks · SPEC-772 · habeas data registrado y venceable

> **PARÁ en §4:** implementación espera aprobación del CEO (D-1..D-4). La puerta de entrada es
> SPEC-752 (Dev-3), no se construye acá. Prioridad: el `ci.yml` de SPEC-774 preempta cuando entre #752.

## §4 · Diseño (compuerta)
- [x] **T0** · `spec.md` + `plan.md`: espejo de la Apelación (SPEC-110); los 4 casos de «corregir» medidos (perfil/hijos/identificadores reusables; relato de cita = hueco; reporte = inmutable → 3ª tensión); supresión field-level bloqueada por DEK compartida + evidencia (matriz); fuente única `estadoEfectivoSolicitud` con `RESUELTA_TARDE`; 3 tensiones [ABOGADO]; D-1..D-4. **PARÁ.**

## Tras aprobación §4 (DIRECTO)
- [ ] **T1** · Radicar a **Datos** el modelo `SolicitudHabeasData` (`tipo`, `estado`, `creadoEn`, **`venceEn` NOT NULL**, `resueltaEn?`) **CON EL EJE DE SUJETO (D-5, va AHORA o es cambio de esquema):** `peticionarioUsuarioId` (FK `Usuario`, **NULLABLE + comentario en el schema del PORQUÉ** = caso 3 sin cuenta, para que nadie lo vuelva `NOT NULL`), `calidad` (`TITULAR_CUENTA`|`REPRESENTANTE_LEGAL`|`TITULAR_MAYORIA_EDAD`), `sujetoDelDato` — el modelo **admite** `peticionario ≠ dueño de la cuenta` (caso 3 no imposible, aunque no se construya). **CHECK estructural (A-9):** combinaciones inválidas inconstruibles (`REPRESENTANTE_LEGAL` sin sujeto; `TITULAR_CUENTA` con peticionario ≠ dueño). Migración aditiva (D-121, carril de datos).
- [ ] **T2** · `src/lib/habeas-data/estado-efectivo.ts` (`estadoEfectivoSolicitud` + `esIncumplimiento` fuente única, `RESUELTA_TARDE`/`VENCIDA_SIN_RESOLVER`, `now` inyectable) + candado unit (control positivo por mutación, ancla finde+festivo). **D-4:** el resumen y el detalle leen `esIncumplimiento` IGUAL, en el mismo PR (A-7).
- [ ] **T3** · `src/lib/habeas-data.ts` (service espejo de `apelaciones.ts`): crear solicitud, `venceEn = sumarDiasHabilesColombia(creadoEn, 10|15)` según tipo. **D-3 TECHO:** máximo legal 10/15 = constante [NORMA]; valor operativo parametrizable pero **estructuralmente ≤ constante** (config > máximo NO se puede guardar — A-6, no un comentario).
- [ ] **T4** · API del mecanismo de atrás (`src/app/api/padre/…`): crear/consultar solicitud. **NO** una segunda puerta (la puerta es 752). Compuerta de supresión en el servidor + identidad verificada + candado. **D-1:** el copy de una negativa se funda en el DEBER LEGAL, no en el esquema/cifrado (A-8).
- [ ] **T5** · Rectificar: reusar `PATCH perfil` / `PATCH hijos/[id]` / `hijos/identificadores/[id]`. **Relato de cita: motivo de petición ACEPTADO y cumplible — el mecanismo lo trae SPEC-780 (CEO), 772 NO lo construye** (D-2 resuelta). Reporte: no se toca (3ª tensión, [ABOGADO]).
- [ ] **T6** · Copy de privacidad §6 (Diseño) — el mecanismo real, no «escribir al administrador».
- [ ] **T7** · Gate: `tsc`+`lint`+`test:unit`+candados+`build`. PR + REALIZADO. Tensiones [ABOGADO] quedan marcadas, no resueltas.
