import {createServer} from 'vite';
import {writeFileSync} from 'node:fs';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
const {CARDS,AI_DECKS,STANDARD_AI_DECKS,STARTER_DECKS,STANDARD_STARTERS}=await server.ssrLoadModule('/src/data/index.ts');
writeFileSync(process.argv[2] ?? '/tmp/modern-audit/inventory.json',JSON.stringify({cards:CARDS.map(c=>({id:c.id,name:c.name,set:c.set,imageName:c.imageName})),decks:[...AI_DECKS,...STANDARD_AI_DECKS,...STARTER_DECKS,...STANDARD_STARTERS]}));
console.log('main definitions',CARDS.length);
}finally{await server.close();}
