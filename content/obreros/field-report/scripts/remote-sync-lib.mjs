import fs from 'node:fs/promises';
import path from 'node:path';
import {appRoot,getReport,privateDir} from './local-data-lib.mjs';

const statePath=path.join(privateDir,'remote-sync.json');
const parseVars=text=>Object.fromEntries(text.split(/\r?\n/).map(line=>line.match(/^([A-Z0-9_]+)\s*=\s*(.+)$/)).filter(Boolean).map(match=>{let value=match[2].trim();try{value=JSON.parse(value);}catch{value=value.replace(/^['"]|['"]$/g,'');}return [match[1],value];}));
export async function remoteConfig(){let vars;try{vars=parseVars(await fs.readFile(path.join(appRoot,'.sync.vars'),'utf8'));}catch{throw new Error('Falta .sync.vars. Añade REMOTE_FORM_ORIGIN y REMOTE_SYNC_SECRET para el servicio de formularios.');}if(!/^https:\/\//.test(vars.REMOTE_FORM_ORIGIN||'')||!vars.REMOTE_SYNC_SECRET)throw new Error('Revisa REMOTE_FORM_ORIGIN y REMOTE_SYNC_SECRET en .sync.vars.');return {base:vars.REMOTE_FORM_ORIGIN.replace(/\/$/,''),headers:{Authorization:'Bearer '+vars.REMOTE_SYNC_SECRET}};}
export async function readState(){try{return JSON.parse(await fs.readFile(statePath,'utf8'));}catch{return {remoteVersion:null,personVersions:{},remoteToLocal:{}};}}
export async function writeState(state){await fs.mkdir(privateDir,{recursive:true,mode:0o700});await fs.writeFile(statePath,JSON.stringify(state,null,2)+'\n',{mode:0o600});}
export async function remoteReport(config){const response=await fetch(config.base+'/api/sync',{headers:config.headers});if(!response.ok)throw new Error(response.status===403?'El servicio rechazó REMOTE_SYNC_SECRET.':'No se pudo leer el servicio remoto de formularios.');return response.json();}
export async function saveReport(base,headers,data,version){const response=await fetch(base+'/api/report',{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({data,version})});const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudieron guardar los datos locales.');return result;}
export async function saveRemote(config,data,version){const response=await fetch(config.base+'/api/sync',{method:'PUT',headers:{...config.headers,'Content-Type':'application/json'},body:JSON.stringify({data,version})});const result=await response.json();if(!response.ok)throw new Error(response.status===409?'Hubo nuevas respuestas. Ejecuta npm run sync:pull antes de volver a enviar.':result.error||'No se pudieron guardar los datos remotos.');return result;}
export async function localImage(access,id){return fetch(access.base+'/api/images/'+encodeURIComponent(id),{headers:access.headers});}
export async function remoteImage(config,id){return fetch(config.base+'/api/sync/images/'+encodeURIComponent(id),{headers:config.headers});}
export async function uploadImage(base,headers,endpoint,personId,filename,type,bytes){
 const chunkSize=512*1024;
 if(bytes.byteLength>2*1024*1024){
  const uploadId=crypto.randomUUID(),total=Math.ceil(bytes.byteLength/chunkSize);let result={};
  for(let index=0;index<total;index++){
   const response=await fetch(base+endpoint+'/import',{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','X-CGV-Upload-Id':uploadId,'X-CGV-Person-Id':personId,'X-CGV-Filename':filename,'X-CGV-File-Type':type,'X-CGV-Part-Index':String(index),'X-CGV-Part-Total':String(total)},body:bytes.slice(index*chunkSize,Math.min(bytes.byteLength,(index+1)*chunkSize))});
   result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`No se pudo sincronizar la imagen ${filename} (${response.status}): ${result.error||'respuesta no reconocida'}`);
  }
  if(!result.id)throw new Error('La transferencia de '+filename+' terminó sin crear la imagen local.');return result.id;
 }
 const form=new FormData();form.set('personId',personId);form.set('file',new File([bytes],filename,{type}));const response=await fetch(base+endpoint,{method:'POST',headers,body:form});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`No se pudo sincronizar la imagen ${filename} (${response.status}): ${result.error||'respuesta no reconocida'}`);return result.id;
}
export const clone=value=>JSON.parse(JSON.stringify(value));
export function replaceImageIds(data,map){const replace=id=>id?(map.get(id)||id):'';for(const person of data.people)person.fundingImageId=replace(person.fundingImageId);for(const photo of data.photos)photo.imageId=replace(photo.imageId);for(const profile of Object.values(data.publishedProfiles||{})){profile.fundingImageId=replace(profile.fundingImageId);for(const photo of profile.photos)photo.imageId=replace(photo.imageId);}return data;}
export function allImages(data){const owners=new Map();for(const person of data.people)if(person.fundingImageId)owners.set(person.fundingImageId,person.id);for(const photo of data.photos)if(photo.imageId)owners.set(photo.imageId,photo.personId);for(const profile of Object.values(data.publishedProfiles||{})){if(profile.fundingImageId)owners.set(profile.fundingImageId,profile.id);for(const photo of profile.photos)if(photo.imageId)owners.set(photo.imageId,profile.id);}return owners;}
export {getReport};
