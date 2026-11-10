import {cpSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=resolve(root,'dist/pages');
const api='https://gift-note-studio-sdkim.stillterrapin2.chatgpt.site';
mkdirSync(out,{recursive:true});
cpSync(resolve(root,'web'),out,{recursive:true});
const appPath=resolve(out,'app.js');
let app=readFileSync(appPath,'utf8');
app=app.replaceAll("fetch('/api/product?url=",`fetch('${api}/api/product?url=`);
app=app.replaceAll("'/api/image?url=",`'${api}/api/image?url=`);
app=app.replaceAll("'detail-original.jpg'",`'${api}/detail-original.jpg'`);
writeFileSync(appPath,app);
writeFileSync(resolve(out,'.nojekyll'),'');
console.log(`GitHub Pages files prepared at ${out}`);

const aiPath=resolve(out,'ai-client.js');writeFileSync(aiPath,readFileSync(aiPath,'utf8').replace("const API_BASE='';","const API_BASE='"+api+"';"));
