import {env} from 'cloudflare:workers';
import {isAdmin,noAccess,sameOrigin} from '../../../access';

const chunkLimit=768*1024;
const fileLimit=50*1024*1024;

async function bytesOf(object:R2ObjectBody){
 if(typeof object.arrayBuffer==='function')return new Uint8Array(await object.arrayBuffer());
 return new Uint8Array(await new Response(object.body).arrayBuffer());
}

export async function POST(req:Request){
 if(!sameOrigin(req)||!await isAdmin(req))return noAccess();
 const uploadId=req.headers.get('x-cgv-upload-id')||'';
 const personId=req.headers.get('x-cgv-person-id')||'';
 const filename=req.headers.get('x-cgv-filename')||'imagen';
 const declaredType=req.headers.get('x-cgv-file-type')||'';
 const index=Number(req.headers.get('x-cgv-part-index'));
 const total=Number(req.headers.get('x-cgv-part-total'));
 if(!/^[a-f0-9-]{36}$/i.test(uploadId)||!/^P\d+$/.test(personId)||!Number.isInteger(index)||!Number.isInteger(total)||index<0||index>=total||total<1||total>80)return Response.json({error:'La transferencia de la imagen no es válida.'},{status:400});
 const chunk=new Uint8Array(await req.arrayBuffer());
 if(!chunk.length||chunk.length>chunkLimit)return Response.json({error:'El fragmento de imagen es demasiado grande.'},{status:413});
 const prefix=`sync-chunks/${uploadId}/`;
 await env.BUCKET!.put(prefix+String(index).padStart(3,'0'),chunk);
 if(index!==total-1)return Response.json({pending:true});
 const parts:Uint8Array[]=[];let size=0;
 for(let part=0;part<total;part++){
  const key=prefix+String(part).padStart(3,'0');const object=await env.BUCKET!.get(key);
  if(!object)return Response.json({error:'Falta un fragmento de la imagen. Intenta sincronizar de nuevo.'},{status:409});
  const bytes=await bytesOf(object);size+=bytes.length;if(size>fileLimit)return Response.json({error:'La imagen heredada supera el límite administrativo de 50 MB.'},{status:413});parts.push(bytes);
 }
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 let type='';if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)type='image/jpeg';if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)type='image/png';if(String.fromCharCode(...bytes.slice(0,6)).match(/^GIF8[79]a$/))type='image/gif';if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')type='image/webp';
 if(!type)return Response.json({error:'La imagen remota no es JPEG, PNG, WebP o GIF.'},{status:400});
 const id=crypto.randomUUID();await env.BUCKET!.put(id,bytes,{httpMetadata:{contentType:type},customMetadata:{filename,personId,importedType:declaredType}});
 await Promise.all(Array.from({length:total},(_,part)=>env.BUCKET!.delete(prefix+String(part).padStart(3,'0'))));
 return Response.json({id,filename});
}
