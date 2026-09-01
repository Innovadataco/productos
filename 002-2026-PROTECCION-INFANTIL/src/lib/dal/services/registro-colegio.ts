/**
 * SPEC-240 (002-PI-143): orquesta de registro público de colegio y activación
 * por invitación admin. Crea Colegio + Tenant + Usuario rector en una unidad de
 * trabajo y emite el evento de notificación correspondiente.
 */
import { randomBytes } from "node:crypto";
import { addHours } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { programar as programarNotificacion } from "@/lib/notificaciones";
import { withUnitOfWork, type DbClient } from "@/lib/dal/unit-of-work";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { ParametroRepository } from "@/lib/dal/repositories/parametro";
import { PaisRepository } from "@/lib/dal/repositories/pais";
import { CiudadRepository } from "@/lib/dal/repositories/ciudad";
import { OnboardingColegioRepository } from "@/lib/dal/repositories/onboarding-colegio";
import { seedMateriasPorDefecto } from "@/lib/colegio/materias-seed";
import { crearCursosPorDefecto } from "@/lib/colegio/cursos-seed";

const TIMEZONE_BOGOTA = "America/Bogota";
const DEFAULT_TOKEN_HOURS = 48;
const PAIS_DEFAULT_CODIGO = "CO";
const CIUDAD_DEFAULT_NOMBRE = "Bogotá";

export type ResultadoRegistroColegio =
    | { ok: true; user: { id: string; email: string; nombre: string | null; rol: string } }
    | { ok: false; tipo: "existente" | "ubicacion_no_configurada" | "nit_existente" };

export type ResultadoPreRegistroColegio =
    | { ok: true; user: { id: string; email: string; nombre: string | null }; token: string; colegioId: string; colegioNombre: string }
    | { ok: false; tipo: "existente" | "ubicacion_no_configurada" | "nit_existente" };

export type ResultadoActivacion =
    | { ok: true; user: { id: string; email: string; nombre: string | null; rol: string } }
    | { ok: false; tipo: "invalido" | "expirado" | "ya_usado" };

function generarTokenOpaco(): string {
    return randomBytes(32).toString("hex");
}

function expiracionDesdeAhora(horas: number): Date {
    // La vigencia del token se mide en tiempo absoluto (UTC) para que el
    // cálculo de expiración sea determinista independientemente del TZ del runner.
    return addHours(new Date(), horas);
}

