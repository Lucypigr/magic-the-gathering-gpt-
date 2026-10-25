"""Rebuild strict native-effect patches from pinned MTGJSON snapshots.
Unsupported rules are deliberately left out; manual patches live in
src/data/sets/blb-dft-verified.ts. This never marks a partial set complete.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import urllib.request

root = Path(__file__).resolve().parents[1]
cache = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/name-printings')
cache.mkdir(parents=True, exist_ok=True)
source = json.loads((root / 'scripts/localization/name-sources.json').read_text())
spec = importlib.util.spec_from_file_location('gen', root / 'scripts/gen_cards.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
for en, zh in re.findall(r"^\s+([A-Z][A-Za-z]+): '([^']+)',$", (root / 'src/ui/i18n.ts').read_text(), re.M):
    g.SUBZH[en] = zh
for code in ['BLB', 'DFT']:
    path = cache / f'{code}.json'
    expected = source['files'][path.name]
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        url = f"https://raw.githubusercontent.com/{source['repository']}/{source['revision']}/{source['directory']}/{path.name}"
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f'{code}: source hash mismatch')
        path.write_bytes(data)
    seen, catalog, auto = set(), [], {}
    for c in json.loads(path.read_text())['cards']:
        if not c['number'].isdigit() or 'Basic' in c['supertypes'] or c['name'] in seen:
            continue
        seen.add(c['name'])
        number = int(c['number'])
        row = {k: c[k] for k in ['name', 'types', 'subtypes', 'supertypes', 'colors']}
        row.update(cost=c.get('manaCost', ''), text=c.get('text', ''), number=number, set=code, rarity=g.RARITY[c['rarity']])
        for k in ['power', 'toughness', 'loyalty']:
            if k in c:
                try:
                    row[k] = int(c[k])
                except ValueError:
                    row[k], row[k + 'Text'] = 0, c[k]
        row['keywords'] = [g.KW[k.lower()][0] for k in c.get('keywords', []) if k.lower() in g.KW]
        catalog.append(row)
        face = dict(name=c['name'], set=code.lower(), mana_cost=c.get('manaCost', ''), type_line=c['type'], oracle_text=c.get('text', ''), layout=c['layout'], keywords=c.get('keywords', []), rarity=c['rarity'], power=str(c.get('power', '')), toughness=str(c.get('toughness', '')))
        try:
            result = g.convert(face)
            auto[number] = {k: v for k, v in result.items() if k not in ['id', 'name', 'set', 'rarity', 'cost', 'types', 'subtypes', 'supertypes', 'colors', 'power', 'toughness', 'loyalty', 'text']}
        except g.Unsupported:
            pass
    for suffix, data in [('catalog', catalog), ('auto', auto)]:
        (root / f'src/data/sets/{code.lower()}-{suffix}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(code, 'printed:', len(catalog), 'strict patches:', len(auto))
tokens_path = root / 'src/data/sets/foundation-tokens.json'
tokens = json.loads(tokens_path.read_text())
ids = {t['id'] for t in tokens}
for token in g.TOKENS.values():
    if token['id'] not in ids:
        tokens.append(token)
        ids.add(token['id'])
tokens_path.write_text(json.dumps(tokens, ensure_ascii=False, indent=2) + '\n')
