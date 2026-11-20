import {app,BrowserWindow,dialog,ipcMain,shell} from 'electron';
import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const localOrigin='http://127.0.0.1:5173';
let localServer=null;
let syncTask=null;
let pushTask=null;
let prepareTask=null;
let deployTask=null;
let mainWindow=null;

function parseValue(text,name){
 const match=text.match(new RegExp('^'+name+'\\s*=\\s*(.+)$','m'));
 if(!match)return '';
 try{return JSON.parse(match[1].trim());}catch{return match[1].trim().replace(/^['"]|['"]$/g,'');}
}

async function adminToken(){
 const vars=await fs.readFile(path.join(appRoot,'.dev.vars'),'utf8');
 const secret=parseValue(vars,'REPORT_SECRET');
 if(!secret)throw new Error('Falta la configuración local. Ejecuta node scripts/local-setup.mjs.');
 return createHmac('sha256',secret).update('admin').digest('base64url');
}

async function serverAvailable(){
 try{const response=await fetch(localOrigin,{redirect:'manual',signal:AbortSignal.timeout(1000)});return response.status>0;}catch{return false;}
}

async function waitForServer(){
 for(let attempt=0;attempt<120;attempt++){
  if(await serverAvailable())return;
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 throw new Error('La aplicación local no pudo iniciarse en el puerto 5173.');
}

async function startServer(){
 if(await serverAvailable())return;
 localServer=spawn(process.execPath,[path.join(appRoot,'scripts/local-dev.mjs')],{
  cwd:appRoot,
  env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},
  stdio:['ignore','pipe','pipe'],
 });
 localServer.stdout.on('data',data=>process.stdout.write(data));
 localServer.stderr.on('data',data=>process.stderr.write(data));
 localServer.once('exit',code=>{if(code&&!app.isQuitting)dialog.showErrorBox('Mensajeros CGV','El servidor administrativo local se detuvo inesperadamente.');});
 await waitForServer();
}

function runNodeScript(script,args=[]){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(appRoot,script),...args],{
   cwd:appRoot,
   env:{...process.env,ELECTRON_RUN_AS_NODE:'1',LOCAL_ADMIN_ORIGIN:localOrigin},
   stdio:['ignore','pipe','pipe'],
  });
  let output='',error='';
  child.stdout.on('data',data=>{output+=data;});
  child.stderr.on('data',data=>{error+=data;});
  child.once('error',reject);
  child.once('exit',code=>code===0?resolve(output.trim()):reject(new Error((error||output||'No se pudo completar la sincronización.').trim())));
 });
}

function runSystemNode(script,args=[]){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.env.npm_node_execpath||'node',[path.join(appRoot,script),...args],{
   cwd:appRoot,
   env:{...process.env,LOCAL_ADMIN_ORIGIN:localOrigin},
   stdio:['ignore','pipe','pipe'],
  });
  let output='',error='';
  child.stdout.on('data',data=>{output+=data;});
  child.stderr.on('data',data=>{error+=data;});
  child.once('error',reject);
  child.once('exit',code=>code===0?resolve(output.trim()):reject(new Error((error||output||'No se pudo ejecutar Wrangler.').trim())));
 });
}

async function syncPull(){
 if(syncTask)return syncTask;
 syncTask=runNodeScript('scripts/sync-pull.mjs')
  .then(message=>({ok:true,message:message||'Las respuestas están actualizadas.'}))
  .catch(error=>({ok:false,message:error instanceof Error?error.message:'No se pudieron traer las respuestas.'}))
  .finally(()=>{syncTask=null;});
 return syncTask;
}

async function syncPush(){
 if(pushTask)return pushTask;
 pushTask=(async()=>{
  try{return await runNodeScript('scripts/sync-push.mjs',['--confirm']);}
  catch(error){
   const message=error instanceof Error?error.message:String(error);
   if(!/respuestas remotas nuevas|nuevas respuestas/i.test(message))throw error;
   await runNodeScript('scripts/sync-pull.mjs');
   return await runNodeScript('scripts/sync-push.mjs',['--confirm']);
  }
 })()
  .then(message=>({ok:true,message:message||'Los formularios privados están actualizados.'}))
  .catch(error=>({ok:false,message:error instanceof Error?error.message:'No se pudieron actualizar los formularios privados.'}))
  .finally(()=>{pushTask=null;});
 return pushTask;
}

async function prepareSite(){
 if(prepareTask)return prepareTask;
 prepareTask=(async()=>{
  await runNodeScript('scripts/export-local-data.mjs');
  const message=await runNodeScript('scripts/generate-public-site.mjs');
  return {ok:true,message:message||'Archivos públicos preparados.'};
 })().catch(error=>({ok:false,message:error instanceof Error?error.message:'No se pudieron preparar los archivos públicos.'})).finally(()=>{prepareTask=null;});
 return prepareTask;
}

async function deployForms(){
 if(deployTask)return deployTask;
 deployTask=(async()=>{
  // Use Wrangler's supported Node launcher. Invoking the bundled cli.js
  // directly makes Wrangler interpret its own file path as a CLI argument.
  const wrangler='node_modules/wrangler/bin/wrangler.js';
  await runSystemNode(wrangler,['whoami']);
  await runNodeScript('tests/core.mjs');
  await runNodeScript('node_modules/typescript/bin/tsc',['--noEmit']);
  await runNodeScript('scripts/run-framework.mjs',['build']);
  await runSystemNode(wrangler,['deploy','--dry-run','--config','wrangler.form-service.jsonc']);
  const message=await runSystemNode(wrangler,['deploy','--config','wrangler.form-service.jsonc']);
  return {ok:true,message:message||'El servicio de formularios fue actualizado.'};
 })().catch(error=>({ok:false,message:error instanceof Error?error.message:'No se pudo actualizar el servicio de formularios.'})).finally(()=>{deployTask=null;});
 return deployTask;
}

async function createWindow(){
 await startServer();
 const token=await adminToken();
 const window=new BrowserWindow({
  width:1440,
  height:940,
  minWidth:900,
  minHeight:650,
  title:'Mensajeros CGV — Administración',
  backgroundColor:'#f7f8f2',
  webPreferences:{
   preload:path.join(appRoot,'desktop/preload.cjs'),
   contextIsolation:true,
   nodeIntegration:false,
   sandbox:true,
  },
 });
 mainWindow=window;
 window.on('closed',()=>{mainWindow=null;});
 window.center();
 window.show();
 window.webContents.setWindowOpenHandler(({url})=>{if(/^https?:\/\//.test(url))void shell.openExternal(url);return {action:'deny'};});
 window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(localOrigin)){event.preventDefault();if(/^https?:\/\//.test(url))void shell.openExternal(url);}});
 await window.loadURL(`${localOrigin}/administrar/${token}`);
 window.focus();
}

ipcMain.handle('cgv:sync-pull',syncPull);
ipcMain.handle('cgv:sync-push',syncPush);
ipcMain.handle('cgv:prepare-site',prepareSite);
ipcMain.handle('cgv:deploy-forms',deployForms);
app.on('before-quit',()=>{app.isQuitting=true;if(localServer&&!localServer.killed)localServer.kill('SIGTERM');});
app.whenReady().then(createWindow).catch(error=>{dialog.showErrorBox('No se pudo abrir Mensajeros CGV',error instanceof Error?error.message:String(error));app.quit();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)void createWindow();});
