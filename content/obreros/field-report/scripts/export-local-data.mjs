import {exportSnapshot,privateDir} from './local-data-lib.mjs';
const {data,manifest}=await exportSnapshot();
console.log(`CSV privados actualizados en ${privateDir}`);
console.log(`${data.people.length} Mensajeros, ${data.annual.length} registros anuales, ${data.photos.length} fotos y ${Object.keys(data.publishedProfiles||{}).length} perfiles publicados.`);
console.log(`Copia creada: ${manifest.exportedAt}. Esta carpeta está excluida de Git.`);
