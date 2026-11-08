"""Refresh the existing Modern report from the pinned audit without discarding its methodology."""
import json,pathlib,re
root=pathlib.Path(__file__).resolve().parents[1]
presets=json.loads((root/'src/data/modern-decklists.json').read_text())
new_names={c['name']for f in (root/'src/data/sets').glob('modern-*-catalog.json')for c in json.loads(f.read_text())}
r=json.loads((root/'docs/modern-gap.json').read_text());s=r['summary'];p=root/'docs/modern-gap.md';lines=p.read_text().splitlines();series={x['code']:x for x in r['series']};decks={x['name']:x for x in r['decks']};out=[]
for line in lines:
 if line.startswith('- 依『牌名是否'):line=f"- 依『牌名是否有可載入定義』判斷，完整 **{s['completePrimarySets']} 個**，未完整 **{s['incompletePrimarySets']} 個**；其中 **{s['zeroCoveragePrimarySets']} 個**完全沒有非基本地牌名。其餘未齊系列已有部分同名重印牌，不是整個系列都空白。"
 elif line.startswith('- 合法 Modern 卡池'):line=f"- 合法 Modern 卡池共 **{s['modernLegalNames']:,} 種牌名**，遊戲已有 **{s['availableModernNames']:,} 種**（{s['availableModernNames']/s['modernLegalNames']:.1%}），缺 **{s['missingModernNames']:,} 種**。同名跨系列重印只算一次，基本地包含在此卡池總數。"
 elif line.startswith('- 50 份牌表樣本中'):line=f"- 50 份牌表樣本中，主牌能完整還原 **{s['completeMainDecks']}/50**；包含備牌能完整還原 **{s['complete75Decks']}/50**。這 50 份牌表合計缺 **{s['sampleMissingNames']} 種不同的牌**。"
 elif line.startswith('遊戲現已提供'):line=f"遊戲現已提供近代賽模式、獨立卡池與禁牌篩選，以及{'、'.join(d['name']for d in presets)}共{len(presets)}副原始牌表，均保留60張主牌與15張備牌。備牌會保存並計入合法性與收藏檢查；目前對局仍是單局，尚無局間換備牌流程。"
 elif line.startswith('如果目標是先還原'):line=f"如果目標是先還原競技牌表，先補這 50 份樣本共缺的 {s['sampleMissingNames']} 種牌，比直接補完整 {s['missingModernNames']:,} 種卡池更集中。仍需逐張實作／驗證效果，不能只匯入顯示文字。"
 elif line.startswith('| '):
  key=line.split('|')[1].strip()
  if key in decks:
   d=decks[key];line=f"| {key} | {d['mainAvailable']}/{d['mainTotal']} | {d['sideAvailable']}/{d['sideTotal']} | {d['missingNames']} |"
  elif key in series:
   a=series[key];line=f"| {key} | {a['name']} | {a['available']} | {a['count']} | {a['missing']} |"
 line=re.sub(r'\[\d+ 種優先補牌 CSV\]',f"[{s['sampleMissingNames']} 種優先補牌 CSV]",line)
 if line.startswith('每個下載檔案的 SHA-256'):line=re.sub(r'模式與\d+種牌',f'模式與{len(new_names)}種牌',line)
 out.append(line)
p.write_text('\n'.join(out)+'\n')
