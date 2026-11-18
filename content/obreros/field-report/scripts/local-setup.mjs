import fs from 'node:fs/promises';
import {randomBytes,createHmac} from 'node:crypto';
const root=new URL('../',import.meta.url);
const vars=new URL('.dev.vars',root);
let content='';try{content=await fs.readFile(vars,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
const match=content.match(/^REPORT_SECRET\s*=\s*(.+)$/m);
let secret;
if(match){let value=match[1].trim();try{secret=JSON.parse(value);}catch{secret=value.replace(/^['"]|['"]$/g,'');}}
else{secret=randomBytes(32).toString('hex');await fs.writeFile(vars,content+(content.endsWith('\n')||!content?'':'\n')+'REPORT_SECRET='+JSON.stringify(secret)+'\n',{mode:0o600});}
if(typeof secret!=='string'||!secret)throw new Error('REPORT_SECRET in .dev.vars is empty.');
await fs.mkdir(new URL('.sites-runtime/',root),{recursive:true});
await fs.writeFile(new URL('.sites-runtime/execution-profile.json',root),JSON.stringify({executionProfile:'portable'},null,2)+'\n');
const token=createHmac('sha256',secret).update('admin').digest('base64url');
console.log('Local configuration ready. Production settings were not changed.');
console.log('After the local build/migration, run npm run dev.');
console.log('Your LOCAL administrator URL: http://localhost:5173/administrar/'+token);
console.log('Keep this URL private. .dev.vars and .sites-runtime are ignored by Git.');

