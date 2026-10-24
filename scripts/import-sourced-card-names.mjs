// Use published database translations, never generate an English-to-Chinese name.
// The upstream JSON-lines dump uses PostgreSQL COPY escaping (doubled slashes).
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Converter } from 'opencc-js/cn2t';

const root = process.argv[2] ?? '/tmp/mtgzh-name-source';
const manifest = JSON.parse(await readFile('scripts/localization/mtgzh-name-source.json', 'utf8'));
const aliases = JSON.parse(await readFile('scripts/localization/name-aliases.json', 'utf8'));
const published = JSON.parse(await readFile('src/data/localization/zh-names.json', 'utf8'));
const input = JSON.parse(await readFile('/tmp/translation-cards.json', 'utf8'));
const netdecks = JSON.parse(await readFile('public/netdecks.json', 'utf8'));
const wanted = new Set(input.map(c => c.name.toLowerCase()));
for (const d of netdecks.decks ?? []) for (const [, n] of [...d.main, ...d.side]) wanted.add(n.toLowerCase());
for (const a of [...Object.values(aliases.byName), ...Object.values(aliases.byId)]) wanted.add(a.sourceName.toLowerCase());
const nameKey = name => name.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[’‘]/g, "'").replace(/\s*\/+\s*/g, ' // ').replace(/\s+/g, ' ').trim().toLowerCase();
const wantedKeys = new Set([...wanted].map(nameKey));
const isWanted = name => name && wantedKeys.has(nameKey(name));
const traditional = Converter({ from: 'cn', to: 'tw' });
const han = /[\u3400-\u9fff]/;
const ai = /gpt|chatgpt|gemini|claude|(?:^|[^a-z])ai(?:[^a-z]|$)/i;
const selected = new Map();
const ranks = new Map();
const matchedPrints = new Map();
const rejected = [];

for (const [file, expected] of Object.entries(manifest.files)) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(join(root, file))) hash.update(bytes);
  if (hash.digest('hex') !== expected) throw new Error(`${file}: source hash mismatch`);
}

async function* records(file) {
  let line = 0;
  for await (const text of createInterface({ input: createReadStream(join(root, file)), crlfDelay: Infinity })) {
    line++;
    if (!text.trim()) continue;
    try { yield { row: JSON.parse(text.replaceAll('\\\\', '\\')), line }; }
    catch (error) { throw new Error(`${file}:${line}: ${error.message}`); }
  }
}

function candidate(en, rawName, fields, priority) {
  if (!isWanted(en) || !rawName || !han.test(rawName)) return;
  if (rawName.split(' // ').some(n => !han.test(n))) return;
  const key = en.toLowerCase();
  if (ai.test(fields.declaredSource ?? '')) { rejected.push({ name: en, source: fields.declaredSource }); return; }
  const rank = `${priority}:${fields.released ?? ''}:${String(fields.sourceLine).padStart(7, '0')}`;
  if (ranks.has(key) && ranks.get(key) >= rank) return;
  selected.set(key, { name: fields.language === 'zht' ? rawName : traditional(rawName), sourceName: en, originalChinese: rawName, ...fields });
  ranks.set(key, rank);
}

for await (const { row: r, line } of records('zhs_oracle.json')) {
  if (!isWanted(r.name) || !r.translated_name || !(r.name_stage > 0)) continue;
  candidate(r.name, r.translated_name, {
    kind: 'database', language: 'zhs', declaredSource: r.name_source ?? 'MTGZH（未細分名稱來源）',
    sourceFile: 'zhs_oracle.json', sourceLine: line, sourceUrl: manifest.releaseUrl,
    oracleId: r.oracle_id, faceOracleId: r.face_oracle_id, set: r.set, number: r.collector_number,
    stage: r.name_stage, released: r.released_at,
  }, '10');
}

function faces(english, translated, faceEnglish, faceChinese, fields, priority) {
  candidate(english, translated, fields, priority);
  const a = english.split(' // '), b = translated?.split(' // ') ?? [];
  if (a.length > 1 && a.length === b.length) for (let i = 0; i < a.length; i++) candidate(a[i], b[i], fields, priority);
  if (faceEnglish && faceChinese) {
    const parts = faceChinese.split(' // ');
    const face = parts.length === 1 ? faceChinese : parts[a.indexOf(faceEnglish)];
    candidate(faceEnglish, face, fields, priority);
  }
}

for await (const { row: r, line } of records('scryfall_card.json')) {
  if (!r.name || ![r.name, r.face_name, ...r.name.split(' // ')].some(isWanted)) continue;
  matchedPrints.set(r.uuid, r);
  if (!['zht', 'zhs'].includes(r.lang)) continue;
  const fields = {
    kind: 'published', language: r.lang, declaredSource: r.lang === 'zht' ? 'Chinese Traditional' : 'Chinese Simplified',
    sourceFile: 'scryfall_card.json', sourceLine: line, sourceUrl: manifest.releaseUrl,
    scryfallId: r.scryfall_id, ...(r.multiverse_id ? { multiverseId: String(r.multiverse_id) } : {}),
    set: r.set_code, number: r.collector_number, released: r.released_at,
  };
  faces(r.name, r.printed_name, r.face_name, r.printed_name, fields, r.lang === 'zht' ? '40' : '30');
}

