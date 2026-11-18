import {adminHostAllowed,verify} from '../../access';
export async function GET(req:Request,{params}:{params:Promise<{token:string}>}){
 if(!adminHostAllowed(req))return new Response('No encontrado.',{status:404});
 const {token}=await params;
 if(!await verify('admin',token))return new Response('El enlace de administración no es válido.',{status:403});
 const url=new URL(req.url);
 const localHttp=url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 return new Response(null,{status:303,headers:{
  'Location':new URL('/',req.url).href,
  'Set-Cookie':'informe_admin='+token+'; Path=/; HttpOnly'+(localHttp?'':'; Secure')+'; SameSite=Lax; Max-Age=7776000',
  'Cache-Control':'no-store','Referrer-Policy':'no-referrer'
 }});
}