export class RegistroColegioService {
    private readonly db: DbClient;
    private readonly usuarios: UsuarioRepository;
    private readonly colegios: ColegioRepository;
    private readonly parametros: ParametroRepository;
    private readonly paises: PaisRepository;
    private readonly ciudades: CiudadRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
        this.usuarios = new UsuarioRepository(tx);
        this.colegios = new ColegioRepository(tx);
        this.parametros = new ParametroRepository(tx);
        this.paises = new PaisRepository(tx);
        this.ciudades = new CiudadRepository(tx);
    }

    /**
     * SPEC-240 (US1): registro público de colegio desde `/registro-colegio`.
     * Crea colegio mínimo, tenant y rector con estado REGISTRADO.
     */
    async registrarPublico(
        email: string,
        password: string,
        nombreRector: string,
        nombreColegio: string,
        nit: string
    ): Promise<ResultadoRegistroColegio> {
        const emailLower = email.toLowerCase();
        const existing = await this.usuarios.findByEmail(emailLower);
        if (existing) {
            return { ok: false, tipo: "existente" };
        }

        // SPEC-320 (§2.2-bis): NIT único global.
        if (await this.colegios.buscarPorNit(nit)) {
            return { ok: false, tipo: "nit_existente" };
        }

        const ubicacion = await this.resolverUbicacionDefault();
        if (!ubicacion) {
            return { ok: false, tipo: "ubicacion_no_configurada" };
        }

        const passwordHash = await hashPassword(password);

        return withUnitOfWork(async (tx) => {
            const service = new RegistroColegioService(tx);
            const { colegio, tenant } = await service.crearColegioMinimo({
                nombreColegio,
                nit,
                nombreRector,
                emailRector: emailLower,
                ubicacion,
            });

            const user = await service.usuarios.crearRectorConToken({
                email: emailLower,
                nombre: nombreRector,
                passwordHash,
                colegioId: colegio.id,
                tenantId: tenant.id,
                estadoActivacion: "REGISTRADO",
            });

            return {
                ok: true,
                user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
            };
        });
    }

    /**
     * SPEC-240 (US3): pre-registro de colegio por admin con invitación por email.
     * Crea colegio mínimo, tenant y rector con estado INVITADO + token opaco.
     */
    async preRegistrarPorAdmin(
        nombreColegio: string,
        nombreRector: string,
        emailRector: string,
        adminId: string,
        nit: string
    ): Promise<ResultadoPreRegistroColegio> {
        const emailLower = emailRector.toLowerCase();
        const existing = await this.usuarios.findByEmail(emailLower);
        if (existing) {
            return { ok: false, tipo: "existente" };
        }

        // SPEC-320 (§2.2-bis): NIT único global.
        if (await this.colegios.buscarPorNit(nit)) {
            return { ok: false, tipo: "nit_existente" };
        }

        const ubicacion = await this.resolverUbicacionDefault();
        if (!ubicacion) {
            return { ok: false, tipo: "ubicacion_no_configurada" };
        }

        const token = generarTokenOpaco();
        const vigenciaHoras = await this.tokenVigenciaHoras();
        const expiraEn = expiracionDesdeAhora(vigenciaHoras);
        const passwordHashPlaceholder = await hashPassword(randomBytes(32).toString("hex"));

        const resultado = await withUnitOfWork(async (tx) => {
            const service = new RegistroColegioService(tx);
            const { colegio, tenant } = await service.crearColegioMinimo({
                nombreColegio,
                nit,
                nombreRector,
                emailRector: emailLower,
                ubicacion,
            });

            const user = await service.usuarios.crearRectorConToken({
                email: emailLower,
                nombre: nombreRector,
                passwordHash: passwordHashPlaceholder,
                colegioId: colegio.id,
                tenantId: tenant.id,
                estadoActivacion: "INVITADO",
                tokenInvitacion: token,
                tokenInvitacionExpiraEn: expiraEn,
            });

            return {
                ok: true as const,
                user: { id: user.id, email: user.email, nombre: user.nombre },
                token,
                colegioId: colegio.id,
                colegioNombre: colegio.nombre,
            };
        });

        if (resultado.ok) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pi.innovadataco.com";
            await programarNotificacion({
                evento: "colegio.invitacion.enviada",
                sujetoTipo: "Colegio",
                sujetoId: resultado.colegioId,
                destinatarios: [
                    {
                        usuarioId: resultado.user.id,
                        variables: {
                            nombreRector: resultado.user.nombre ?? "Rector",
                            nombreColegio: resultado.colegioNombre,
                            linkActivacion: `${baseUrl}/activar?token=${resultado.token}`,
                        },
                    },
                ],
            }).catch((err: unknown) => {
                console.warn(
                    "[RegistroColegio] No se pudo programar invitación:",
                    err instanceof Error ? err.message : err
                );
            });
        }

        return resultado;
    }

    /**
     * SPEC-240 (US2): activación de rector invitado desde `/activar?token=XYZ`.
     * Valida token vigente, define contraseña y pasa a REGISTRADO.
     */
    async activarPorToken(token: string, password: string): Promise<ResultadoActivacion> {
        const user = await this.usuarios.findByTokenInvitacion(token);
        if (!user) {
            return { ok: false, tipo: "invalido" };
        }
        if (user.estadoActivacion !== "INVITADO" || !user.tokenInvitacionExpiraEn) {
            return { ok: false, tipo: "ya_usado" };
        }
        const ahoraUtc = new Date();
        if (user.tokenInvitacionExpiraEn < ahoraUtc) {
            return { ok: false, tipo: "expirado" };
        }

        const passwordHash = await hashPassword(password);
        const actualizado = await this.usuarios.consumirTokenInvitacion(token, passwordHash);

        return {
            ok: true,
            user: { id: actualizado.id, email: actualizado.email, nombre: actualizado.nombre, rol: actualizado.rol },
        };
    }

    /**
     * Valida token de invitación para renderizar el formulario de activación.
     * No consume el token.
     */
    async validarTokenInvitacion(token: string): Promise<{ valido: true; email: string } | { valido: false; razon: string }> {
        const user = await this.usuarios.findByTokenInvitacion(token);
        if (!user) {
            return { valido: false, razon: "invalido" };
        }
        if (user.estadoActivacion !== "INVITADO" || !user.tokenInvitacionExpiraEn) {
            return { valido: false, razon: "ya_usado" };
        }
        const ahoraUtc = new Date();
        if (user.tokenInvitacionExpiraEn < ahoraUtc) {
            return { valido: false, razon: "expirado" };
        }
        return { valido: true, email: user.email };
    }

    private async tokenVigenciaHoras(): Promise<number> {
        const param = await this.parametros.findByClave("pagos.invitacion.token_vigencia_horas");
        if (!param) return DEFAULT_TOKEN_HOURS;
        const horas = parseInt(param.valor, 10);
        return Number.isFinite(horas) && horas > 0 ? horas : DEFAULT_TOKEN_HOURS;
    }

    private async resolverUbicacionDefault(): Promise<{ paisId: string; ciudadId: string; departamentoId: string | undefined } | null> {
        const pais = await this.paises.findByCodigo(PAIS_DEFAULT_CODIGO);
        if (!pais) return null;

        const paramCiudad = await this.parametros.findByClave("registro.colegio.ciudad_default_id");
        if (paramCiudad?.valor) {
            const ciudad = await this.ciudades.findById(paramCiudad.valor);
            if (ciudad && ciudad.paisId === pais.id) {
                return {
                    paisId: pais.id,
                    ciudadId: ciudad.id,
                    departamentoId: ciudad.departamentoId ?? undefined,
                };
            }
        }

        const ciudadFallback = await this.ciudades.findByNombreYPais(CIUDAD_DEFAULT_NOMBRE, pais.id);
        if (ciudadFallback) {
            return {
                paisId: pais.id,
                ciudadId: ciudadFallback.id,
                departamentoId: ciudadFallback.departamentoId ?? undefined,
            };
        }

        const primeraCiudad = await this.ciudades.listarActivasPorPais(pais.id, undefined).then((lista) => lista[0]);
        if (primeraCiudad) {
            return {
                paisId: pais.id,
                ciudadId: primeraCiudad.id,
                departamentoId: primeraCiudad.departamentoId ?? undefined,
            };
        }

        return null;
    }

    private async crearColegioMinimo(data: {
        nombreColegio: string;
        nit: string;
        nombreRector: string;
        emailRector: string;
        ubicacion: { paisId: string; ciudadId: string; departamentoId?: string | undefined };
    }) {
        const tenant = await this.colegios.crearTenantParaColegio(data.nombreColegio);
        const inicioServicio = toZonedTime(new Date(), TIMEZONE_BOGOTA);

        const colegio = await this.colegios.crear({
            nombre: data.nombreColegio,
            nit: data.nit, // SPEC-320 (§2.2-bis): NIT único global
            paisId: data.ubicacion.paisId,
            ciudadId: data.ubicacion.ciudadId,
            ...(data.ubicacion.departamentoId ? { departamentoId: data.ubicacion.departamentoId } : {}),
            representanteLegalNombre: data.nombreRector,
            representanteLegalIdentificacion: "PENDIENTE",
            representanteLegalEmail: data.emailRector,
            inicioServicio,
            finServicio: null,
            tipoPeriodo: "MENSUAL",
            estado: "activo",
            tenantId: tenant.id,
        });

        await seedMateriasPorDefecto(this.db, colegio.id);
        // SPEC-344 (D-5): al crear el colegio quedan sembrados los 11 grados
        // del año lectivo vigente. El rector abre el Paso 4 del camino y ya
        // los ve sin haber digitado nada; puede inactivar los que no aplican.
        await crearCursosPorDefecto(colegio.id, String(new Date().getFullYear()), this.db);
        await new OnboardingColegioRepository(this.db).crear({ colegioId: colegio.id });

        return { colegio, tenant };
    }
}
