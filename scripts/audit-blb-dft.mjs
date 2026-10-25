import {createServer} from 'vite';
import {readFileSync,writeFileSync} from 'node:fs';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {VERIFIED_BLB_DFT}=await server.ssrLoadModule('/src/data/sets/blb-dft-verified.ts');
 const {CARDS,slug}=await server.ssrLoadModule('/src/data/index.ts');
 const {poolSize}=await server.ssrLoadModule('/src/meta/booster.ts');
 const report={status:'in-progress',sets:{}};
 for(const code of ['BLB','DFT']){
  const catalog=JSON.parse(readFileSync(`src/data/sets/${code.toLowerCase()}-catalog.json`));
  const verified=new Set(VERIFIED_BLB_DFT[code]);
  const pending=catalog.filter(c=>!verified.has(c.number));
  report.sets[code]={printed:catalog.length,available:poolSize(code),verified:verified.size,pending:pending.map(c=>({number:c.number,name:c.name,available:CARDS.some(d=>d.id===slug(c.name))}))};
 }
 report.status=Object.values(report.sets).every(s=>s.verified===s.printed&&s.available===s.printed)?'complete':'in-progress';
 if(process.argv.includes('--write'))writeFileSync('docs/blb-dft-progress.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(Object.fromEntries(Object.entries(report.sets).map(([s,v])=>[s,{printed:v.printed,available:v.available,verified:v.verified,pending:v.pending.length}]))));
}finally{await server.close();}
