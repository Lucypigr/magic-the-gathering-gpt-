import json,pathlib,unicodedata,re,zipfile,collections
import argparse,hashlib,urllib.request,concurrent.futures,subprocess,csv,io
repo=pathlib.Path(__file__).resolve().parents[1]
args=argparse.ArgumentParser();args.add_argument('--cache',default='/tmp/modern-audit');args.add_argument('--write',action='store_true');args=args.parse_args()
root=pathlib.Path(args.cache);(root/'sets').mkdir(parents=True,exist_ok=True)
manifest=json.load(open(repo/'scripts/modern-sources.json'));index=manifest['sets']
def verified(path,url,expected):
 if not path.exists():path.write_bytes(urllib.request.urlopen(url,timeout=45).read())
 raw=path.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=expected:raise ValueError('Source SHA-256 mismatch: '+str(path))
 return raw
def get_set(meta):
 return verified(root/'sets'/meta['file'],f"https://raw.githubusercontent.com/{manifest['cardRepository']}/{manifest['cardRevision']}/{manifest['cardDirectory']}/{meta['file']}",meta['sha256'])
with concurrent.futures.ThreadPoolExecutor(max_workers=8)as executor:list(executor.map(get_set,index))
verified(root/'modern-format.txt',f"https://raw.githubusercontent.com/{manifest['formatRepository']}/{manifest['formatRevision']}/{manifest['formatPath']}",manifest['formatSha256'])
d=manifest['decks'];verified(root/'modern-decks.zip',f"https://raw.githubusercontent.com/{d['repository']}/{d['revision']}/{d['path']}",d['sha256'])
subprocess.run(['node',str(repo/'scripts/export-modern-inventory.mjs'),str(root/'inventory.json')],cwd=repo,check=True)
inv=json.load(open(root/'inventory.json'))
def norm(s):
 s=unicodedata.normalize('NFKD',s).replace('Æ','AE').replace('æ','ae')
 return ''.join(c.lower()for c in s if c.isascii()and c.isalnum())
avail={norm(c['name']):c for c in inv['cards']};universe={};aliases={};setrows=[];allmeta={}
for meta in index:
 d=json.load(open(root/'sets'/meta['file']));rows={}
 for c in d['cards']:
  if c.get('side')=='b' or c.get('layout')=='reversible_card':continue
  n=c['name'];key=norm(n)
  # Printed variants all represent the same physical card; extra faces aren't independent deck cards.
  aliases[key]=key
  if c.get('faceName'):aliases[norm(c['faceName'])]=key
  rows[key]=c;allmeta[key]=c
  if c.get('legalities',{}).get('modern')=='Legal':universe[key]=c
 values=list(rows.values());printable=[c for c in values if 'Basic'not in c.get('supertypes',[])]
 def available(c):return norm(c['name'])in avail or norm(c.get('faceName',c['name']))in avail
 included=[c for c in printable if available(c)]
 eligible=[c for c in values if c.get('legalities',{}).get('modern')=='Legal']
 setrows.append({**{k:meta[k]for k in ['code','name','type','date']},'count':len(printable),'available':len(included),'missing':len(printable)-len(included),'modernLegal':len(eligible),'modernAvailable':sum(available(c)for c in eligible),'primary':meta['type']in ['core','expansion']or meta['code']in ['MH1','MH2','MH3','LTR','ACR']})
