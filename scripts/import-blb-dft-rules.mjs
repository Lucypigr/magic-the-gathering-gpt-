// Import traceable human translations. Never touch card art or gameplay effects.
import {createReadStream} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {Converter} from 'opencc-js/cn2t';
const root=process.argv[2]??'/tmp/mtgzh-name-source';
const manifest=JSON.parse(await readFile('scripts/localization/mtgzh-name-source.json','utf8'));
const file='zhs_oracle.json',hash=createHash('sha256');
for await(const bytes of createReadStream(`${root}/${file}`))hash.update(bytes);
if(hash.digest('hex')!==manifest.files[file])throw Error('Chinese rules source hash mismatch');
const wanted=new Map();
for(const code of ['blb','dft'])for(const c of JSON.parse(await readFile(`src/data/sets/${code}-catalog.json`,'utf8')))wanted.set(c.name,c);
for(const c of JSON.parse(await readFile('/tmp/translation-cards.json','utf8')))if(c.id?.startsWith('tok-bd-')&&c.text)wanted.set(c.name,c);
const traditional=Converter({from:'cn',to:'tw'}),result={},mismatches=[];
const normalize=s=>(s??'').replace(/\[([+−-]?\d+)\](?=:)/g,'$1').replace(/\\+n/g,'\n').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const ai=/gpt|chatgpt|gemini|claude|(?:^|[^a-z])ai(?:[^a-z]|$)/i;
let line=0;
for await(const raw of createInterface({input:createReadStream(`${root}/${file}`),crlfDelay:Infinity})){
 line++;if(!raw.trim())continue;
 const r=JSON.parse(raw.replaceAll('\\\\','\\')),c=wanted.get(r.name);
 if(!c||!r.translated_text||r.text_stage<=0||ai.test(r.text_source??''))continue;
 if(normalize(r.oracle_text)!==normalize(c.text)){mismatches.push(r.name);continue;}
 result[r.name]={text:traditional(r.translated_text.replace(/\\+n/g,'\n')),oracleText:c.text,source:r.text_source,stage:r.text_stage,sourceFile:file,sourceLine:line,oracleId:r.oracle_id,url:manifest.releaseUrl};
}
await writeFile('scripts/localization/blb-dft-rules.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({matched:Object.keys(result).length,total:wanted.size,missing:[...wanted.keys()].filter(n=>!result[n]),mismatched:[...new Set(mismatches)].filter(n=>!result[n])},null,2));
