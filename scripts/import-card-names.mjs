// Import published Chinese names only; never translate an English card name.
// Raw snapshots stay outside the repository. Each input is pinned and hashed.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Converter } from 'opencc-js/cn2t';

const input = JSON.parse(await readFile('/tmp/translation-cards.json', 'utf8'));
const source = JSON.parse(await readFile('scripts/localization/name-sources.json', 'utf8'));
const cacheDir = process.argv[2] ?? '/tmp/name-printings';
const wanted = new Set(input.map(c => c.name.toLowerCase()));
// Imported deck lists also show original cards that are outside the game pool.
// Keep their published names, including sideboards and substitution source rows.
const netdecks = JSON.parse(await readFile('public/netdecks.json', 'utf8'));
for (const deck of netdecks.decks ?? []) {
  for (const [, name] of [...(deck.main ?? []), ...(deck.side ?? [])]) wanted.add(name.toLowerCase());
}
const toTraditional = Converter({ from: 'cn', to: 'tw' });
const names = new Map();
const han = /[\u3400-\u9fff]/;
await mkdir(cacheDir, { recursive: true });

function add(en, printed, foreign, card, set, file) {
  if (!en || !printed || !wanted.has(en.toLowerCase()) || !han.test(printed)) return;
  // A joined record may contain an untranslated face. Never assign its other
  // face's translation to the missing face, or present mixed data as complete.
  if (printed.split(' // ').some(part => !han.test(part))) return;
  const language = foreign.language === 'Chinese Traditional' ? 'zht' : 'zhs';
  const identifiers = foreign.identifiers ?? {};
  const multiverseId = identifiers.multiverseId ?? foreign.multiverseId;
  const scryfallId = identifiers.scryfallId;
  if (!multiverseId && !scryfallId) return;
  const entry = {
    name: language === 'zht' ? printed : toTraditional(printed),
    printedName: printed,
    language,
    set: set.code,
    number: card.number,
    ...(multiverseId ? { multiverseId: String(multiverseId) } : {}),
    ...(scryfallId ? { scryfallId } : {}),
    sourceFile: file,
  };
  const rank = `${language === 'zht' ? '1' : '0'}:${set.releaseDate ?? ''}`;
  const key = en.toLowerCase();
  if (!names.has(key) || rank > names.get(key).rank) names.set(key, { entry, rank });
}

for (const [file, digest] of Object.entries(source.files)) {
  const path = join(cacheDir, file);
  let bytes;
  try { bytes = await readFile(path); }
  catch (e) {
    if (e.code !== 'ENOENT') throw e;
    const url = `https://raw.githubusercontent.com/${source.repository}/${source.revision}/${source.directory}/${file}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error(`${file}: source hash mismatch`);
    await writeFile(path, bytes);
  }
  if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error(`${file}: source hash mismatch`);
  const set = JSON.parse(bytes);
  for (const card of set.cards) {
    for (const foreign of card.foreignData ?? []) {
      if (!['Chinese Traditional', 'Chinese Simplified'].includes(foreign.language)) continue;
      const enParts = card.name.split(' // ');
      const zhParts = foreign.name?.split(' // ') ?? [];
      add(card.name, foreign.name, foreign, card, set, file);
      if (enParts.length > 1 && enParts.length === zhParts.length) {
        for (let i = 0; i < enParts.length; i++) add(enParts[i], zhParts[i], foreign, card, set, file);
      }
      // MTGJSON faceName explicitly identifies one face (including Adventures).
      if (card.faceName && foreign.faceName) add(card.faceName, foreign.faceName, foreign, card, set, file);
    }
  }
}

const result = Object.fromEntries([...names].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, value]) => [key, value.entry]));
await writeFile('src/data/localization/zh-names.json', JSON.stringify(result, null, 2) + '\n');
console.log(`Published names: ${names.size}; Traditional: ${Object.values(result).filter(n => n.language === 'zht').length}; Simplified (displayed in Traditional): ${Object.values(result).filter(n => n.language === 'zhs').length}`);
