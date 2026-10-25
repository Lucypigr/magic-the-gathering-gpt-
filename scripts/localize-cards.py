#!/usr/bin/env python3
"""Build offline Traditional Chinese display text. Does not modify engine definitions.
Run node scripts/export-card-text.mjs && python scripts/localize-cards.py.
"""
import json,re,pathlib,importlib.util,collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('gen',ROOT/'scripts/gen_cards.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
def tsv(name):
 return {k:(''if v=='∅'else v) for l in (ROOT/'scripts/localization'/name).read_text().splitlines() if l.strip() and not l.startswith('#') for k,v in [l.split('\t',1)]}
words=tsv('words.tsv');phrases=tsv('phrases.tsv')
i18n=(ROOT/'src/ui/i18n.ts').read_text()
for en,zh in re.findall(r"^\s+([A-Z][A-Za-z]+): '([^']+)',$",i18n,re.M):
 g.SUBZH[en]=zh;words.setdefault(en.lower(),zh);words.setdefault(en.lower()+'s',zh)
for plural,singular in g.SINGULAR.items():words[plural.lower()]=words.get(singular.lower(),singular)
for en,(_,zh)in g.KW.items():words[en]=zh
cards=json.loads(pathlib.Path('/tmp/translation-cards.json').read_text())
# Exact translations already emitted by the strict, complete-rule converter.
exact={}
for path in (ROOT/'src/data/sets/gen').glob('*.ts'):
 for line in path.read_text().splitlines():
  m=re.match(r'add\((\{.*\})\);$',line)
  if m:
   try:
    c=json.loads(m[1]);exact.setdefault(c['name'],c.get('text',''))
   except ValueError:pass
# Longest phrases first. One pass prevents a short phrase changing a longer match.
phrase_re=re.compile(r'(?<![A-Za-z])(?:'+'|'.join(re.escape(p)for p in sorted(phrases,key=len,reverse=True))+r')(?![A-Za-z])',re.I)
known_names={c.get('name','')for c in cards}
unknown=collections.Counter()
named_overrides=json.loads((ROOT/'scripts/localization/cards.json').read_text())
sourced_rules={**json.loads((ROOT/'scripts/localization/blb-dft-rules.json').read_text()),**json.loads((ROOT/'scripts/localization/lci-sos-rules.json').read_text())}
room_translations=json.loads((ROOT/'scripts/localization/rooms.json').read_text())
room_reminder='房間：你可以施放任一半邊，該門於戰場上解鎖。你也可以於巫術時機支付尚未解鎖之門的法術力費用來解鎖該門。'
for card in json.loads((ROOT/'src/data/sets/dsk-catalog.json').read_text()):
 if str(card['number'])in room_translations:
  left,lt,right,rt=room_translations[str(card['number'])]
  named_overrides[card['name']]=room_reminder+'\n'+left+'—'+lt+'\n'+right+'—'+rt
  named_overrides[card['room']['left']['name']]=left+'—'+lt+'\n'+room_reminder
  named_overrides[card['room']['right']['name']]=right+'—'+rt+'\n'+room_reminder
rule_overrides=json.loads((ROOT/'scripts/localization/overrides.json').read_text())
def clean(s):
 s=re.sub(r' +',' ',s).strip()
 return re.sub(r'\s*([，。、：；（）])\s*',r'\1',s)
def fallback(s):
 # Preserve mana symbols, numerical variables, and quoted card names.
 saved=[]
 def hold(m):saved.append(m.group(0));return chr(0xe000+len(saved)-1)
 s=re.sub(r'\{[^}]+\}|\b[XYZ]\b',hold,s)
 # Keep the scope of control/ownership on its noun, rather than translating
 # English postmodifiers in place and changing what a target restriction means.
 s=re.sub(r'\b((?:(?:target|other|another|each|any|a|an|one|two|nonland|nontoken|untapped|tapped|legendary|nonlegendary)\s+)*(?:[A-Za-z]+\s+)?(?:creatures?|permanents?|artifacts?|enchantments?|lands?|spells?|tokens?|cards?))\s+(you control|you don\'t control|an opponent controls|your opponents control)\b',lambda m:({'you control':'由你操控的',"you don't control":'非由你操控的','an opponent controls':'由對手操控的','your opponents control':'由對手操控的'}[m[2]]+m[1]),s,flags=re.I)
 s=phrase_re.sub(lambda m:phrases[m[0].lower()]if m[0].lower()in phrases else next(v for k,v in phrases.items()if k.lower()==m[0].lower()),s)
 def word(m):
  x=m[0];key=x.lower()
  if key in words:return words[key]
  if key in ['i','ii','iii','iv','v','vi']:return key.upper()
  unknown[key]+=1
  return x
 s=re.sub(r"[A-Za-z]+(?:'[A-Za-z]+)?",word,s)
 s=re.sub(r'(?<=[\u3400-\u9fff\ue000-\uf8ff0-9+/-])\s+(?=[\u3400-\u9fff\ue000-\uf8ff0-9+/-])','',s)
 s=s.replace(',','，').replace('.','。').replace(':','：').replace(';','；')
 for i,x in enumerate(saved):s=s.replace(chr(0xe000+i),x)
 return clean(s).replace('。。','。').replace('是已造成的傷害','受到傷害').replace('進場已橫置的','須橫置進場').replace('你具有沒有','你沒有').replace('在它上','在其上').replace('二暈眩指示物','兩個暈眩指示物').replace('一個+1/+1指示物','一個+1/+1指示物').replace('由你操控的的','由你操控的').replace('等量的張牌','等量的牌').replace('等量的點生命','等量生命').replace('兩倍數量的的','兩倍數量的').replace('兩張牌張牌','兩張牌')
def noun(s):
 s=s.strip().strip('.')
 if s in ('it','them','you','they','he','she','him','her','此牌','this creature','this spell'):return fallback(s)
 # Determiners and English postmodifiers have distinct scopes.
 prefix='';suffix=''
 for en,zh in [('any number of ','任意數量的'),('up to one ','至多一個'),('up to two ','至多兩個'),('one or more ','一個或更多'),('each other ','每個其他'),('any other ','任意其他'),('another target ','另一個目標'),('target ','目標'),('another ','另一個'),('other ','其他'),('each ','每個'),('all ','所有')]:
  if s.lower().startswith(en):prefix=zh;s=s[len(en):];break
 for en,zh in [("you don't control",'非由你操控的'),('an opponent controls','由對手操控的'),('your opponents control','由對手操控的'),('you control','由你操控的'),('you own','由你擁有的')]:
  m=re.search(r'\s+'+re.escape(en)+r'(?=\s|$)',s,re.I)
  if m:s=s[:m.start()]+s[m.end():];prefix+=zh;break
 m=re.search(r' in (your|their|a|an opponent\'s) (graveyard|hand|library|exile)$',s,re.I)
 if m:prefix+=fallback(m[1]+' '+m[2])+'中的';s=s[:m.start()]
 m=re.search(r' with (power|toughness|mana value) (.+)$',s,re.I)
 if m:prefix+=fallback(m[1]+' '+m[2])+'的';s=s[:m.start()]
 m=re.search(r' without (.+)$',s,re.I)
 if m:prefix+='不具'+fallback(m[1])+'的';s=s[:m.start()]
 m=re.search(r' named (.+)$',s,re.I)
 if m and m[1]in known_names:prefix+='名為《'+m[1]+'》的';s=s[:m.start()]
 # Negation stays on the subtype it modifies.
 s=re.sub(r'non-([A-Za-z]+)',lambda m:'非'+fallback(m[1]),s)
 return prefix+fallback(s)+suffix

def grammar(s,c):
 # Small, compositional rules for Oracle's subject / predicate grammar.
 # Unsupported predicates remain visible in the review report, never silently
 # drop a condition, target, quantity, or a negation.
 m=re.match(r'^(.+?) (?:deals?|deal) (.+?) damage to (.+)$',s,re.I)
 if m:return noun(m[1])+'對'+noun(m[3])+'造成'+fallback(m[2])+'點傷害'
 m=re.match(r'^(.+?) (gains?|loses?) (.+?) life$',s,re.I)
 if m:return noun(m[1])+('獲得'if m[2].lower().startswith('gain')else'失去')+fallback(m[3])+'點生命'
 m=re.match(r'^(?:draw|draws) (.+?) cards?$',s,re.I)
 if m:return '抓'+fallback(m[1])+'張牌'
 m=re.match(r'^(.+?) draws? (.+?) cards?$',s,re.I)
 if m:return noun(m[1])+'抓'+fallback(m[2])+'張牌'
 m=re.match(r'^(?:discard|discards) (.+?) cards?$',s,re.I)
 if m:return '棄'+fallback(m[1])+'張牌'
 m=re.match(r'^(.+?) discards? (.+?) cards?$',s,re.I)
 if m:return noun(m[1])+'棄'+fallback(m[2])+'張牌'
 m=re.match(r'^(?:put|puts) (.+?) counters? on (.+)$',s,re.I)
 if m:return '在'+noun(m[2])+'上放置'+fallback(m[1])+'指示物'
 m=re.match(r'^(?:remove|removes) (.+?) counters? from (.+)$',s,re.I)
 if m:return '從'+noun(m[2])+'上移去'+fallback(m[1])+'指示物'
 m=re.match(r'^(?:return|returns) (.+?) (?:to|onto) (.+)$',s,re.I)
 if m:return '將'+noun(m[1])+'移回'+fallback(m[2])
 m=re.match(r'^(.+?) (?:get|gets) ([+-][0-9X]+/[+-][0-9X]+) for each (.+)$',s,re.I)
 if m:return '每有一個'+noun(m[3])+'，'+noun(m[1])+'便得'+m[2]
 m=re.match(r'^(.+?) (?:get|gets) (.+)$',s,re.I)
 if m:return noun(m[1])+'得'+fragment(m[2],c)
 m=re.match(r'^(.+?) (?:have|has) base power and toughness each equal to the number of (.+)$',s,re.I)
 if m:return noun(m[1])+'的基礎力量與防禦力各等同於'+noun(m[2])+'的數量'
 m=re.match(r'^(.+?) (?:have|has) (.+)$',s,re.I)
 if m:return noun(m[1])+'具有'+fragment(m[2],c)
 m=re.match(r'^(?:you may |you can )(.+)$',s,re.I)
 if m:return '你可以'+fragment(m[1],c)
 m=re.match(r'^(.+?) (?:gain|gains) (.+)$',s,re.I)
 if m:return noun(m[1])+'獲得'+fragment(m[2],c)
 m=re.match(r'^(?:you control|you own) (.+)$',s,re.I)
 if m:return ('你操控'if s.lower().startswith('you control')else'你擁有')+noun(m[1])
 m=re.match(r'^(.+?) (enters|dies|attacks|leaves the battlefield)$',s,re.I)
 if m:return noun(m[1])+fallback(m[2])
 m=re.match(r'^(destroy|exile|tap|untap|sacrifice|counter) (.+)$',s,re.I)
 if m:return {'destroy':'消滅','exile':'放逐','tap':'橫置','untap':'重置','sacrifice':'犧牲','counter':'反擊'}[m[1].lower()]+noun(m[2])
 m=re.match(r'^(.+?) (can\'t attack or block|can\'t be blocked|can\'t attack|can\'t block|can\'t be countered)(.*)$',s,re.I)
 if m:return noun(m[1])+fallback(m[2])+fragment(m[3],c)
 return None

def fragment(s,c):
 s=s.strip().rstrip('.').strip()
 if not s:return ''
 split=g.split_sentences(s)
 if len(split)>1:return '。'.join(fragment(x,c).rstrip('。')for x in split)
 multi=re.match(r'^(.*?) and ((?:you|each player|each opponent|that player|its controller) (?:gain|lose|draw|discard|create|may|get|sacrifice).*)$',s,re.I)
 if multi:return fragment(multi[1],c)+'，且'+fragment(multi[2],c)
 cost=re.match(r'^([^:]+): (.+)$',s,re.S)
 if cost:return fallback(cost[1])+'：'+fragment(cost[2],c)
 if s.startswith('Then '):return '然後'+fragment(s[5:],c)
 if s.startswith('then '):return '然後'+fragment(s[5:],c)
 if s.startswith('•'):return '• '+fragment(s[1:],c)
 loyalty=re.match(r'^\[([+−-]?\d+)\]: (.+)$',s,re.S)
 if loyalty:return loyalty[1]+'：'+fragment(loyalty[2],c)
 try:
  _,zh=g.effects_of(s.replace('此牌','SELF'),g.Ctx('spell','此牌'));return zh
 except (g.Unsupported,KeyError,ValueError,IndexError):pass
 # Recursive clause boundaries keep conditions separate from their effects.
 for en,zh in [('Whenever ','每當'),('When ','當'),('If ','如果')]:
  if s.lower().startswith(en.lower())and ', 'in s:
   cond,body=s[len(en):].split(', ',1)
   if cond.lower()in['you do','you don\'t']:return ('若你如此作'if cond.lower()=='you do'else'若你未如此作')+'，'+fragment(body,c)
   return zh+fragment(cond,c)+('時'if en!='If 'else'')+'，'+fragment(body,c)
 m=re.match(r'^(.*?),\s*(then .+)$',s,re.I)
 if m:return fragment(m[1],c)+'，'+fragment(m[2],c)
 m=re.match(r'^(.*?)(?:\.\s+)(.+)$',s,re.S)
 if m:return fragment(m[1],c)+'。'+fragment(m[2],c)
 result=grammar(s,c)
 return result if result is not None else fallback(s)
def translate(c):
 raw=c.get('text','')
 if not raw or re.search('[\u3400-\u9fff]',raw):return raw
 if c.get('name')in sourced_rules and c.get('text')==sourced_rules[c['name']]['oracleText']:return sourced_rules[c['name']]['text']
 if c.get('name')in named_overrides:return named_overrides[c['name']]
 if raw in rule_overrides:return rule_overrides[raw]
 name=c.get('name','')
 sc={'name':name,'set':c.get('set','CORE').lower(),'rarity':{'C':'common','U':'uncommon','R':'rare','M':'mythic','T':'common','L':'common'}.get(c.get('rarity'),'common'),'layout':'normal','mana_cost':c.get('cost')or'{0}','type_line':' '.join(c.get('types')or['Creature'])+(' — '+' '.join(c['subtypes'])if c.get('subtypes')else''),'oracle_text':raw,'power':str(c.get('power',0)),'toughness':str(c.get('toughness',1)),'keywords':[]}
 try:
  result=g.convert_face(sc)
  if result.get('text'):return result['text']
 except (g.Unsupported,KeyError,ValueError,IndexError):pass
 if name in exact and exact[name]:return exact[name]
 text=raw.replace(name,'SELF')if name else raw
 if name and ','in name:text=re.sub(r'\b'+re.escape(name.split(',')[0])+r'\b','SELF',text)
 text=re.sub(r'\(([^()]*)\)',lambda m:m[1]if m[1].strip().startswith('{T}')else'',text)
 text=re.sub(r'\(([^()]*)\)',lambda m:m[1]if m[1].strip().startswith('{T}')else'',text)
 # A source's name in a "named" restriction is an actual name, not a pronoun.
 text=re.sub(r'\bnamed SELF\b',lambda _: 'named '+name,text)
 text=re.sub(r'\bSELF\b','此牌',text)
 out=[]
 for line in text.splitlines():
  line=line.strip()
  if not line:continue
  if line in rule_overrides:out.append(rule_overrides[line]);continue
  sc={'name':name,'set':c.get('set','core').lower(),'rarity':{'C':'common','U':'uncommon','R':'rare','M':'mythic','T':'common','L':'common'}.get(c.get('rarity'),'common'),'layout':'normal','mana_cost':c.get('cost')or'{0}','type_line':' '.join(c.get('types')or['Creature'])+(' — '+' '.join(c['subtypes'])if c.get('subtypes')else''),'oracle_text':line.replace('此牌','SELF'),'power':str(c.get('power',0)),'toughness':str(c.get('toughness',1)),'keywords':[]}
  try:
   result=g.convert_face(sc)
   zh=result['text']
   if zh and not re.search(r'\bSELF\b',zh):out.append(zh);continue
  except (g.Unsupported,KeyError,ValueError,IndexError):pass
  out.append(fragment(line,c).replace('。。','。'))
 return '\n'.join(x if x.endswith(('。','—','）','：'))else x+'。'for x in out)
result={}
for c in cards:
 raw=c.get('text','')
 if raw and not re.search('[\u3400-\u9fff]',raw):result.setdefault(raw,translate(c))
(ROOT/'src/data/localization/zh-rules.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
pathlib.Path('/tmp/localization-unknown.txt').write_text('\n'.join(f'{k}\t{v}'for k,v in unknown.most_common()))
pathlib.Path('/tmp/localization-review.txt').write_text('\n\n'.join(c['name']+'\n'+c.get('text','')+'\n=>'+result.get(c.get('text',''),'')for c in cards if c.get('text','')in result))
print('Translated rule texts:',len(result),'Unmapped vocabulary:',len(unknown))
