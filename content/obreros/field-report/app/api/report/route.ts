import {env} from 'cloudflare:workers';
import {initialData,normalizeData} from '../../model';
import {isAdmin,noAccess} from '../../access';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 if(!await isAdmin(req))return noAccess();
 return readAuthorized();
}
export async function readAuthorized(){
 try{const row=await env.DB!.prepare('SELECT payload, version, updated_at FROM reports WHERE id = ?').bind('main').first<{payload:string;version:number;updated_at:string}>();return json(row?{data:normalizeData(JSON.parse(row.payload)),version:row.version,updatedAt:row.updated_at}:{data:initialData(),version:0,updatedAt:null});}
 catch(e){console.error('Report read failed',e);return json({error:"No se pudo cargar la información. Inténtalo de nuevo."},500);}
}
export async function PUT(req:Request){
 if(!await isAdmin(req))return noAccess();
 return writeAuthorized(req);
}
export async function writeAuthorized(req:Request){
 try{
  if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:"El origen de la solicitud no coincide."},403);
  if(!req.headers.get('content-type')?.includes('application/json'))return json({error:"Se requieren datos en formato JSON."},415);
  const raw=await req.text();if(raw.length>3000000)return json({error:"El informe es demasiado extenso."},413);
  const {data,version}=JSON.parse(raw);
  if(!valid(data)||!Number.isInteger(version)||version<0)return json({error:"Revisa la información e inténtalo de nuevo."},400);
  const prior=await env.DB!.prepare('SELECT payload,version FROM reports WHERE id = ?').bind('main').first<{payload:string;version:number}>();
  if((prior?.version||0)!==version)return json({error:'La información cambió en otra ventana. Recarga la página antes de guardar.'},409);
  const old=prior?JSON.parse(prior.payload):initialData();data.personVersions={...(old.personVersions||{})};
  const personal=(d:any,id:string)=>JSON.stringify([d.people.find((p:any)=>p.id===id),d.annual.filter((a:any)=>a.personId===id),d.photos.filter((p:any)=>p.personId===id)]);
  for(const p of data.people)if(personal(old,p.id)!==personal(data,p.id))data.personVersions[p.id]=(data.personVersions[p.id]||0)+1;
  const updatedAt=new Date().toISOString();const payload=JSON.stringify(data);let changed;
  if(version===0){const result=await env.DB!.prepare('INSERT INTO reports (id,payload,version,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind('main',payload,updatedAt).run();changed=result.meta.changes;}
  else{const result=await env.DB!.prepare('UPDATE reports SET payload = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?').bind(payload,version+1,updatedAt,'main',version).run();changed=result.meta.changes;}
  if(!changed)return json({error:"El informe cambió en otra ventana. Recarga antes de guardar. Tu texto sigue en este formulario."},409);
  return json({version:version+1,updatedAt});
 }catch(e){console.error('Report save failed',e);return json({error:"No se guardaron los cambios. Inténtalo de nuevo."},500);}
}
function valid(d:any){
 const str=(v:any,n=30000)=>typeof v==='string'&&v.length<=n;
 if(!d||!str(d.title,160)||!str(d.startYear,4)||(d.startYear&&!/^(19|20|21)\d{2}$/.test(d.startYear))||!Array.isArray(d.people)||d.people.length>300||!Array.isArray(d.annual)||d.annual.length>1500||!Array.isArray(d.photos)||d.photos.length>3000)return false;
 const ids=new Set<string>();
 for(const p of d.people){if(!p||!str(p.id,100)||!p.id||ids.has(p.id))return false;ids.add(p.id);for(const k of ['name','role','location','city','country','bio','summary','prayerRequests','graduationYear','informationStatus','photoStatus','reportStatus','nextAction','source','photoFolder'])if(!str(p[k]))return false;if(p.graduationYear&&!/^(19|20|21)\d{2}$/.test(p.graduationYear))return false;for(const k of ['commendingChurch','commendingChurchUrl','heroPhotoId','fundingLabel','fundingUrl','fundingImageId'])if(p[k]!==undefined&&!str(p[k]))return false;if(p.fundingUrl&&!/^https?:\/\//i.test(p.fundingUrl)||p.commendingChurchUrl&&!/^https?:\/\//i.test(p.commendingChurchUrl))return false;}
 const annualIds=new Set();for(const a of d.annual){const key=a.personId+':'+a.year;if(!ids.has(a.personId)||!Number.isInteger(a.year)||a.year<1||a.year>60||annualIds.has(key))return false;annualIds.add(key);for(const k of ['activities','results','measure','value','units','story','challenges','lessons','source','status'])if(!str(a[k]))return false;}
 const photoIds=new Set();for(const p of d.photos){if(!p||!str(p.id,100)||!p.id||photoIds.has(p.id)||!ids.has(p.personId)||!Number.isInteger(p.year)||p.year<1||p.year>60)return false;photoIds.add(p.id);for(const k of ['imageId','externalUrl','filename','caption','date','location','credit','permission'])if(!str(p[k]))return false;if(p.imageId&&!/^[a-f0-9-]{36}$/.test(p.imageId))return false;if(p.externalUrl&&!/^https?:\/\//i.test(p.externalUrl))return false;}
 for(const p of d.people)if(p.heroPhotoId){const hero=d.photos.find((photo:any)=>photo.id===p.heroPhotoId);if(!hero||hero.personId!==p.id||hero.permission!=='Confirmado')return false;}
 if(d.publishedProfiles!==undefined){if(!d.publishedProfiles||typeof d.publishedProfiles!=='object'||Array.isArray(d.publishedProfiles))return false;for(const [id,p] of Object.entries(d.publishedProfiles) as [string,any][]){if(!ids.has(id)||p.id!==id||!Array.isArray(p.photos)||p.photos.length>300||p.verified!==undefined&&typeof p.verified!=='boolean')return false;for(const k of ['name','role','location','bio','summary','prayerRequests','fundingLabel','fundingUrl','fundingImageId','publishedAt'])if(!str(p[k]))return false;for(const k of ['commendingChurch','commendingChurchUrl','heroPhotoId'])if(p[k]!==undefined&&!str(p[k]))return false;if(!p.name.trim()||p.fundingUrl&&!/^https?:\/\//i.test(p.fundingUrl)||p.commendingChurchUrl&&!/^https?:\/\//i.test(p.commendingChurchUrl))return false;const publishedPhotoIds=new Set();for(const photo of p.photos){if(!photo||!str(photo.id,100)||!photo.id||publishedPhotoIds.has(photo.id)||photo.personId!==id||!Number.isInteger(photo.year)||photo.year<1||photo.year>60||photo.permission!=='Confirmado')return false;publishedPhotoIds.add(photo.id);for(const k of ['imageId','externalUrl','filename','caption','date','location','credit','permission'])if(!str(photo[k]))return false;if(photo.imageId&&!/^[a-f0-9-]{36}$/.test(photo.imageId)||photo.externalUrl&&!/^https?:\/\//i.test(photo.externalUrl))return false;}if(p.heroPhotoId&&!p.photos.some((photo:any)=>photo.id===p.heroPhotoId))return false;}}
 return true;
}

