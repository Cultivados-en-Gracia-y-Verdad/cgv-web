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

function runNodeScript(script){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(appRoot,script)],{
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

async function syncPull(){
 if(syncTask)return syncTask;
 syncTask=runNodeScript('scripts/sync-pull.mjs')
  .then(message=>({ok:true,message:message||'Las respuestas están actualizadas.'}))
  .catch(error=>({ok:false,message:error instanceof Error?error.message:'No se pudieron traer las respuestas.'}))
  .finally(()=>{syncTask=null;});
 return syncTask;
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
 window.webContents.setWindowOpenHandler(({url})=>{if(/^https?:\/\//.test(url))void shell.openExternal(url);return {action:'deny'};});
 window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(localOrigin)){event.preventDefault();if(/^https?:\/\//.test(url))void shell.openExternal(url);}});
 await window.loadURL(`${localOrigin}/administrar/${token}`);
}

ipcMain.handle('cgv:sync-pull',syncPull);
app.on('before-quit',()=>{app.isQuitting=true;if(localServer&&!localServer.killed)localServer.kill('SIGTERM');});
app.whenReady().then(createWindow).catch(error=>{dialog.showErrorBox('No se pudo abrir Mensajeros CGV',error instanceof Error?error.message:String(error));app.quit();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)void createWindow();});
