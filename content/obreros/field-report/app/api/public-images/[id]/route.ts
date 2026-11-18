import {env} from 'cloudflare:workers';
import {normalizeData} from '../../../model';

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[a-f0-9-]{36}$/.test(id))return new Response('No encontrado',{status:404});
 const row=await env.DB!.prepare('SELECT payload FROM reports WHERE id = ?').bind('main').first<{payload:string}>();
 if(!row)return new Response('No encontrado',{status:404});
 const data=normalizeData(JSON.parse(row.payload));
 const allowed=Object.values(data.publishedProfiles||{}).some(profile=>profile.fundingImageId===id||profile.photos.some(photo=>photo.imageId===id));
 if(!allowed)return new Response('No encontrado',{status:404});
 const object=await env.BUCKET!.get(id);if(!object)return new Response('No encontrado',{status:404});
 const headers=new Headers({'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'});
 return new Response(object.body,{headers});
}
