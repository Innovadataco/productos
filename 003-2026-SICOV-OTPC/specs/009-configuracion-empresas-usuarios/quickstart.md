# Quickstart — 009 Configuración: Empresas y Usuarios en cascada

**Objetivo**: humo end-to-end de la cascada de permisos (rol 1 → empresa rol 2 → operador rol 3),
verificando el guard de submódulo (B1/B2) en vivo. Todo contra BD local, cero Super (Fase 1).

## 0. Reinicio limpio (OBLIGATORIO tras cualquier cambio de esquema — I-16, Regla de Oro 3)

```bash
npm run reiniciar    # = bash scripts/reiniciar.sh
```

Hace, EN ORDEN: mata SOLO el server del puerto 5010 cuyo `cwd` es esta raíz del 003 (nunca por
nombre — AGENTS §6) → `rm -rf .next` → `prisma generate` (imprescindible: Node cachea `.prisma` en
memoria; sin esto un `next dev` vivo sirve el cliente Prisma VIEJO y da 500 en runtime) →
`prisma migrate deploy` → levanta la app → healthcheck `GET /login` espera 200.

## 1. Datos base

```bash
npm run db:seed      # siembra módulo `configuracion` + submódulos POR NOMBRE (nunca id), rol 2 con `usuarios`
```

## 2. Humo automatizado de la cascada

```bash
bash scripts/verificar-cascada.sh
```

Ejercita y verifica (12 checks):

1. **Admin (rol 1)** hace login (`admin` / `Admin123!`) → ve Configuración (`GET /api/configuracion/empresas` 200) y la consola de APIs (013).
2. **Admin crea una empresa** (`POST /api/configuracion/empresas`, token UUID autogenerado, módulos usuarios+mantenimientos) → 201: crea `ProveedorVigilado` + `Usuario` rol 2 (clave temporal) + `UsuarioModulo`.
3. **Empresa (rol 2)** hace login (`vigilado` / `Vigilado123!`) → crea un **operador solo-preventivos** (`POST /api/usuarios`, `permisos:[{moduloId:mantenimientos, submoduloIds:[preventivos]}]`) → 201.
4. **Operador (rol 3)** hace login → `POST /api/mantenimientos/correctivo` → **403** (guard de submódulo); `POST /api/mantenimientos/preventivo` → **NO 403** (tiene el submódulo).

Resultado esperado: `12 OK · 0 FALLOS`.

## 3. Verificación en navegador (ventana privada)

1. `http://localhost:5010/login` → `admin` / `Admin123!` → el menú muestra **Configuración**.
2. Configuración → **Empresas** → *Nueva empresa* (razón social, NIT, correo, módulos con Usuarios + Mantenimientos). Guardar → aparece en la tabla; la credencial sale por correo (stub sin `RESEND_API_KEY`).
3. Logout → login como la **empresa** (rol 2) → **Usuarios** → *Nuevo usuario* rol 3, marcar SOLO el submódulo *Preventivos* de Mantenimientos.
4. Fijar clave conocida del operador (en demo: `npx tsx scripts/_fijar-clave.ts <NIT_operador> Operador123!`).
5. Login como el operador → intentar un correctivo → **403**; un preventivo pasa el guard.

## 4. Correo (D-048)

Sin `RESEND_API_KEY` en `.env` → adaptador **stub** (log `[correo][stub] para=… asunto=…`, nunca la
clave). Con la key → **Resend** por API HTTP. El envío va SIEMPRE **fuera de la transacción** de alta:
un fallo de Resend nunca revierte la empresa/usuario; se ofrece *reenviar credencial*.

## 5. Pruebas

```bash
npm test          # 175/175 (incluye guard de submódulo, B2, G1 anti-Super, G2/G3, UUID token)
npm run typecheck
npm run lint
npm run build
```
