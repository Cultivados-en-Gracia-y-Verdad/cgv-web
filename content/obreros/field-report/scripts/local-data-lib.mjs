import fs from 'node:fs/promises';
import path from 'node:path';
import {createHmac} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const appRoot=fileURLToPath(new URL('../',import.meta.url));
export const websiteRoot=fileURLToPath(new URL('../../../../',import.meta.url));
export const privateDir=path.join(appRoot,'private-data');
export const imagesDir=path.join(privateDir,'images');

export async function localAccess(){
 const raw=await fs.readFile(path.join(appRoot,'.dev.vars'),'utf8');
 const match=raw.match(/^REPORT_SECRET\s*=\s*(.+)$/m);if(!match)throw new Error('Falta REPORT_SECRET en .dev.vars. Ejecuta node scripts/local-setup.mjs.');
 let secret;try{secret=JSON.parse(match[1].trim());}catch{secret=match[1].trim().replace(/^['"]|['"]$/g,'');}
 const token=createHmac('sha256',secret).update('admin').digest('base64url');
 const base=(process.env.LOCAL_ADMIN_ORIGIN||'http://127.0.0.1:5173').replace(/\/$/,'');return {base,headers:{cookie:'informe_admin='+token,origin:base}};
}

export async function getReport(){const access=await localAccess();let response,lastError;for(let attempt=0;attempt<20;attempt++){try{response=await fetch(access.base+'/api/report',{headers:access.headers,signal:AbortSignal.timeout(1500)});if(response.ok)break;if(response.status===401||response.status===403)throw new Error('No se pudo autorizar el administrador local.');}catch(error){lastError=error;}if(attempt<19)await new Promise(resolve=>setTimeout(resolve,250));}if(!response)throw new Error('No se pudo conectar con el administrador local. La aplicación intentó reiniciar el servicio, pero el puerto 5173 no respondió. Cierra y vuelve a abrir Mensajeros CGV.');if(!response.ok)throw lastError||new Error('No se pudo leer el administrador local. Cierra y vuelve a abrir Mensajeros CGV.');return {...await response.json(),access};}
export const csvCell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
export const csv=(headers,rows)=>'\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
export async function writeCsv(name,headers,rows){await fs.writeFile(path.join(privateDir,name),csv(headers,rows),'utf8');}

export function parseCsv(text){
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
 if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}const headers=rows.shift()||[];return rows.filter(r=>r.some(Boolean)).map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??''])));
}
export async function readCsv(name){return parseCsv(await fs.readFile(path.join(privateDir,name),'utf8'));}

const peopleHeaders=['id','nombre','funcion','ubicacion','ciudad','pais','iglesia_encomendadora','url_iglesia','id_foto_principal','presentacion_publica','resumen_publico','anio_graduacion','estado_informacion','estado_fotos','estado_informe','siguiente_paso','fuente_privada','carpeta_fotos','mensaje_apoyo','enlace_donaciones','id_qr','declaracion_doctrinal_aceptada','fecha_aceptacion_doctrinal','version_persona'];
const annualHeaders=['id_persona','anio_desde_graduacion','actividades','resultados','indicador','valor','unidad','historia','dificultades','aprendizajes','fuente','estado_revision'];
const photoHeaders=['id','id_persona','anio_desde_graduacion','id_imagen','enlace_externo','archivo','descripcion','fecha','ubicacion','credito','permiso'];
const profileHeaders=['id','nombre','funcion','ubicacion','ciudad','pais','iglesia_encomendadora','url_iglesia','id_foto_principal','presentacion_publica','resumen_publico','mensaje_apoyo','enlace_donaciones','id_qr','verificado','publicado_en'];

