import {createServer} from 'vite';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
const {CARDS,slug}=await server.ssrLoadModule('/src/data/index.ts');
const {colorsOf}=await server.ssrLoadModule('/src/engine/mana.ts');
const diffs=[],sets=[];
const norm=v=>JSON.stringify(Array.isArray(v)?[...v].sort():v);
for(const file of readdirSync('src/data/sets').filter(f=>f.endsWith('-catalog.json'))){
 const rows=JSON.parse(readFileSync('src/data/sets/'+file));let found=0;
 for(const row of rows){const c=CARDS.find(c=>c.id===slug(row.name));if(!c){diffs.push({set:row.set,name:row.name,field:'missing'});continue;}found++;
 for(const key of ['cost','types','subtypes','supertypes','colors','power','toughness','loyalty','text']){
 if(!(key in row))continue;
 const actual=key==='colors'?colorsOf(c):key==='cost'?(c.cost??''):c[key];
 if(norm(actual??(Array.isArray(row[key])?[]:undefined))!==norm(row[key]))diffs.push({set:row.set,name:row.name,definitionSet:c.set,field:key,expected:row[key],actual});
 }
 }
 sets.push({set:rows[0].set,total:rows.length,found});
}
const report = {
 sets, printings: sets.reduce((n,s)=>n+s.total,0),
 basicDifferences: diffs.filter(d=>d.field!=='text'),
 localizedSummaries: diffs.filter(d=>d.field==='text'&&/[\u3400-\u9fff]/.test(d.actual??'')).map(({set,name,definitionSet})=>({set,name,definitionSet})),
 wordingDifferences: diffs.filter(d=>d.field==='text'&&!/[\u3400-\u9fff]/.test(d.actual??'')),
};
if(process.argv.includes('--write'))writeFileSync('docs/card-source-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({printings:report.printings,sets:sets.length,basicDifferences:report.basicDifferences.length,localizedSummaries:report.localizedSummaries.length,wordingDifferences:report.wordingDifferences.length}));
}finally{await server.close();}