for await (const { row: r, line } of records('zhs_card.json')) {
  const card = matchedPrints.get(r.card_id);
  if (!card || (!r.name && !r.face_name) || !r.source || ai.test(r.source)) continue;
  const isPrint = ['Chinese Traditional', 'Chinese Simplified'].includes(r.source);
  const printLanguage = r.source === 'Chinese Traditional' ? 'zht' : 'zhs';
  // zhs_card is normalized to Simplified even when the originating printing
  // was Traditional. Preserve that distinction; do not label these stored
  // characters as an untouched Traditional printing.
  const language = 'zhs';
  const fields = {
    kind: isPrint ? 'published' : 'database', language, ...(isPrint ? { printLanguage } : {}), declaredSource: r.source,
    sourceFile: 'zhs_card.json', sourceLine: line, sourceUrl: manifest.releaseUrl,
    scryfallId: card.scryfall_id, ...(r.multiverse_id ? { multiverseId: String(r.multiverse_id) } : {}),
    set: card.set_code, number: card.collector_number, released: card.released_at,
  };
  faces(card.name, r.name, card.face_name, r.face_name, fields, isPrint ? printLanguage === 'zht' ? '35' : '30' : '20');
}

// Names deliberately added to distinguish game tokens are mapped to their
// actual token identity, or explicitly to a database subtype term.
const terms = new Map();
for await (const { row: r, line } of records('zhs_type.json')) if (r.stage > 0 && han.test(r.translation ?? '')) terms.set(r.type_name.toLowerCase(), {
  name: traditional(r.translation), sourceName: r.type_name, originalChinese: r.translation,
  kind: 'terminology', language: 'zhs', declaredSource: 'MTGZH 類別術語',
  sourceFile: 'zhs_type.json', sourceLine: line, sourceUrl: manifest.releaseUrl, stage: r.stage,
});

async function aliasRecord(alias) {
  if (alias.terminology) return terms.get(alias.sourceName.toLowerCase());
  if (!alias.textIncludes) return selected.get(alias.sourceName.toLowerCase());
  // Match the ability as well as the generic token name.
  for await (const { row: r, line } of records('zhs_oracle.json')) {
    if (r.name !== alias.sourceName || !r.oracle_text?.includes(alias.textIncludes) || !r.translated_name || !(r.name_stage > 0) || ai.test(r.name_source ?? '')) continue;
    return {
      name: traditional(r.translated_name), sourceName: r.name, originalChinese: r.translated_name,
      kind: 'database', language: 'zhs', declaredSource: r.name_source ?? 'MTGZH（未細分名稱來源）',
      sourceFile: 'zhs_oracle.json', sourceLine: line, sourceUrl: manifest.releaseUrl,
      oracleId: r.oracle_id, faceOracleId: r.face_oracle_id, set: r.set, number: r.collector_number, stage: r.name_stage,
    };
  }
}

for (const [name, alias] of Object.entries(aliases.byName)) {
  const source = await aliasRecord(alias);
  if (!source) throw new Error(`Unmatched alias: ${name}`);
  selected.set(name.toLowerCase(), { ...source, aliasReason: alias.reason });
}
const byId = {};
for (const [id, alias] of Object.entries(aliases.byId)) {
  const source = await aliasRecord(alias);
  if (!source) throw new Error(`Unmatched token id: ${id}`);
  byId[id] = { ...source, aliasReason: alias.reason };
}

// Some token Oracle names remain English in the upstream export, while their
// exact subtype name is translated in its maintained terminology table.
for (const card of input) {
  const key = card.name.toLowerCase();
  if ((card.token || card.set === 'TOK') && !published[key] && !selected.has(key) && terms.has(key)) selected.set(key, terms.get(key));
}

for (const card of input) {
  const key = card.name.toLowerCase();
  if (published[key] || selected.has(key)) continue;
  const parts = card.name.split(' // ');
  if (parts.length < 2) continue;
  const sources = parts.map(n => selected.get(n.toLowerCase()));
  if (!sources.every(Boolean)) continue;
  selected.set(key, {
    name: sources.map(s => s.name).join(' // '), sourceName: card.name,
    originalChinese: sources.map(s => s.originalChinese).join(' // '),
    kind: 'database', language: 'zhs', declaredSource: 'MTGZH（各門逐面對照）',
    sourceFile: sources[0].sourceFile, sourceLine: sources[0].sourceLine, sourceUrl: manifest.releaseUrl,
    components: sources.map(s => ({ sourceName: s.sourceName, sourceFile: s.sourceFile, sourceLine: s.sourceLine, faceOracleId: s.faceOracleId })),
  });
}

const ordered = entries => Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b, 'en')));
const names = ordered([...selected].filter(([key]) => isWanted(key) && !published[key]));
await writeFile('src/data/localization/zh-sourced-names.json', JSON.stringify(names, null, 2) + '\n');
await writeFile('src/data/localization/zh-token-name-overrides.json', JSON.stringify(ordered(Object.entries(byId)), null, 2) + '\n');
const missing = input.filter(c => !published[c.name.toLowerCase()] && !names[c.name.toLowerCase()] && !byId[c.id]);
console.log(JSON.stringify({ added: Object.keys(names).length, tokenIdOverrides: Object.keys(byId).length, missingNames: [...new Set(missing.map(c => c.name))], rejectedAi: rejected.length }));
