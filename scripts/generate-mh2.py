"""Build canonical MH2 faces and token metadata from the verified Modern snapshot."""
import json,pathlib,hashlib,re
root=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((root/'scripts/modern-sources.json').read_text());meta=next(x for x in manifest['sets']if x['code']=='MH2');p=pathlib.Path('/tmp/modern-audit/sets')/meta['file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==meta['sha256'];source=json.loads(p.read_bytes());by={c['uuid']:c for c in source['cards']}
def row(c):
 r={k:c[k]for k in ['types','subtypes','supertypes','colors']};r.update(name=c.get('faceName',c['name']),number=int(re.match(r'\d+',c['number'])[0]),cost=c.get('manaCost',''),text=c.get('text',''),set='MH2',rarity={'common':'C','uncommon':'U','rare':'R','mythic':'M','special':'R'}[c['rarity']],sourceSet='MH2',sourceUuid=c['uuid'],sourceSha256=meta['sha256'],layout=c['layout'])
 for k in ['power','toughness','loyalty']:
  if k in c:r[k]=int(c[k])if c[k].lstrip('-').isdigit()else 0
 if 'power'in c:r['printedPower']=c['power'];r['printedToughness']=c['toughness']
 r['sourceKeywords']=c.get('keywords',[])
 return r
seen=set();catalog=[]
for c in source['cards']:
 if c.get('side')=='b' or c['name']in seen or 'Basic'in c.get('supertypes',[]):continue
 seen.add(c['name']);r=row(c)
 if c.get('otherFaceIds'):
  b=by[c['otherFaceIds'][0]];r['adventure'if c['layout']=='adventure'else'back']=row(b)
 catalog.append(r)
assert len(catalog)==304
(root/'src/data/sets/mh2-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
print('MH2:',len(catalog),'fronts;',sum('back'in c for c in catalog),'backs; verified',meta['sha256'])
