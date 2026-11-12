import {cpSync,mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=resolve(root,'dist/pages');
const api='https://gift-note-studio-sdkim.stillterrapin2.chatgpt.site';
mkdirSync(out,{recursive:true});
cpSync(resolve(root,'web'),out,{recursive:true});
cpSync(resolve(root,'server/prompts/threads-writer.md'),resolve(out,'writer-prompt.md'));
const appPath=resolve(out,'app.js');
let app=readFileSync(appPath,'utf8');
app=app.replaceAll("fetch('/api/product?url=",`fetch('${api}/api/product?url=`);
app=app.replaceAll("'detail-original.jpg'",`'${api}/detail-original.jpg'`);
writeFileSync(appPath,app);
writeFileSync(resolve(out,'.nojekyll'),'');
console.log(`GitHub Pages files prepared at ${out}`);

const aiPath=resolve(out,'ai-client.js');writeFileSync(aiPath,readFileSync(aiPath,'utf8').replace("const API_BASE='';","const API_BASE='"+api+"';"));

const files = readdirSync(out, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name !== 'release.json')
  .map(entry => resolve(entry.parentPath ?? entry.path, entry.name))
  .sort();
const hash = createHash('sha256');
for (const file of files) hash.update(readFileSync(file));
const release = hash.digest('hex').slice(0, 16);
writeFileSync(resolve(out, 'release.json'), JSON.stringify({ release }));

const assetUrl = (_, quote, path) => quote + path + '?v=' + release + quote;
for (const file of files.filter(file => file.endsWith('.js'))) {
  const source = readFileSync(file, 'utf8');
  writeFileSync(file, source.replace(/(['"])(\.\/[\w./-]+\.js)(?:\?[^'"]*)?\1/g, assetUrl));
}
const indexPath = resolve(out, 'index.html');
const index = readFileSync(indexPath, 'utf8')
  .replace(/(['"])([\w-]+\.(?:css|js|md))(?:\?[^'"]*)?\1/g, assetUrl)
  .replace('</head>', `  <script>
    (() => {
      const current = '${release}';
      const version = new URL('release.json', location.href);
      version.searchParams.set('check', Date.now());
      fetch(version, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
          if (!/^[a-f0-9]{16}$/.test(data?.release) || data.release === current) return;
          const next = new URL(location.href);
          if (next.searchParams.get('release') === data.release) return;
          next.searchParams.set('release', data.release);
          location.replace(next.href);
        })
        .catch(() => {});
    })();
  </script>
</head>`);
writeFileSync(indexPath, index);
