"""Preserve Garth's six referenced Oracle texts from the hash-verified Chinese source snapshot."""
import pathlib,json,hashlib
root=pathlib.Path(__file__).resolve().parents[1];manifest=json.loads((root/'scripts/localization/modern-burn-source.json').read_text());path=pathlib.Path('/tmp/mtgzh-burn-source/zhs_oracle.json');assert hashlib.sha256(path.read_bytes()).hexdigest()==manifest['files']['zhs_oracle.json']
names=['Disenchant','Braingeyser','Terror','Shivan Dragon','Regrowth','Black Lotus'];found={}
for line,raw in enumerate(path.read_text().splitlines(),1):
 r=json.loads(raw.replace('\\\\','\\'))
 if r.get('name')in names and r.get('oracle_text') and r.get('text_stage',0)>0 and r['name']not in found:
  found[r['name']]={'name':r['name'],'text':r['oracle_text'],'sourceFile':'zhs_oracle.json','sourceLine':line,'oracleId':r['oracle_id'],'sourceSha256':manifest['files']['zhs_oracle.json'],'sourceUrl':manifest['releaseUrl']}
assert len(found)==6
(root/'src/data/sets/mh2-garth.json').write_text(json.dumps([found[n]for n in names],ensure_ascii=False,indent=2)+'\n')
