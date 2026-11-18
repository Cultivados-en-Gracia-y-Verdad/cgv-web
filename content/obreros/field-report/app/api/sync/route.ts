import {syncAccess,noAccess} from '../../access';
import {readAuthorized,writeAuthorized} from '../report/route';
export async function GET(req:Request){return await syncAccess(req)?readAuthorized():noAccess();}
export async function PUT(req:Request){return await syncAccess(req)?writeAuthorized(req):noAccess();}
