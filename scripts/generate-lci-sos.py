"""Rebuild LCI/SOS catalogs and strictly supported effects from pinned MTGJSON.
Manual complete mechanics live in lci-extra.ts and sos-extra.ts."""
import json,hashlib,importlib.util,re,pathlib,sys,urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
cache=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/name-printings');cache.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('gen',root/'scripts/gen_cards.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
for en,zh in re.findall(r"^\s+([A-Z][A-Za-z]+): '([^']+)',$",(root/'src/ui/i18n.ts').read_text(),re.M):g.SUBZH[en]=zh
manifest=json.loads((root/'scripts/localization/name-sources.json').read_text())
for code in ['LCI','SOS']:
 path=cache/(code+'.json')
 if not path.exists():
  url=f"https://raw.githubusercontent.com/{manifest['repository']}/{manifest['revision']}/{manifest['directory']}/{path.name}"
  path.write_bytes(urllib.request.urlopen(url,timeout=60).read())
 raw=path.read_bytes();assert hashlib.sha256(raw).hexdigest()==manifest['files'][code+'.json']
 cards=json.loads(raw)['cards'];byuuid={c['uuid']:c for c in cards};seen=set();catalog=[];auto={};pending=[]
 def row(c,number=None):
  r={k:c[k] for k in ['types','subtypes','supertypes','colors']};r.update(name=c.get('faceName',c['name']),cost=c.get('manaCost',''),text=c.get('text',''),set=code,rarity=g.RARITY[c['rarity']]);
  if number is not None:r['number']=number
  for k in ['power','toughness','loyalty']:
   if k in c:
    try:r[k]=int(c[k])
    except ValueError:r[k]=0;r[k+'Text']=c[k]
  r['keywords']=[]
  # The source's keyword summary also lists conditional/granted abilities.
  # Only standalone keyword lines are intrinsic abilities of this face.
  for line in c.get('text','').split('\n'):
   line=re.sub(r'\([^)]*\)', '', line).strip().rstrip('.').lower()
   words=[w.strip() for w in line.split(',')]
   if words and all(w in g.KW for w in words):r['keywords'].extend(g.KW[w][0] for w in words)
  return r
 def face(c):return dict(name=c.get('faceName',c['name']),mana_cost=c.get('manaCost',''),type_line=c['type'],oracle_text=c.get('text',''),power=c.get('power'),toughness=c.get('toughness'))
 for c in cards:
  if not c['number'].isdigit() or 'Basic' in c['supertypes'] or c.get('side')=='b' or c['name'] in seen:continue
  seen.add(c['name']);n=int(c['number']);r=row(c,n);layout=c['layout'];f=dict(face(c),set=code.lower(),layout=layout,rarity=c['rarity'],keywords=c.get('keywords',[]))
  if c.get('side')=='a':
   back=byuuid[c['otherFaceIds'][0]];f['name']=c['name'];f['card_faces']=[face(c),face(back)];key={'transform':'back','prepare':'prepare','adventure':'adventure'}[layout];r[key]=row(back);r['imageName']=c['name']
  catalog.append(r)
  try:
   result=g.convert(f);p={k:v for k,v in result.items() if k not in ['id','name','set','rarity','cost','types','subtypes','supertypes','colors','power','toughness','loyalty','text']}
   for key in ['back','prepare','adventure']:
    if key in r:
     p[key]={**p.get(key,{}),**{k:v for k,v in r[key].items() if k!='keywords'}}
   auto[n]=p
  except g.Unsupported as e:pending.append((r,str(e)))
 for suffix,data in [('catalog',catalog),('auto',auto)]: (root/f'src/data/sets/{code.lower()}-{suffix}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 pathlib.Path('/tmp/'+code.lower()+'-pending.txt').write_text('\n\n'.join(str(r['number'])+' '+r['name']+' '+r['cost']+' '+str(r.get('power',''))+'/'+str(r.get('toughness',''))+' ['+' '.join(r['types'])+']\n'+r['text']+''.join('\nBACK '+r[k]['name']+' '+r[k]['cost']+' '+str(r[k].get('power',''))+'/'+str(r[k].get('toughness',''))+'\n'+r[k]['text'] for k in ['back','prepare','adventure'] if k in r)+'\nUNSUPPORTED '+e for r,e in pending))
 print(code,'catalog',len(catalog),'auto',len(auto),'manual',len(pending))
p=root/'src/data/sets/foundation-tokens.json';ts=json.loads(p.read_text());ids={t['id'] for t in ts};ts.extend(t for t in g.TOKENS.values() if t['id'] not in ids);p.write_text(json.dumps(ts,ensure_ascii=False,indent=2)+'\n')
