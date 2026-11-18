import {env} from 'cloudflare:workers';
import {isAdmin,noAccess,sign} from '../../access';
import {initialData} from '../../model';
export async function GET(req:Request){if(!await isAdmin(req))return noAccess();const row=await env.DB!.prepare('SELECT payload FROM reports WHERE id = ?').bind('main').first<{payload:string}>();const data=row?JSON.parse(row.payload):initialData();const configured=env.PUBLIC_FORM_ORIGIN?.replace(/\/$/,'');const origin=configured&&/^https?:\/\//.test(configured)?configured:'https://discipuladocgv.org';const links=await Promise.all(data.people.map(async(p:any)=>({id:p.id,url:origin+'/participar/'+encodeURIComponent(p.id)+'/'+await sign('person:'+p.id)})));return Response.json({links},{headers:{'Cache-Control':'no-store'}});}

