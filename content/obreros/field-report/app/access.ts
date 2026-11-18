import {env} from 'cloudflare:workers';
const encoder=new TextEncoder();
async function key(){if(!env.REPORT_SECRET)throw new Error('El acceso todavía no está configurado.');return crypto.subtle.importKey('raw',encoder.encode(env.REPORT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function sign(scope:string){const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',await key(),encoder.encode(scope)));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export async function verify(scope:string,token:string){if(!/^[A-Za-z0-9_-]{43}$/.test(token))return false;try{const bytes=Uint8Array.from(atob(token.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));return crypto.subtle.verify('HMAC',await key(),bytes,encoder.encode(scope));}catch{return false;}}
export function adminHostAllowed(req:Request){return env.ADMIN_LOCAL_ONLY!=='true'||['localhost','127.0.0.1','[::1]'].includes(new URL(req.url).hostname);}
export async function isAdmin(req:Request){if(!adminHostAllowed(req))return false;const token=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('informe_admin='))?.slice(14)||'';return verify('admin',token);}
export async function participantAccess(req:Request){const u=new URL(req.url);const bearer=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';const parts=bearer.split('.');const id=parts[0]||u.searchParams.get('p')||'';const token=parts[1]||u.searchParams.get('t')||'';return id&&await verify('person:'+id,token)?id:null;}
export async function syncAccess(req:Request){const supplied=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';if(!env.SYNC_SECRET||!supplied)return false;const digest=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)));const [a,b]=await Promise.all([digest(supplied),digest(env.SYNC_SECRET)]);let different=0;for(let i=0;i<a.length;i++)different|=a[i]^b[i];return different===0;}
export function sameOrigin(req:Request){return !req.headers.get('origin')||req.headers.get('origin')===new URL(req.url).origin;}
export const noAccess=()=>Response.json({error:'Este enlace no permite acceder a estos datos.'},{status:403,headers:{'Cache-Control':'no-store'}});

