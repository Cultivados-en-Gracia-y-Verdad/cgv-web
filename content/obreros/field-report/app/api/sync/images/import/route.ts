import {syncAccess,noAccess} from '../../../../access';
import {importAuthorized} from '../../../images/import/route';

export async function POST(req:Request){return await syncAccess(req)?importAuthorized(req):noAccess();}
