// Explicit private configuration wins over unrelated shell/parent ERP variables.
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {pathToFileURL} from 'node:url';
const values=parseEnv(readFileSync(process.argv[2],'utf8'));
for(const name of Object.keys(process.env))if(name.startsWith('ERP_')||name.startsWith('LANGFUSE_')||name==='SEND_LANGFUSE')delete process.env[name];
Object.assign(process.env,values,{ERP_FAKE:'0'});
await import(pathToFileURL(process.argv[3]));
