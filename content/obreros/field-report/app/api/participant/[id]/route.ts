import {env} from 'cloudflare:workers';
import {participantAccess,noAccess,sameOrigin} from '../../../access';
import {initialData,newAnnual,hasAnnual,normalizeData,personYears} from '../../../model';
async function read(){const row=await env.DB!.prepare('SELECT payload,version FROM reports WHERE id = ?').bind('main').first<{payload:string;version:number}>();return row?{data:normalizeData(JSON.parse(row.payload)),version:row.version}:{data:initialData(),version:0};}
async function notifySubmission(id:string,name:string){
 if(!env.EMAIL||!env.NOTIFICATION_EMAIL||!env.NOTIFICATION_FROM)return;
 const safeName=(name.trim()||`Mensajero ${id}`).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]!));
 const subject=`Nuevo formulario enviado: ${(name.trim()||id).replace(/[\r\n]+/g,' ')}`;
 const text=`${name.trim()||`El Mensajero ${id}`} envió su formulario para revisión.\n\nAbre la aplicación administrativa Mensajeros CGV y pulsa “Actualizar respuestas”.`;
 const html=`<p><strong>${safeName}</strong> envió su formulario para revisión.</p><p>Abre la aplicación administrativa Mensajeros CGV y pulsa <strong>Actualizar respuestas</strong>.</p>`;
 await env.EMAIL.send({to:env.NOTIFICATION_EMAIL,from:{email:env.NOTIFICATION_FROM,name:'CGV Mensajeros'},subject,text,html});
}
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;if(await participantAccess(req)!==id)return noAccess();const {data}=await read();const person=data.people.find((p:any)=>p.id===id);if(!person)return noAccess();return Response.json({title:data.title,startYear:data.startYear,person,annual:personYears(person).map(year=>data.annual.find((a:any)=>a.personId===id&&a.year===year)||newAnnual(id,year)),photos:data.photos.filter((p:any)=>p.personId===id),version:data.personVersions?.[id]||0},{headers:{'Cache-Control':'no-store'}});}
export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!sameOrigin(req)||await participantAccess(req)!==id)return noAccess();
 try{
 const raw=await req.text();if(raw.length>1000000)return Response.json({error:'La información es demasiado extensa.'},{status:413});const input=JSON.parse(raw);
 const text=(v:any,n=30000)=>typeof v==='string'&&v.length<=n;
 if(!input.person||!Array.isArray(input.annual)||input.annual.length<1||input.annual.length>60||!Array.isArray(input.photos)||input.photos.length>300||!Number.isInteger(input.version))return Response.json({error:'Revisa la información del formulario.'},{status:400});
 const fields=['name','role','location','bio','summary','graduationYear','fundingLabel','fundingUrl','fundingImageId'];const profile:any={};for(const f of fields){const v=input.person[f]??'';if(!text(v))return Response.json({error:'Revisa los datos personales.'},{status:400});profile[f]=v;}
 profile.doctrinalAccepted=input.person.doctrinalAccepted===true;
 if(profile.graduationYear&&!/^(19|20|21)\d{2}$/.test(profile.graduationYear))return Response.json({error:'Indica un año de graduación válido.'},{status:400});
 if(profile.fundingUrl&&!/^https?:\/\//i.test(profile.fundingUrl))return Response.json({error:'El enlace de donaciones debe comenzar con https://.'},{status:400});
 if(profile.fundingImageId){const obj=await env.BUCKET!.head(profile.fundingImageId);if(!obj||obj.customMetadata?.personId!==id)return noAccess();}
 const expectedYears=personYears(profile);if(input.annual.length!==expectedYears.length)return Response.json({error:'Revisa la información anual desde tu graduación.'},{status:400});
 const annualFields=['activities','results','measure','value','units','story','challenges','lessons','source'];
 const annual=[];const seen=new Set();for(const a of input.annual){if(!expectedYears.includes(a.year)||seen.has(a.year))return Response.json({error:'Revisa los años desde tu graduación.'},{status:400});seen.add(a.year);const next:any={personId:id,year:a.year,status:a.status==="No corresponde"?"No corresponde":"En proceso"};for(const f of annualFields){if(!text(a[f]))return Response.json({error:'Revisa los datos anuales.'},{status:400});next[f]=a[f];}annual.push(next);}
 const photos=[];const photoIds=new Set();for(const p of input.photos){if(!text(p.id,100)||photoIds.has(p.id)||!expectedYears.includes(p.year))return Response.json({error:'Revisa los datos de las fotos.'},{status:400});photoIds.add(p.id);const next:any={id:p.id,personId:id,year:p.year};for(const f of ['imageId','externalUrl','filename','caption','date','location','credit','permission']){if(!text(p[f]))return Response.json({error:'Revisa las fotos.'},{status:400});next[f]=p[f];}if(!["Pendiente","Confirmado","No utilizar"].includes(p.permission)||p.externalUrl&&!/^https?:\/\//i.test(p.externalUrl))return Response.json({error:'Revisa los enlaces y permisos de las fotos.'},{status:400});if(p.imageId){const obj=await env.BUCKET!.head(p.imageId);if(!obj||obj.customMetadata?.personId!==id)return noAccess();}photos.push(next);}
 if(input.submit&&!profile.doctrinalAccepted)return Response.json({error:'Debes leer y aceptar la Declaración de Fe de CGV antes de enviar tu información.'},{status:400});
 if(input.submit&&(!profile.name.trim()||!profile.graduationYear||annual.some(a=>a.status!=="No corresponde"&&!hasAnnual(a))))return Response.json({error:'Añade tu nombre, el año de graduación y completa cada año desde entonces. Si un año no corresponde, indícalo.'},{status:400});
 for(let attempt=0;attempt<5;attempt++){
  const {data,version}=await read();const p=data.people.find((p:any)=>p.id===id);if(!p)return noAccess();
  if((data.personVersions?.[id]||0)!==input.version)return Response.json({error:'Tus datos cambiaron en otra ventana o durante la revisión. Recarga antes de guardar. El texto que estás editando sigue en este formulario.'},{status:409});
  if(photos.some(photo=>data.photos.some((existing:any)=>existing.id===photo.id&&existing.personId!==id)))return noAccess();
  const doctrinalAcceptedAt=profile.doctrinalAccepted?(p.doctrinalAcceptedAt||new Date().toISOString()):'';const savedProfile={...profile,doctrinalAcceptedAt};
  const profileChanged=fields.some(f=>((p as any)[f]??'')!==profile[f])||Boolean(p.doctrinalAccepted)!==profile.doctrinalAccepted||(p.doctrinalAcceptedAt||'')!==doctrinalAcceptedAt;
  const previousPhotos=data.photos.filter((photo:any)=>photo.personId===id);const photosChanged=JSON.stringify(previousPhotos)!==JSON.stringify(photos);
  let annualChanged=false;const savedAnnual=annual.map(a=>{const previous=data.annual.find((item:any)=>item.personId===id&&item.year===a.year)||newAnnual(id,a.year);const changed=(a.status==='No corresponde')!==(previous.status==='No corresponde')||annualFields.some(f=>a[f]!==((previous as any)[f]));annualChanged||=changed;let status=previous.status;if(changed)status=a.status==='No corresponde'?'No corresponde':input.submit?'Enviado para revisión':'En proceso';else if(input.submit&&!['Revisado','No corresponde'].includes(status)&&hasAnnual(a))status='Enviado para revisión';return {...a,status};});
  const participantChanged=profileChanged||photosChanged||annualChanged;
  const previouslySubmitted=p.informationStatus==='Enviado para revisión'||data.annual.some((item:any)=>item.personId===id&&item.status==='Enviado para revisión');
  const informationStatus=profileChanged?(input.submit?'Enviado para revisión':'En proceso'):input.submit&&!['Completo','Revisado'].includes(p.informationStatus)?'Enviado para revisión':p.informationStatus;
  const photoStatus=photosChanged?(photos.length?'En proceso':'Sin empezar'):p.photoStatus;
  const reportStatus=participantChanged&&p.reportStatus==='Completo'?'Requiere seguimiento':p.reportStatus;
  data.people=data.people.map((person:any)=>person.id===id?{...person,...savedProfile,informationStatus,photoStatus,reportStatus}:person);
  data.annual=[...data.annual.filter((a:any)=>a.personId!==id),...savedAnnual];
  data.photos=[...data.photos.filter((p:any)=>p.personId!==id),...photos];data.personVersions={...data.personVersions,[id]:input.version+1};
  const now=new Date().toISOString();const result=version===0?await env.DB!.prepare('INSERT INTO reports (id,payload,version,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind('main',JSON.stringify(data),now).run():await env.DB!.prepare('UPDATE reports SET payload = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?').bind(JSON.stringify(data),version+1,now,'main',version).run();
  if(result.meta.changes){if(input.submit&&(participantChanged||!previouslySubmitted))try{await notifySubmission(id,profile.name);}catch(error){console.error('Submission notification failed',error);}return Response.json({version:input.version+1,informationStatus,photoStatus,reportStatus,doctrinalAcceptedAt,annualStatuses:Object.fromEntries(savedAnnual.map(a=>[a.year,a.status])),savedAt:now},{headers:{'Cache-Control':'no-store'}});}
 }
 return Response.json({error:'Hay varias personas guardando. Inténtalo de nuevo en unos segundos.'},{status:409});
 }catch(e){console.error('Participant save failed',e);return Response.json({error:'No se pudieron guardar tus datos. Inténtalo de nuevo.'},{status:500});}
}

