import {createServer} from 'vite';
import {readFileSync,writeFileSync} from 'node:fs';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {CARDS,slug}=await server.ssrLoadModule('/src/data/index.ts');
 const {poolSize}=await server.ssrLoadModule('/src/meta/booster.ts');
 const report={status:'complete',sets:{}};
 for(const code of ['LCI','SOS']){
  const catalog=JSON.parse(readFileSync(`src/data/sets/${code.toLowerCase()}-catalog.json`)),pending=catalog.filter(c=>!CARDS.some(d=>d.id===slug(c.name)));
  report.sets[code]={printed:catalog.length,available:poolSize(code),pending:pending.map(c=>c.name),faces:catalog.reduce((n,c)=>n+['back','prepare','adventure'].filter(k=>c[k]).length,0)};
  if(pending.length||poolSize(code)!==catalog.length)report.status='in-progress';
 }
 if(process.argv.includes('--write'))writeFileSync('docs/lci-sos-progress.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{await server.close();}
