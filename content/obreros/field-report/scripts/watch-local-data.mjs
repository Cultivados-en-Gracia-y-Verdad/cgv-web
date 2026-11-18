import {exportSnapshot,getReport} from './local-data-lib.mjs';

let lastVersion=-1,connected=false,running=true;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
process.on('SIGINT',()=>{running=false;});process.on('SIGTERM',()=>{running=false;});
while(running){try{const report=await getReport();if(!connected){console.log('Sincronización CSV local activa.');connected=true;}if(report.version!==lastVersion){const {manifest}=await exportSnapshot();lastVersion=report.version;console.log(`CSV privados actualizados · versión ${lastVersion} · ${manifest.exportedAt}`);}}catch(error){if(connected)console.error('Se pausó la actualización CSV:',error.message);connected=false;}await delay(2000);}