const photoRow=p=>[p.id,p.personId,p.year,p.imageId,p.externalUrl,p.filename,p.caption,p.date,p.location,p.credit,p.permission];
export async function exportSnapshot(){
 const {data,version,updatedAt,access}=await getReport();await fs.mkdir(privateDir,{recursive:true,mode:0o700});await fs.rm(imagesDir,{recursive:true,force:true});await fs.mkdir(imagesDir,{recursive:true,mode:0o700});
 await writeCsv('mensajeros.csv',peopleHeaders,data.people.map(p=>[p.id,p.name,p.role,p.location,p.city||'',p.country||'',p.commendingChurch,p.commendingChurchUrl,p.heroPhotoId||'',p.bio,p.summary,p.graduationYear,p.informationStatus,p.photoStatus,p.reportStatus,p.nextAction,p.source,p.photoFolder,p.fundingLabel||'',p.fundingUrl||'',p.fundingImageId||'',p.doctrinalAccepted?'Sí':'No',p.doctrinalAcceptedAt||'',data.personVersions?.[p.id]||0]));
 await writeCsv('registros-anuales.csv',annualHeaders,data.annual.map(a=>[a.personId,a.year,a.activities,a.results,a.measure,a.value,a.units,a.story,a.challenges,a.lessons,a.source,a.status]));
 await writeCsv('fotos.csv',photoHeaders,data.photos.map(photoRow));
 const profiles=Object.values(data.publishedProfiles||{});await writeCsv('perfiles-publicados.csv',profileHeaders,profiles.map(p=>[p.id,p.name,p.role,p.location,p.city||'',p.country||'',p.commendingChurch,p.commendingChurchUrl,p.heroPhotoId||'',p.bio,p.summary,p.fundingLabel,p.fundingUrl,p.fundingImageId,p.verified===true?'Sí':'No',p.publishedAt]));
 await writeCsv('fotos-publicadas.csv',['id_perfil',...photoHeaders],profiles.flatMap(profile=>profile.photos.map(photo=>[profile.id,...photoRow(photo)])));
 const owners=new Map();for(const p of data.people){if(p.fundingImageId)owners.set(p.fundingImageId,p.id);}for(const photo of data.photos)if(photo.imageId)owners.set(photo.imageId,photo.personId);for(const profile of profiles){if(profile.fundingImageId)owners.set(profile.fundingImageId,profile.id);for(const photo of profile.photos)if(photo.imageId)owners.set(photo.imageId,profile.id);}
 const imageFiles={};for(const [id,personId] of owners){const response=await fetch(access.base+'/api/images/'+encodeURIComponent(id),{headers:access.headers});if(!response.ok)throw new Error('No se pudo respaldar la imagen '+id+'.');const type=response.headers.get('content-type')||'image/jpeg';const ext=type.includes('png')?'png':type.includes('webp')?'webp':type.includes('gif')?'gif':'jpg';const filename=id+'.'+ext;await fs.writeFile(path.join(imagesDir,filename),Buffer.from(await response.arrayBuffer()));imageFiles[id]={filename,contentType:type,personId};}
 const manifest={formatVersion:1,title:data.title,startYear:data.startYear,version,updatedAt,exportedAt:new Date().toISOString(),imageFiles};await fs.writeFile(path.join(privateDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');return {data,manifest};
}

export function rowToPhoto(row){return {id:row.id,personId:row.id_persona,year:Number(row.anio_desde_graduacion),imageId:row.id_imagen,externalUrl:row.enlace_externo,filename:row.archivo,caption:row.descripcion,date:row.fecha,location:row.ubicacion,credit:row.credito,permission:row.permiso};}
export async function readSnapshot(){
 const [manifest,people,annual,photos,profiles,publishedPhotos]=await Promise.all([fs.readFile(path.join(privateDir,'manifest.json'),'utf8').then(JSON.parse),readCsv('mensajeros.csv'),readCsv('registros-anuales.csv'),readCsv('fotos.csv'),readCsv('perfiles-publicados.csv'),readCsv('fotos-publicadas.csv')]);
 const data={title:manifest.title||'Información de Mensajeros',startYear:manifest.startYear||'',people:people.map(p=>({id:p.id,name:p.nombre,role:p.funcion,location:p.ubicacion,city:p.ciudad||'',country:p.pais||'',commendingChurch:p.iglesia_encomendadora||'',commendingChurchUrl:p.url_iglesia||'',heroPhotoId:p.id_foto_principal||'',bio:p.presentacion_publica,summary:p.resumen_publico,graduationYear:p.anio_graduacion,informationStatus:p.estado_informacion,photoStatus:p.estado_fotos,reportStatus:p.estado_informe,nextAction:p.siguiente_paso,source:p.fuente_privada,photoFolder:p.carpeta_fotos,fundingLabel:p.mensaje_apoyo,fundingUrl:p.enlace_donaciones,fundingImageId:p.id_qr,doctrinalAccepted:p.declaracion_doctrinal_aceptada==='Sí',doctrinalAcceptedAt:p.fecha_aceptacion_doctrinal||''})),annual:annual.map(a=>({personId:a.id_persona,year:Number(a.anio_desde_graduacion),activities:a.actividades,results:a.resultados,measure:a.indicador,value:a.valor,units:a.unidad,story:a.historia,challenges:a.dificultades,lessons:a.aprendizajes,source:a.fuente,status:a.estado_revision})),photos:photos.map(rowToPhoto),publishedProfiles:{},personVersions:Object.fromEntries(people.map(p=>[p.id,Number(p.version_persona)||0]))};
 for(const p of profiles)data.publishedProfiles[p.id]={id:p.id,name:p.nombre,role:p.funcion,location:p.ubicacion,city:p.ciudad||'',country:p.pais||'',commendingChurch:p.iglesia_encomendadora||'',commendingChurchUrl:p.url_iglesia||'',heroPhotoId:p.id_foto_principal||'',bio:p.presentacion_publica,summary:p.resumen_publico,fundingLabel:p.mensaje_apoyo,fundingUrl:p.enlace_donaciones,fundingImageId:p.id_qr,photos:publishedPhotos.filter(photo=>photo.id_perfil===p.id).map(rowToPhoto),verified:p.verificado==='Sí',publishedAt:p.publicado_en};return {data,manifest};
}
