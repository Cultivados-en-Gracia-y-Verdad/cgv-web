import {syncAccess,noAccess} from '../../../access';
import {uploadAuthorized} from '../../images/route';
export async function POST(req:Request){return await syncAccess(req)?uploadAuthorized(req):noAccess();}
