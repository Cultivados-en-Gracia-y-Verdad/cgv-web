import {spawn} from 'node:child_process';

const children=[spawn(process.execPath,['scripts/run-framework.mjs','dev'],{stdio:'inherit'}),spawn(process.execPath,['scripts/watch-local-data.mjs'],{stdio:'inherit'})];let stopping=false;
function stop(signal='SIGTERM'){if(stopping)return;stopping=true;for(const child of children)if(!child.killed)child.kill(signal);}
process.on('SIGINT',()=>stop('SIGINT'));process.on('SIGTERM',()=>stop('SIGTERM'));
for(const child of children)child.on('exit',code=>{if(!stopping){if(code)process.exitCode=code;stop();}});
await Promise.all(children.map(child=>new Promise(resolve=>child.on('exit',resolve))));
