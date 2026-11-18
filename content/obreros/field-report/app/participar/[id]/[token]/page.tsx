import {verify} from '../../../access';
import Participant from '../../../participant';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string;token:string}>}){const {id,token}=await params;if(!await verify('person:'+id,token))return <main className="public-landing"><h1>El enlace no es válido</h1><p>Solicita tu enlace personal a la persona que organiza el informe.</p></main>;return <Participant id={id} token={token}/>;}

