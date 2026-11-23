import {env} from 'cloudflare:workers';
import {normalizeData,publicStatusComplete,safeUrl} from '../../model';
import PublicProfileView from '../../public-profile-view';

export const dynamic='force-dynamic';

export default async function PublicProfile({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const row=await env.DB!.prepare('SELECT payload FROM reports WHERE id = ?').bind('main').first<{payload:string}>();const data=row?normalizeData(JSON.parse(row.payload)):null;const profile=data?.publishedProfiles?.[id],person=data?.people.find(person=>person.id===id);
 if(!profile?.verified||!person||!publicStatusComplete(person))return <main className="public-profile unavailable"><img className="unavailable-logo" src="/cgv-logo-small.jpg" alt="CGV"/><p className="eyebrow">MENSAJEROS CGV</p><h1>Este perfil todavía no está publicado.</h1><p>CGV está revisando la información. Vuelve a intentarlo más adelante.</p></main>;
 const publicImage=(imageId:string)=>'/api/public-images/'+encodeURIComponent(imageId);const src=(photo:{imageId:string;externalUrl:string})=>photo.imageId?publicImage(photo.imageId):safeUrl(photo.externalUrl);const view={...profile,fundingImageSrc:profile.fundingImageId?publicImage(profile.fundingImageId):'',photos:profile.photos.map(photo=>({id:photo.id,src:src(photo),caption:photo.caption,location:photo.location}))};
 return <div className="public-profile-page"><header className="public-profile-header"><a href="/" className="participant-brand"><img className="cgv-brand-logo" src="/cgv-logo-small.jpg" alt="CGV"/><span>Mensajeros CGV<small>MINISTERIO Y APOYO</small></span></a><span>Perfil verificado por CGV</span></header><PublicProfileView profile={view}/></div>;
}
