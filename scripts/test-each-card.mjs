import { createServer } from 'vite';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const arg = name => process.argv.find(x => x.startsWith(name + '='))?.slice(name.length + 1);
const set = arg('--set')?.toUpperCase(), name = arg('--name');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { auditCard, faces } = await server.ssrLoadModule('/tests/card-audit-runner.ts');
  const results = [];
  const catalogFiles = readdirSync('src/data/sets').filter(f => f.endsWith('-catalog.json')).sort();
  const sourceHashes = Object.fromEntries(catalogFiles.map(f => [f, createHash('sha256').update(readFileSync('src/data/sets/' + f)).digest('hex')]));
  const rows = catalogFiles
    .flatMap(f => JSON.parse(readFileSync('src/data/sets/' + f)))
    .filter(r => (!set || r.set === set) && (!name || r.name.toLowerCase().includes(name.toLowerCase())));
  let done = 0;
  for (const row of rows) {
    for (const face of faces(row)) results.push(auditCard(face.row, face.def, face.face));
    if (++done % 100 === 0) console.log('Checked ' + done + '/' + rows.length + ' printings');
  }
  const failures = results.flatMap(r => ['data', 'rules', 'execution'].flatMap(category => r[category].filter(c => c.status === 'fail').map(c => ({ set: r.set, number: r.number, name: r.name, face: r.face, category, check: c.name, status: c.status, detail: c.detail }))));
  const summary = {
    sets: new Set(rows.map(r => r.set)).size, printings: rows.length, faces: results.length,
    uniqueNames: new Set(rows.map(r => r.name)).size,
    dataFailures: failures.filter(f => f.category === 'data').length,
    ruleFailures: failures.filter(f => f.category === 'rules').length,
    executionFailures: failures.filter(f => f.category === 'execution').length,
    ruleAssertions: results.reduce((n, r) => n + r.rules.length, 0),
    facesWithUnverifiedRules: results.filter(r => r.remainingRules.length).length,
    blockedProbes: results.reduce((n, r) => n + r.execution.filter(c => c.status === 'blocked').length, 0),
    facesWithoutExecutedProbe: results.filter(r => !r.execution.some(c => c.status === 'pass')).length,
    successfulExecutionProbes: results.reduce((n, r) => n + r.execution.filter(c => c.status === 'pass').length, 0),
  };
  const report = { scope: 'Preserved source catalogs; isolated face probes are not a proof of official-rule equivalence.', sourceHashes, summary, failures, results };
  const output = arg('--output') ?? 'docs/per-card-tests' + (set ? '-' + set.toLowerCase() : name ? '-filtered' : '');
  if (process.argv.includes('--write')) {
    const { results: cases, ...header } = report;
    writeFileSync(output + '.json', JSON.stringify(header, null, 2).replace(/\n}$/, ',\n  "results": [\n') + cases.map(r => '    ' + JSON.stringify(r)).join(',\n') + '\n  ]\n}\n');
    const quote = s => '"' + String(s ?? '').replaceAll('"', '""') + '"';
    writeFileSync(output + '.csv', '\uFEFF' + ['set,number,name,face,data_failures,rule_assertions,rule_failures,execution_passes,execution_failures,blocked_probes,unverified_rule_lines', ...results.map(r => [r.set, r.number, r.name, r.face, r.data.filter(c => c.status === 'fail').length, r.rules.length, r.rules.filter(c => c.status === 'fail').length, r.execution.filter(c => c.status === 'pass').length, r.execution.filter(c => c.status === 'fail').length, r.execution.filter(c => c.status === 'blocked').length, r.remainingRules.length].map(quote).join(','))].join('\n') + '\n');
    const basename = output.split('/').at(-1), md = [
      '# 逐卡測試記錄', '',
      `範圍：${summary.sets} 系列卡表中的 ${summary.printings} 筆主卡記錄（${summary.uniqueNames} 個不同名稱），連同背面、冒險、準備及密室牌面，共 ${summary.faces} 筆牌面測試。來源是倉庫保留的原始卡表；JSON 內記錄 SHA-256。本輪未重新查詢官方最新勘誤。`, '',
      `- 基本資料／中文檢查失敗：${summary.dataFailures}。`,
      `- 依原文建立的規則斷言：${summary.ruleAssertions}；失敗 ${summary.ruleFailures}。`,
      `- 成功的執行探測：${summary.successfulExecutionProbes}；執行錯誤 ${summary.executionFailures}。`,
      `- 測試場景未滿足條件的探測：${summary.blockedProbes}；其中 ${summary.facesWithoutExecutedProbe} 個牌面尚無成功的執行探測。`,
      `- ${summary.facesWithUnverifiedRules} 個牌面仍有原文句子尚未建立獨立效果斷言。`, '',
      '**逐卡跑過基本與執行檢查，不代表每張卡的完整官方效果已驗證。** 上述「未滿足條件」不算通過；未建立斷言的原文保留在 JSON 的 remainingRules。額外牌面的隔離測試也不驗證取得、轉化或施放該牌面的所有前置條件。', '',
      '## 方法', '',
      '基本資料逐欄比對來源費用、類別、顏色及身材等，並檢查中文效果是否存在。規則斷言從來源英文的嚴格語法建立，不以引擎的效果定義當作預期答案；涵蓋印刷關鍵字／果敢次數、一般法術力報價，以及可解析的抓牌、進場抓牌、傷害、消滅、放逐、強化持續時間和御土合約。減費、額外費用及奮力等複雜費用不套用一般報價斷言。', '',
      '執行探測透過公開施放、起動及結算流程，檢查模式、進場、常見步驟觸發與死亡。固定場景不足時增加目標、衍生物、待反擊咒語及費用材料；仍不足的情境列為 blocked。每次結算檢查區域清單、重複物件與有限數值。這些探測驗證能執行及狀態完整性，不能代替每一條效果的獨立預期結果。', '',
      '測試工具本身有反例測試：故意將抓兩張改成抓一張或移除飛行，必須偵測失敗；負向強化的測試生物也會按數值調整防禦力，避免讀取死亡後已重設的身材而誤判。', '',
      '## 未通過項目', '',
      '| 系列／編號 | 牌名／牌面 | 類別 | 結果 |', '|---|---|---|---|',
      ...failures.map(f => `| ${f.set} ${f.number} | ${f.name.replaceAll('|', '\\|')} (${f.face}) | ${f.category} | ${(f.detail ?? f.check).replaceAll('\n', ' ').replaceAll('|', '\\|')} |`), '',
      '御土失敗表示原有引擎仍派出衍生物，未依正式規則使已有的地變成生物；詳見 [原有差異](tla.md)。這是已確認的功能差異，並未因回歸測試通過而消失。', '',
      '## 本輪已修正', '',
      '- Empyrean Eagle、Air Nomad Legacy、Bristlepack Sentry 的條件式持續效果會重入身材計算，造成堆疊溢位；改為使用進行中的計算快照，結束後清除，並測試移除效果、兩隻雄鷹及指示物變化。這不代表已實作完整官方層次／依賴規則。',
      '- Krang, Utrom Warlord 補回自身不滅。Woodland Acolyte 補回進場抓一張牌。Thor Odinson 移除多算的第三次果敢加成。',
      '- MKM 五張連體牌的另一半不再帶有錯誤的 Adventure 副類別。',
      '- Focus Fire 的傷害計算補回系列前綴，避免結算時出現 Unknown frontier amount。',
      '- 中文匯出涵蓋 prepare 牌面；補回 SOS 34 個準備牌面的中文效果，並加入全卡中文回歸檢查。', '',
      '## 重跑與檢閱', '',
      '`npm run test:cards` 會重建這份記錄、JSON 及 CSV。存在確認失敗時以 exit code 1 結束；一般 npm test 的回歸通過不代表此診斷也通過。單一系列可使用 `npm run test:cards -- --set=SPM`，其報告另存，不覆蓋全系列記錄。', '',
      `[逐張 CSV](${basename}.csv) · [詳細 JSON](${basename}.json)`, '',
      '只修改 GPT 專案，原專案與卡圖未變動。', '',
    ];
    writeFileSync(output + '.md', md.join('\n'));
  }
  console.log(JSON.stringify(summary));
  for (const f of failures.slice(0, 30)) console.log(JSON.stringify(f));
  if (failures.length) process.exitCode = 1;
} finally { await server.close(); }
