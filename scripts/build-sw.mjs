import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve('dist');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}
const files = (await walk(root)).filter(f => !f.endsWith('.map') && !f.endsWith('sw.js'));
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(file));
const version = hash.digest('hex').slice(0, 12);
const urls = files.map(f => './' + path.relative(root, f).split(path.sep).join('/'));
await writeFile(path.join(root, 'sw.js'), `
const CACHE='boxshift-${version}';
const ASSETS=${JSON.stringify(['./', ...urls])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
// Waiting workers activate when all old tabs close: an open puzzle never mixes releases.
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('boxshift-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    // Same-origin immutable assets are identical for module Origin request variants.
    const cached=await cache.match(event.request,{ignoreSearch:true,ignoreVary:true});
    if(cached)return cached;
    try{return await fetch(event.request);}catch(error){
      if(event.request.mode==='navigate')return (await cache.match('./'))||Response.error();
      return Response.error();
    }
  }));
});
`);
console.log(`Offline shell ${version}: ${urls.length} local assets.`);