modernAvailable={k:c for k,c in universe.items()if norm(c['name'])in avail or norm(c.get('faceName',c['name']))in avail}
missing={k:c for k,c in universe.items()if k not in modernAvailable}
# Key aliases for cards with side A don't make spell/prepare back faces independently available.
def exists(n):return norm(n)in avail or aliases.get(norm(n))in modernAvailable
z=zipfile.ZipFile(root/'modern-decks.zip');decks=[];missingFreq=collections.Counter();illegalFreq=collections.Counter()
for file in z.infolist():
 if not file.filename.endswith('.dck'):continue
 text=z.read(file).decode('utf-8-sig');section='';main=[];side=[];name=file.filename.rsplit('/',1)[-1][:-4]
 for line in text.splitlines():
  line=line.strip()
  if line.startswith('Name='):name=line[5:]
  if line.startswith('[')and line.endswith(']'):section=line[1:-1].lower();continue
  if section not in ['main','sideboard']:continue
  m=re.match(r'^(\d+)\s+(.+)$',line)
  if m:(main if section=='main'else side).append((int(m[1]),m[2].split('|')[0]))
 def inspect(rows):return [{'name':n,'quantity':qty,'available':exists(n),'legal':aliases.get(norm(n),norm(n))in universe}for qty,n in rows]
 a,b=inspect(main),inspect(side);miss=[x for x in a+b if not x['available']];ill=[x for x in a+b if not x['legal']]
 for n in set(x['name']for x in miss):missingFreq[n]+=1
 for n in set(x['name']for x in ill):illegalFreq[n]+=1
 decks.append({'name':name,'file':file.filename,'date':list(file.date_time),'mainTotal':sum(q for q,n in main),'sideTotal':sum(q for q,n in side),'mainAvailable':sum(x['quantity']for x in a if x['available']),'sideAvailable':sum(x['quantity']for x in b if x['available']),'missingNames':len(set(x['name']for x in miss)),'missing':miss,'illegal':ill,'main':a,'side':b})
primary=[s for s in setrows if s['primary']]
summary={'registryDefinitions':len(inv['cards']),'allProducts':len(setrows),'primarySets':len(primary),'completePrimarySets':sum(s['missing']==0 for s in primary),'incompletePrimarySets':sum(s['missing']>0 for s in primary),'zeroCoveragePrimarySets':sum(s['available']==0 for s in primary),'modernLegalNames':len(universe),'availableModernNames':len(modernAvailable),'missingModernNames':len(missing),'sampleDecks':len(decks),'legalSampleDecks':sum(not d['illegal']for d in decks),'completeMainDecks':sum(d['mainAvailable']==d['mainTotal']for d in decks),'complete75Decks':sum(d['mainAvailable']==d['mainTotal']and d['sideAvailable']==d['sideTotal']for d in decks)}
report={'summary':summary,'series':setrows,'decks':decks,'missingPopular':sorted(missingFreq.items(),key=lambda x:(-x[1],x[0])),'illegalPopular':sorted(illegalFreq.items(),key=lambda x:(-x[1],x[0])),'missingCards':[{'name':c['name'],'primaryName':c.get('faceName',c['name']),'set':c['setCode']}for c in missing.values()]}
report['sources']=manifest
report['summary']['sampleMissingNames']=len({x['name']for d in decks for x in d['missing']})
report['summary']['snapshotDate']=manifest['cardSnapshotDate']
report['summary']['deckFileDate']=max('-'.join(str(n).zfill(2)for n in d['date'][:3])for d in decks)
assert len(primary)==107 and len(setrows)==118
assert all(d['mainTotal']>=60 and d['sideTotal']<=15 for d in decks)
assert summary['availableModernNames']+summary['missingModernNames']==summary['modernLegalNames']
if args.write:
 out=repo/'docs';(out/'modern-gap.json').write_text(json.dumps({k:v for k,v in report.items()if k!='missingCards'},ensure_ascii=False,indent=2)+'\n')
 def table(filename,fields,records):
  with open(out/filename,'w',encoding='utf-8-sig',newline='')as f:
   writer=csv.DictWriter(f,fields,extrasaction='ignore',lineterminator='\n');writer.writeheader();writer.writerows(records)
 table('modern-series-gap.csv',['code','name','date','type','primary','count','available','missing','modernLegal','modernAvailable'],setrows)
 table('modern-missing-cards.csv',['name','primaryName','set'],report['missingCards'])
 table('modern-deck-gap.csv',['name','mainAvailable','mainTotal','sideAvailable','sideTotal','missingNames','missingMainNames','missingSideNames'],[{**d,'missingMainNames':' / '.join(x['name']for x in d['main']if not x['available']),'missingSideNames':' / '.join(x['name']for x in d['side']if not x['available'])}for d in decks])
 table('modern-priority-cards.csv',['name','decks'],[{'name':n,'decks':count}for n,count in sorted(missingFreq.items(),key=lambda x:(-x[1],x[0]))])
print(json.dumps(report['summary'],ensure_ascii=False))
