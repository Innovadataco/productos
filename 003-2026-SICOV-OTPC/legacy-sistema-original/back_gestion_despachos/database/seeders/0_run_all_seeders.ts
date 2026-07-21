import BaseSeeder from "@ioc:Adonis/Lucid/Seeder";
import RolesSeeder from "./1.Rol";
import ModulosSeeder from "./2.Modulo";
import FuncionalidadesSeeder from "./3.Funcionalidad";
import RolesModulosSeeder from "./4.RolesModulos";
import UsuariosSeeder from "./5.Usuario";
import TipoMantenimientoSeeder from "./6.TipoMantenimiento";
import ActividadesAlistamientoSeeder from "./7.Actividades";

export default class extends BaseSeeder {
  public async run() {

    await new RolesSeeder(this.client).run();
    await new ModulosSeeder(this.client).run();
    await new FuncionalidadesSeeder(this.client).run();
    await new RolesModulosSeeder(this.client).run();
    await new UsuariosSeeder(this.client).run();
    await new TipoMantenimientoSeeder(this.client).run();
    await new ActividadesAlistamientoSeeder(this.client).run();

  }
}

// node ace migration:fresh
// node ace db:seed --files "./database/seeders/0_run_all_seeders.ts"

