import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { CARDS, TOKENS, COLLECTIBLE } = await server.ssrLoadModule('/src/data/index.ts');
  const { displayName, setCardLanguage, publishedChineseName, sourcedChineseName } = await server.ssrLoadModule('/src/data/names.ts');
  const printSource = JSON.parse(await readFile('scripts/localization/name-sources.json', 'utf8'));
  const dbSource = JSON.parse(await readFile('scripts/localization/mtgzh-name-source.json', 'utf8'));
  const netdecks = JSON.parse(await readFile('public/netdecks.json', 'utf8'));
  setCardLanguage(true);
  const rows = [];
  function visit(card, role, path, parent) {
    const print = publishedChineseName(card);
    const db = sourcedChineseName(card);
    const name = displayName(card);
    const source = print ?? db;
    rows.push({
      id: path, set: card.set ?? parent?.set ?? '', role, english: card.name, chinese: name,
      kind: print ? 'published' : db?.kind ?? 'unresolved',
      provider: print ? 'MTGJSON 中文印刷資料' : db?.declaredSource ?? '',
      sourceIdentity: db?.faceOracleId ?? db?.scryfallId ?? print?.scryfallId ?? '',
      sourceFile: print?.sourceFile ?? (db ? `${db.sourceFile}:${db.sourceLine}` : ''),
      sourceUrl: print ? `https://github.com/${printSource.repository}/blob/${printSource.revision}/${printSource.directory}/${print.sourceFile}` : db?.sourceUrl ?? '',
      aliasReason: db?.aliasReason ?? '',
      sourced: Boolean(source && /[\u3400-\u9fff]/.test(name)),
    });
    for (const key of ['back', 'adventure', 'copyFront']) if (card[key]) visit(card[key], key, `${path}#${key}`, card);
    if (card.room) for (const key of ['left', 'right']) visit(card.room[key], `room-${key}`, `${path}#room-${key}`, card);
  }
  for (const card of CARDS) visit(card, 'card', card.id);
  for (const card of TOKENS) visit(card, 'token', card.id);
  const bySet = {};
  for (const row of rows.filter(r => r.role === 'card')) {
    const total = bySet[row.set] ??= { cards: 0, translated: 0, published: 0, database: 0, terminology: 0 };
    total.cards++;
    if (row.sourced) total.translated++;
    if (row.kind in total) total[row.kind]++;
  }
  const summary = {
    cards: CARDS.length, collectibleCards: COLLECTIBLE.length, tokens: TOKENS.length,
    additionalFaces: rows.length - CARDS.length - TOKENS.length,
    totalRows: rows.length, uniqueEnglishNames: new Set(rows.map(r => r.english.toLowerCase())).size,
    translatedRows: rows.filter(r => r.sourced).length,
    unresolved: rows.filter(r => !r.sourced).map(r => ({ id: r.id, name: r.english })),
    counts: Object.fromEntries(['published', 'database', 'terminology'].map(k => [k, rows.filter(r => r.kind === k).length])),
    bySet, databaseRelease: dbSource.release, sourceArchiveSha256: dbSource.archiveSha256,
  };
  const importedNames = [...new Set(netdecks.decks.flatMap(d => [...d.main, ...d.side].map(([, name]) => name)))];
  summary.importedDeckNames = importedNames.length;
  summary.unresolvedImportedDeckNames = importedNames.filter(name => !publishedChineseName({ name }) && !sourcedChineseName({ name }));
  await writeFile('docs/card-name-audit.json', JSON.stringify(summary, null, 2) + '\n');
  const columns = ['id', 'set', 'role', 'english', 'chinese', 'kind', 'provider', 'sourceIdentity', 'sourceFile', 'sourceUrl', 'aliasReason'];
  const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  await writeFile('docs/card-name-audit.csv', '\ufeff' + [columns.join(','), ...rows.map(r => columns.map(k => csv(r[k])).join(','))].join('\n') + '\n');
  const lines = [
    '# 全卡池中文名稱核對', '',
    `目前卡池：**${summary.cards} 張卡**（可收藏 ${summary.collectibleCards} 張）、**${summary.tokens} 個衍生物／徽記定義**。`, '',
    '數量依目前遊戲執行時的定義計算，不能直接與官網各系列不同印刷版本的數量相加比較。', '',
    `另含 ${summary.additionalFaces} 個背面、冒險、房間門或複製正面，共 **${summary.totalRows} 筆逐面紀錄**，${summary.uniqueEnglishNames} 個不同英文名稱。`, '',
    `已取得有來源的中文名稱：**${summary.translatedRows}/${summary.totalRows}**；缺少來源：**${summary.unresolved.length}**。`, '',
    `另檢查熱門牌表的 ${summary.importedDeckNames} 個名稱（包含尚未收錄的原牌與備牌），缺少對照 ${summary.unresolvedImportedDeckNames.length} 個。牌表省略重音或使用單斜線時，僅在顯示查詢時正規化；不改英文引擎識別。`, '',
    '| 卡片所屬系列 | 卡片數 | 有來源中文名 | 出版紀錄 | 中文卡庫 | 類別術語 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(bySet).map(([set, n]) => `| ${set} | ${n.cards} | ${n.translated} | ${n.published} | ${n.database} | ${n.terminology} |`), '',
    '完整清單：[逐卡及逐面 CSV](card-name-audit.csv)；[統計 JSON](card-name-audit.json)。CSV 保留英文、中文、卡片 ID、系列、來源分類、資料檔行號與來源識別碼。', '',
    `來源：[MTGJSON 印刷資料](https://github.com/${printSource.repository}/tree/${printSource.revision}/${printSource.directory})及 [MTGZH 中文卡庫公開快照](${dbSource.releaseUrl})。`, '',
    '這是程式逐筆比對英文身份、牌面與卡庫紀錄，不宣稱逐張人工訪問官網。已有的繁體出版名稱優先；簡體來源只轉為繁體字。MTGZH、MTGso 及來源未細分的卡庫名稱均保留其性質，不當成官方印刷譯名。標示 GPT/AI 的名稱與未審定 stage 0 名稱不採用。', '',
    '房間兩門分別對照後才組合。同名的兩種 Chandra Emblem 依遊戲 ID 分別對應抓牌徽記與5點傷害徽記；御火士兵、御火龍及 Role 的遊戲別名對照保存在 scripts/localization/name-aliases.json。衍生物術語對照另標示，沒有冒充同名印刷卡。', '',
    '英文原名、卡圖及卡片機制不變。每次新增卡片後重新生成此報告，不能沿用舊的完成率。', '',
  ];
  await writeFile('docs/card-name-audit.md', lines.join('\n'));
  console.log(JSON.stringify(summary));
  if (summary.unresolved.length || summary.unresolvedImportedDeckNames.length) process.exitCode = 1;
} finally { await server.close(); }
