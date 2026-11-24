import {allImages,clone,getReport,localImage,mergeRemotePhotos,remoteConfig,remoteImage,remoteReport,readState,replaceImageIds,saveReport,uploadImage,writeState} from './remote-sync-lib.mjs';

const config=await remoteConfig();
const remote=await remoteReport(config);
const local=await getReport();
const state=await readState();
const next=clone(local.data);
const imageMap=new Map(Object.entries(state.remoteToLocal||{}));
const editable=['name','role','location','city','country','commendingChurch','commendingChurchUrl','bio','summary','prayerRequests','graduationYear','fundingLabel','fundingUrl','fundingImageId','doctrinalAccepted','doctrinalAcceptedAt'];
const annualContent=annual=>JSON.stringify(['activities','results','measure','value','units','story','challenges','lessons','source'].map(key=>annual?.[key]||''));
let changedPeople=0;

for(const remotePerson of remote.data.people){
 const remotePersonVersion=remote.data.personVersions?.[remotePerson.id]||0;
 const previousRemoteVersion=state.personVersions?.[remotePerson.id]||0;
 if(state.remoteVersion!==null&&remotePersonVersion<=previousRemoteVersion)continue;
 changedPeople++;
 let localPerson=next.people.find(person=>person.id===remotePerson.id);
 const localChanged=Boolean(localPerson)&&(next.personVersions?.[remotePerson.id]||0)>previousRemoteVersion;
 const localFundingImageId=localPerson?.fundingImageId||'';
 if(!localPerson){next.people.push(clone(remotePerson));localPerson=next.people.at(-1);}
 else{
  for(const field of editable)localPerson[field]=remotePerson[field]??'';
  localPerson.informationStatus=remotePerson.informationStatus;
  localPerson.photoStatus=remotePerson.photoStatus;
  localPerson.reportStatus=remotePerson.reportStatus;
  if(localChanged&&localFundingImageId)localPerson.fundingImageId=localFundingImageId;
 }
 const incomingAnnual=remote.data.annual.filter(item=>item.personId===remotePerson.id).map(item=>{const previous=next.annual.find(saved=>saved.personId===item.personId&&saved.year===item.year);return previous?.status==='Revisado'&&annualContent(previous)===annualContent(item)?{...item,status:'Revisado'}:clone(item);});
 next.annual=[...next.annual.filter(item=>item.personId!==remotePerson.id),...incomingAnnual];
 const localPhotos=next.photos.filter(photo=>photo.personId===remotePerson.id);
 const remotePhotos=remote.data.photos.filter(photo=>photo.personId===remotePerson.id);
 const publishedPhotoIds=(next.publishedProfiles?.[remotePerson.id]?.photos||[]).map(photo=>photo.id);
 const mergedPhotos=mergeRemotePhotos(localPhotos,remotePhotos,{localChanged,heroPhotoId:localPerson.heroPhotoId,publishedPhotoIds});
 next.photos=[...next.photos.filter(photo=>photo.personId!==remotePerson.id),...mergedPhotos];
 if(localPerson.heroPhotoId&&!mergedPhotos.some(photo=>photo.id===localPerson.heroPhotoId&&photo.permission==='Confirmado'))localPerson.heroPhotoId='';
}

for(const [remoteId,personId] of allImages(remote.data)){
 if(imageMap.has(remoteId))continue;
 const exists=await localImage(local.access,remoteId);
 if(exists.ok){imageMap.set(remoteId,remoteId);continue;}
 const download=await remoteImage(config,remoteId);
 if(!download.ok)throw new Error('No se encontró una imagen remota asociada a '+personId+'.');
 const type=download.headers.get('content-type')||'image/jpeg';
 const ext=type.includes('png')?'png':type.includes('webp')?'webp':type.includes('gif')?'gif':'jpg';
 const localId=await uploadImage(local.access.base,local.access.headers,'/api/images',personId,remoteId+'.'+ext,type,await download.arrayBuffer());
 imageMap.set(remoteId,localId);
}

replaceImageIds(next,imageMap);
if(changedPeople)await saveReport(local.access.base,local.access.headers,next,local.version);
await writeState({remoteVersion:remote.version,personVersions:remote.data.personVersions||{},remoteToLocal:Object.fromEntries(imageMap)});
console.log(`${changedPeople} Mensajeros sincronizados desde el formulario remoto. Las imágenes administrativas y los perfiles publicados locales se conservaron.`);
