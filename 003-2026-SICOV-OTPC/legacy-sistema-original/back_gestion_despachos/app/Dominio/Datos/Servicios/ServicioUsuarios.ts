/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/quotes */
/* eslint-disable @typescript-eslint/semi */

import { Paginador } from "App/Dominio/Paginador";
import { v4 as uuidv4 } from 'uuid'
import { RepositorioUsuario } from "App/Dominio/Repositorios/RepositorioUsuario";
import { Usuario } from "../Entidades/Usuario";
import { GeneradorContrasena } from "App/Dominio/GenerarContrasena/GenerarContrasena";
import { Encriptador } from "App/Dominio/Encriptacion/Encriptador";
import { EnviadorEmail } from "App/Dominio/Email/EnviadorEmail";
import { PayloadJWT } from "App/Dominio/Dto/PayloadJWT";
import { EmailBienvenida } from "App/Dominio/Email/Emails/EmailBienvenida";
import { Credenciales } from "App/Dominio/Email/Modelos/Credenciales";
import Env from '@ioc:Adonis/Core/Env';
import Application from '@ioc:Adonis/Core/Application';
import * as fs from 'fs';
import { Fichero } from 'App/Dominio/Ficheros/Fichero';

export class ServicioUsuarios {
  constructor(
    private repositorio: RepositorioUsuario,
    private generarContraseña: GeneradorContrasena,
    private encriptador: Encriptador,
    private enviadorEmail: EnviadorEmail
    ) { }

  async obtenerUsuarios(params: any): Promise<{ usuarios: Usuario[], paginacion: Paginador }> {
    return this.repositorio.obtenerUsuarios(params);
  }

  async obtenerUsuarioPorId(id: number): Promise<Usuario> {
    return this.repositorio.obtenerUsuarioPorId(id);
  }

  async obtenerUsuarioPorUsuario(nombreUsuario: string): Promise<Usuario | null> {
    return this.repositorio.obtenerUsuarioPorUsuario(nombreUsuario);
  }

  async guardarUsuario(usuario: Usuario, payload:PayloadJWT): Promise<Usuario> {
    if(payload.idRol !== 2 && payload.idRol !== 1){
      throw new Error("Usted no tiene autorización para crear usuarios");
    }
    const clave = await this.generarContraseña.generar()
    usuario.clave = await this.encriptador.encriptar(clave)
    usuario.claveTemporal = false
    usuario.usuario = usuario.identificacion.toString()
    const user = this.repositorio.guardarUsuario(usuario);
    this.enviadorEmail.enviarTemplate<Credenciales>({
      asunto: `Bienvenido(a) ${usuario.nombre}`,
      destinatarios: usuario.correo,
      adjunto: this.construirLogoAdjunto()
    }, new EmailBienvenida({ clave: clave, nombre: usuario.nombre, usuario: usuario.usuario, logo: Env.get('LOGO') }))

    return user
  }

  async actualizarUsuario(id: number, usuario: Usuario, payload?:PayloadJWT): Promise<Usuario> {
    if(usuario.clave){
      usuario.clave = await this.encriptador.encriptar(usuario.clave)
    }
    return this.repositorio.actualizarUsuario(id, usuario, payload);
  }

  async cambiarEstado(id: number): Promise<Usuario> {
    let usuario = await this.repositorio.obtenerUsuarioPorId(id)
    usuario.estado = !usuario.estado
    return await this.repositorio.actualizarUsuario(id, usuario);
  }

  async guardarUsuarioVigia(usuario: Usuario): Promise<Usuario> {
    usuario.usuario = usuario.identificacion.toString()
    usuario.claveTemporal = false
    const user = this.repositorio.guardarUsuario(usuario);
    return user
  }

  async obtenerVigilados(params: any): Promise<{ usuarios: Usuario[]}> {
    return this.repositorio.obtenerVigilados(params);
  }

    async obtenerTodosVigilados(params: any): Promise<{ usuarios: Usuario[]}> {
    return this.repositorio.obtenerTodosVigilados(params);
  }

  async obtenerUsuariosRol2(): Promise<{ usuarios: Usuario[]}> {
    return this.repositorio.obtenerUsuariosRol2();
  }

    private construirLogoAdjunto(): Fichero | undefined {
    const nombreLogo = Env.get('LOGO', 'logo.png');
    // Ruta preferida uploads/logos/nombreLogo
    const rutaUploads = Application.makePath('uploads', 'logos', nombreLogo);
    const rutaPublic = Application.publicPath('logos', nombreLogo);
    let ruta: string | undefined;
    if (fs.existsSync(rutaUploads)) ruta = rutaUploads; else if (fs.existsSync(rutaPublic)) ruta = rutaPublic; else return undefined;
    const buffer = fs.readFileSync(ruta);
    const stats = fs.statSync(ruta);
    const contentType = nombreLogo.toLowerCase().endsWith('.png') ? 'image/png' : nombreLogo.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/jpeg';
    return {
      contenido: buffer,
      nombre: nombreLogo,
      tamano: stats.size,
      cid: 'logo_bienvenida',
      contentType
    }
  }
  }
