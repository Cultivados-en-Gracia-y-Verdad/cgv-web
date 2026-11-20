import {env} from 'cloudflare:workers';
import {isAdmin,participantAccess,noAccess,sameOrigin} from '../../../access';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const admin=await isAdmin(req);const participant=admin?null:await participantAccess(req);if(!admin&&!participant)return noAccess();
 const {id}=await params;if(!/^[a-f0-9-]{36}$/.test(id))return new Response("No encontrado",{status:404});
 const file=await env.BUCKET!.get(id);if(!file)return new Response("No encontrado",{status:404});
 if(!admin&&file.customMetadata?.personId!==participant)return noAccess();
 return new Response(file.body,{headers:{'Content-Type':file.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(req)||!await isAdmin(req))return noAccess();
 const {id}=await params;if(!/^[a-f0-9-]{36}$/.test(id))return new Response(null,{status:204});
 await env.BUCKET!.delete(id);return new Response(null,{status:204});
}

