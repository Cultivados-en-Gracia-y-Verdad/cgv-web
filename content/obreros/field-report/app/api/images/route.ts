import {env} from 'cloudflare:workers';
import {isAdmin,participantAccess,noAccess} from '../../access';
export async function POST(req:Request){
 const admin=await isAdmin(req);const participant=admin?null:await participantAccess(req);if(!admin&&!participant)return noAccess();
 return uploadAuthorized(req,participant);
}
export async function uploadAuthorized(req:Request,participant:string|null=null){
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:"El origen de la solicitud no coincide."},{status:403});
 try{
  if(Number(req.headers.get('content-length')||0)>13*1024*1024)return Response.json({error:"Elige una imagen de menos de 12 MB."},{status:413});
  const form=await req.formData();const personId=String(form.get('personId')||'');if(!personId||participant&&personId!==participant)return noAccess();
  const f=form.get('file');if(!(f instanceof File)||!f.size||f.size>12*1024*1024)return Response.json({error:'Elige una imagen de menos de 12 MB.'},{status:400});
  const bytes=new Uint8Array(await f.arrayBuffer());let type='';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)type='image/jpeg';
  if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)type='image/png';
  if(String.fromCharCode(...bytes.slice(0,6)).match(/^GIF8[79]a$/))type='image/gif';
  if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')type='image/webp';
  if(!type)return Response.json({error:"Elige una imagen JPEG, PNG, WebP o GIF."},{status:400});
  const id=crypto.randomUUID();await env.BUCKET!.put(id,bytes,{httpMetadata:{contentType:type},customMetadata:{filename:f.name,personId}});
  return Response.json({id,filename:f.name});
 }catch(e){console.error('Photo upload failed',e);return Response.json({error:"No se pudo subir la imagen. Inténtalo de nuevo."},{status:500});}
}

