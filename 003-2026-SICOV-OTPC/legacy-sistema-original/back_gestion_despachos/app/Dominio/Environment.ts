export interface Environment{
    obtener<T extends (string | number)>(llave: string): T 
}