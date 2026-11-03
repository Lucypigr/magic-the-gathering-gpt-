"""Build the 21-card batch, three source decklists and offline Modern legality."""
import hashlib,json,pathlib,unicodedata
root=pathlib.Path(__file__).resolve().parents[1];cache=pathlib.Path('/tmp/modern-audit/sets')
manifest=json.load(open(root/'scripts/modern-sources.json'));audit=json.load(open(root/'docs/modern-gap.json'))
targets=['Izzet Murktide'];decks=[next(d for d in audit['decks']if d['name'].endswith(' - '+n))for n in targets]
wanted=set("Blood Moon|Counterspell|Force of Negation|Misty Rainforest|Mystical Dispute|Polluted Delta|Ragavan, Nimble Pilferer|Stern Scolding|Subtlety|Surgical Extraction|Test of Talents".split('|'));assert len(wanted)==11
selected={};legal=set();banned=set()
def key(s):return ''.join(c.lower()for c in unicodedata.normalize('NFKD',s).replace('Æ','AE').replace('æ','ae')if c.isascii()and c.isalnum())
def row(c,meta):
 r={k:c[k]for k in ['types','subtypes','supertypes','colors']};r.update(name=c.get('faceName',c['name']),cost=c.get('manaCost',''),text=c.get('text',''),set='META',rarity={'common':'C','uncommon':'U','rare':'R','mythic':'M','special':'R'}[c['rarity']],sourceSet=c['setCode'],sourceUuid=c['uuid'],sourceSha256=meta['sha256'])
 for field in ['power','toughness']:
  if field in c:r[field]=int(c[field])
 return r
for meta in sorted(manifest['sets'],key=lambda x:(x['date'],x['code'])):
 p=cache/meta['file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==meta['sha256'];data=json.loads(p.read_bytes());byid={c['uuid']:c for c in data['cards']}
 for c in data['cards']:
  if c.get('side')=='b' or c.get('layout')=='reversible_card':continue
  names=[c['name'],c.get('faceName',c['name'])];status=c.get('legalities',{}).get('modern')
  if status=='Legal':legal.update(key(n)for n in names)
  elif status=='Banned':banned.add(c['name'])
  n=c.get('faceName',c['name'])
  if n in wanted and n not in selected:
   selected[n]=row(c,meta)
   if c.get('otherFaceIds'):selected[n]['adventure']=row(byid[c['otherFaceIds'][0]],meta)
assert set(selected)==wanted
(root/'src/data/sets/modern-murktide-catalog.json').write_text(json.dumps([selected[n]for n in sorted(selected)],ensure_ascii=False,indent=2)+'\n')
(root/'src/data/modern-decklists.json').write_text(json.dumps([x for x in json.load(open(root/'src/data/modern-decklists.json')) if x['id'] != 'modern-izzet-murktide'] + [{'id':'modern-'+n.lower().replace(' ','-'),'name':{'Izzet Murktide':'伊捷龍侯'}[n],'sourceName':d['name'],'source':manifest['decks'],'date':audit['summary']['deckFileDate'],'main':[[x['quantity'],x['name']]for x in d['main']],'side':[[x['quantity'],x['name']]for x in d['side']]}for n,d in zip(targets,decks)],ensure_ascii=False,indent=2)+'\n')
(root/'src/data/modern-legality.json').write_text(json.dumps({'asOf':manifest['cardSnapshotDate'],'source':{'repository':manifest['cardRepository'],'revision':manifest['cardRevision']},'legalKeys':sorted(legal),'bannedNames':sorted(banned)},ensure_ascii=False,indent=2)+'\n')
print('Generated',len(selected),'cards, 1 decklist;',len(legal),'legal name keys;',len(banned),'banned names')
