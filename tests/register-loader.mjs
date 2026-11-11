// Registra el cargador de alias antes de que node:test importe los archivos.
import { register } from 'node:module';
register('./alias-loader.mjs', import.meta.url);
