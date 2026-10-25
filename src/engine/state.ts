import {frontierStatic,frontierBaseStats,frontierStats,frontierCondition,enchanted} from './frontier-support';
import {mshApplyStats,mshBaseStats,mshCondition} from './msh-support';
import {mkmApplyStats,mkmBaseStats,mkmCondition,mkmStatic} from './mkm-support';
import {finApplyStats,finBaseStats,finCondition} from './fin-support';
import { displayName } from '../data/names';
import { colorsOf, manaValue } from './mana';
import { getDef } from './registry';
import type {
  Ability,
  Card,
  CardDef,
  CardType,
  Cond,
  Filter,
  GameEvent,
  GameState,
  Grant,
  Keyword,
  LogEntry,
  PID,
  Player,
  Show,
  TargetRef,
} from './types';

export class GameOver extends Error {
  constructor() {
    super('game over');
  }
}

export const other = (p: PID): PID => (p === 0 ? 1 : 0);

// ------------------------------------------------------------
// 亂數（可重現，AI 模擬時可複製狀態）
// ------------------------------------------------------------
export function rand(g: GameState): number {
  let t = (g.rngState = (g.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(g: GameState, n: number): number {
  return Math.floor(rand(g) * n);
}

export function shuffleArr<T>(g: GameState, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(g, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ------------------------------------------------------------
// 建立遊戲
// ------------------------------------------------------------
export interface PlayerSetup {
  name: string;
  deckName: string;
  deck: string[];
  isAI: boolean;
  outside?: string[];
}

export function newPlayer(id: PID, s: PlayerSetup): Player {
  return {
    id,
    name: s.name,
    deckName: s.deckName,
    life: 20,
    outside: [],
    library: [],
    hand: [],
    graveyard: [],
    exile: [],
    landsPlayed: 0,
    spellsThisTurn: 0,
    instSorcThisTurn: 0,
    lifeGainedThisTurn: 0,
    lifeLostThisTurn: 0,
    drawsThisTurn: 0,
    drewFromEmpty: false,
    lost: false,
    cantGainLife: false,
    mulligans: 0,
    isAI: s.isAI,
  };
}

export function createGame(p0: PlayerSetup, p1: PlayerSetup, seed = Date.now()): GameState {
  const g: GameState = {
    cards: {},
    nextId: 1,
    nextSid: 1,
    players: [newPlayer(0, p0), newPlayer(1, p1)],
    battlefield: [],
    stack: [],
    turn: 0,
    active: 0,
    firstPlayer: 0,
    phase: 'setup',
    priority: null,
    eot: [],
    pending: [],
    log: [],
    winner: null,
    rngState: seed | 0,
    sim: false,
    version: 0,
    attackedThisTurn: false,
    maxTurns: 200,
    shows: [],
    showSeq: 0,
  };
  [p0, p1].forEach((s, i) => {
    const pid = i as PID;
    for (const id of s.outside ?? []) {
      const c = newCard(g, getDef(id), pid);
      c.zone = 'outside';
      g.players[pid].outside.push(c.id);
    }
    for (const id of s.deck) {
      const c = newCard(g, getDef(id), pid);
      c.zone = 'library';
      g.players[pid].library.push(c.id);
    }
    shuffleArr(g, g.players[pid].library);
  });
  return g;
}

export function newCard(g: GameState, def: CardDef, owner: PID, token = false): Card {
  const c: Card = {
    id: g.nextId++,
    def,
    ...(token&&def.copyFront?{front:def.copyFront}:{}),
    owner,
    controller: owner,
    zone: 'library',
    tapped: false,
    sick: false,
    damage: 0,
    dtDamage: false,
    counters: 0,
    stun: 0,
    attachedTo: null,
    token,
    attacking: false,
    blocking: null,
    blockedBy: [],
    wasBlocked: false,
    enteredTurn: 0,
    usedThisTurn: [],
  };
  g.cards[c.id] = c;
  return c;
}

export function cloneGame(g: GameState): GameState {
  const cards: Record<number, Card> = {};
  for (const k in g.cards) {
    const c = g.cards[k];
    cards[k] = { ...c,orbitPowerHistory:c.orbitPowerHistory?{...c.orbitPowerHistory}:undefined,frontierMarks:c.frontierMarks?{...c.frontierMarks}:undefined,meadowLinked:c.meadowLinked?.slice(),campusLinked:c.campusLinked?.map(x=>({...x})),lastKeywords:c.lastKeywords?.slice(),finMarks:c.finMarks?{...c.finMarks}:undefined,finLinked:c.finLinked?.slice(), manaPaid:c.manaPaid?.slice(),eclBeheld:c.eclBeheld?.slice(),eclCounters:c.eclCounters?{...c.eclCounters}:undefined,eclCast:c.eclCast?{...c.eclCast}:undefined,eclUsage:c.eclUsage?{...c.eclUsage}:undefined, raphaelPermissions:c.raphaelPermissions?.map(p=>({...p})),colorProtections:c.colorProtections?.map(p=>({...p})),temporaryAbilities:c.temporaryAbilities?{turn:c.temporaryAbilities.turn,abilities:c.temporaryAbilities.abilities.slice()}:undefined,lastCounterKinds:c.lastCounterKinds?{...c.lastCounterKinds}:undefined, blockedBy: c.blockedBy.slice(), usedThisTurn: c.usedThisTurn.slice(), exhausted: c.exhausted?.slice(), permanentGrants:c.permanentGrants?.map(x=>({...x,kw:x.kw?.slice()})),chosenModes:c.chosenModes?.slice(),classModesTurn:c.classModesTurn?{turn:c.classModesTurn.turn,modes:c.classModesTurn.modes.slice()}:undefined,crewedBy:c.crewedBy?.slice(),copiedAbilities:c.copiedAbilities?.slice(),grantedFirebend:c.grantedFirebend?{...c.grantedFirebend}:undefined,returnControl:c.returnControl?{...c.returnControl}:undefined };
  }
  const cp = (p: Player): Player => ({
    ...p,frontierFlags:p.frontierFlags?{...p.frontierFlags}:undefined,finFlags:p.finFlags?{...p.finFlags}:undefined,eclEntries:p.eclEntries?.slice(),eclMaralenUsed:p.eclMaralenUsed?.slice(),eclRestrictedMana:p.eclRestrictedMana?.map(m=>({...m})),
    outside: p.outside.slice(),
    library: p.library.slice(),
    hand: p.hand.slice(),
    graveyard: p.graveyard.slice(),
    exile: p.exile.slice(),
    retainedRed:p.retainedRed?.slice(),spellTypesThisTurn:p.spellTypesThisTurn?.slice(),pool:p.pool?.slice(),poolLesson:p.poolLesson?.slice(),poolNoncreature:p.poolNoncreature?.slice(),firePool:p.firePool?.slice(),bends:p.bends?.slice(),
  });
  return {
    ...g,campusParadigms:g.campusParadigms?.map(x=>({...x})),campusDelayed:g.campusDelayed?.map(x=>({...x})),meadowDelayed:g.meadowDelayed?.map(d=>({...d,ids:d.ids?.slice()})),eclEntryQueue:g.eclEntryQueue?.map(e=>({...e})),lastManaPayment:g.lastManaPayment?.slice(),
    cards,
    players: [cp(g.players[0]), cp(g.players[1])],
    battlefield: g.battlefield.slice(),
    stack: g.stack.map((s) => ({ ...s, targets: s.targets.slice() })),
    eot: g.eot.map((e) => ({ ...e })),
    pending: g.pending.slice(),
    extraTurns:g.extraTurns?.slice(),playerControl:g.playerControl?{...g.playerControl}:undefined,extraCombat:g.extraCombat?{...g.extraCombat}:undefined,delayed:g.delayed?.map(d=>({...d})),
    log: [],
    shows: [],
    sim: true,
  };
}

// ------------------------------------------------------------
// 日誌
// ------------------------------------------------------------
/** 記錄一個畫面事件（施放、攻擊等），讓介面可以顯示動畫 */
export function show(g: GameState, s: Omit<Show, 'seq'>): void {
  if (g.sim) return;
  g.shows.push({ ...s, seq: ++g.showSeq });
  if (g.shows.length > 30) g.shows.splice(0, g.shows.length - 30);
}

export function log(g: GameState, text: string, player?: PID, kind: LogEntry['kind'] = 'info'): void {
  g.version++;
  if (g.sim) return;
  g.log.push({ turn: g.turn, player, text, kind });
  if (g.log.length > 400) g.log.splice(0, g.log.length - 400);
}

/** Copy effects copy earlier copy effects, while ignoring counters and later power/type changes. */
export function copiableDefinition(c:Card):CardDef {
  const base=c.copyLayer??c.campusTypeDef??c.campusOriginalDef??c.meadowTypeDef??c.baseDef??c.orbitTypeDef??c.foundationAuraOriginal??c.tlaOriginalDef??c.auraBaseDef??c.def;
  return {...base,...(!c.copyLayer&&c.front?{copyFront:c.front}:{})};
}

export function cardName(c: Card | undefined): string {
  return c ? displayName(c.def.name?c.def:c.tlaOriginalDef??c.def) : '?';
}

// ------------------------------------------------------------
// 基本查詢
// ------------------------------------------------------------
export function decisionController(g:GameState,player:PID):PID {
  const c=g.playerControl;
  return c && c.player===player && g.turn>=c.starts && g.turn<=c.ends && (c.whole || g.phase.startsWith('combat')) ? c.controller : player;
}

export const isType = (def: CardDef, t: CardType) => def.types.includes(t);
export const cardDefinition=(c:Card)=>c.zone==='stack'&&c.castFace?c.castFace:c.def;
export const isCreature = (c: Card) => cardDefinition(c).types.includes('Creature');
export const isLand = (c: Card) => c.def.types.includes('Land');
export const isPermanentDef = (def: CardDef) => !def.types.includes('Instant') && !def.types.includes('Sorcery');

export function creaturesOf(g: GameState, pid: PID): Card[] {
  const out: Card[] = [];
  for (const id of g.battlefield) {
    const c = g.cards[id];
    if (c.controller === pid && isCreature(c)) out.push(c);
  }
  return out;
}

export function permanentsOf(g: GameState, pid: PID): Card[] {
  return g.battlefield.map((id) => g.cards[id]).filter((c) => c.controller === pid);
}

export function landsOf(g: GameState, pid: PID): Card[] {
  return permanentsOf(g, pid).filter(isLand);
}

const asArr = <T,>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);

// ------------------------------------------------------------
// 持續性效應：計算生物的實際力量/防禦力/異能
// ------------------------------------------------------------
export interface Stats {
  p: number;
  t: number;
  kw: Set<Keyword>;
  prowessCount?: number;
  cantAttack: boolean;
  cantBlock: boolean;
  ignoreDefender?: boolean;
  damageByToughness?: boolean;
  noUntap?: boolean;
  damageAbs?: boolean;
  onlyOneBlocker?: boolean;
}

/** 這張永久物是否因為光環而失去所有異能 */
export function abilitiesSuppressed(g: GameState, c: Card): boolean {
  if(c.mshMarks?.waspSource!==undefined&&g.battlefield.some(id=>(g.cards[id].tmtLinkKey??id)===c.mshMarks?.waspSource))return true;
  if(c.frontierMarks?.cpDisableSource!==undefined){const s=g.cards[c.frontierMarks.cpDisableSource];if(s?.zone==='battlefield'&&s.objectVersion===c.frontierMarks.cpDisableVersion)return true;}
  if(c.eclLoseAbilities||c.zone==='battlefield'&&g.eot.some(e=>e.card===c.id&&e.loseAbilities))return true;
  if (!g.loseAbilities || c.zone !== 'battlefield') return false;
  if (c.loseAbilitiesTurn === g.turn) return true;
  return g.battlefield.some((id) => {
    const a = g.cards[id];
    return a.attachedTo === c.id && !!a.def.aura?.grant?.loseAbilities;
  });
}

/** 永久物目前實際擁有的異能（失去所有異能時為空） */
export function abilitiesOf(g: GameState, c: Card): Ability[] {
  return abilitiesSuppressed(g, c) ? [] : [...(c.def.abilities ?? []), ...(c.def.offspring&&c.offspringPaid?[{kind:'trigger' as const,on:'etb' as const,effects:[{e:'copyCreature' as const,what:'selfAny' as const,p:1,t:1,preserveLegendary:true}]}]:[]), ...(c.copiedAbilities ?? []), ...(c.temporaryAbilities?.turn===g.turn?c.temporaryAbilities.abilities:[])];
}

function hasSerum(g: GameState, c: Card): boolean {
  return c.zone === 'battlefield' && g.battlefield.some(id => {
    const a = g.cards[id];
    return a.attachedTo === c.id && a.def.id === 'super-soldier-serum' && !abilitiesSuppressed(g, a);
  });
}

/** Continuous type changes are not part of a permanent's copiable values. */
export function hasSupertype(g: GameState, c: Card, type: 'Basic' | 'Legendary'): boolean {
  return !!c.def.supertypes?.includes(type) || (type === 'Legendary' && hasSerum(g, c));
}

export function stats(g: GameState, c: Card, ignoreEot = false): Stats {
  const original = cardDefinition(c);
  const typed=c.zone==='battlefield'&&c.def.id==='goddric-cloaked-reveler'&&!abilitiesSuppressed(g,c)&&(g.players[c.controller].nonlandEtbThisTurn??0)>=2?{...original,subtypes:['Dragon']}:original;
  const d=c.zone==='battlefield'&&isCreature(c)&&c.owner!==c.controller&&g.battlefield.some(id=>g.cards[id].controller===c.controller&&g.cards[id].def.id==='laughing-jasper-flint'&&!abilitiesSuppressed(g,g.cards[id]))?{...typed,subtypes:[...(typed.subtypes??[]),'Mercenary']}:typed;
  const lost = abilitiesSuppressed(g, c);
  const st: Stats = {
    p: d.power ?? 0,
    t: d.toughness ?? 0,
    kw: new Set<Keyword>(lost ? [] : d.keywords ?? []),
    prowessCount: lost ? 0 : (d.keywords??[]).filter(k=>k==='prowess').length,
    cantAttack: false,
    cantBlock: false,
  };
  frontierBaseStats(g,c,st);
  mshBaseStats(g,c,st);
  if (c.zone !== 'battlefield') return st;
  if(c.noUntapBy!==undefined && g.cards[c.noUntapBy]?.zone==='battlefield' && g.cards[c.noUntapBy].controller===c.noUntapController) st.noUntap=true;
  if (c.suspected) {
    st.kw.add('menace');
    st.cantBlock = true;
  }
  mkmBaseStats(g,c,st);
  finBaseStats(g,c,st);
  // 直到回合結束的基礎力量與防禦力（在指示物與加成之前套用）
  if (!ignoreEot) {
    for (const e of g.eot) {
      if (e.card === c.id && e.base) {
        if(e.base.p!==undefined)st.p=e.base.p;
        if(e.base.t!==undefined)st.t=e.base.t;
      }
    }
  }
  for(const [kw,n] of Object.entries(c.eclCounters??{}))if(n>0&&['flying','first_strike','lifelink','trample','vigilance','haste','deathtouch','reach','hexproof','indestructible','double_strike','menace'].includes(kw))st.kw.add(kw as Keyword);
  if (c.hexproofCounters) st.kw.add('hexproof');
  if(!lost&&abilitiesOf(g,c).some(a=>a.kind==='static'&&a.ecl==='vividPower'))st.p=new Set(g.battlefield.flatMap(id=>g.cards[id].controller===c.controller?colorsOf(g.cards[id].def):[])).size;
  st.p += c.counters;
  st.t += c.counters;
  const apply = (gr: Grant) => {
    st.p += gr.p ?? 0;
    st.t += gr.t ?? 0;
    if (gr.kw) for (const k of gr.kw) {st.kw.add(k);if(k==='prowess')st.prowessCount=(st.prowessCount??0)+1;}
    if (gr.cantAttack) st.cantAttack = true;
    if (gr.cantBlock) st.cantBlock = true;
    if (gr.ignoreDefender) st.ignoreDefender = true;
    if (gr.damageByToughness) st.damageByToughness = true;
    if (gr.noUntap) st.noUntap = true;
    if (gr.damageAbs) st.damageAbs = true;
    if (gr.onlyOneBlocker) st.onlyOneBlocker = true;
    for (const kw of gr.removeKw ?? []) {st.kw.delete(kw);if(kw==='prowess')st.prowessCount=0;}
  };
  for (const grant of c.permanentGrants ?? []) apply(grant);
  for (const sid of g.battlefield) {
    const s = g.cards[sid];
    const abs = abilitiesOf(g, s);
    if (abs.length) {
      for (const ab of abs) {
        if (ab.kind !== 'static') continue;
        if(ab.ecl){
          const hasType=(x:Card,sub:string)=>matches(g,{sub},x,s.controller,s.id);
          if(ab.ecl==='kinbinding'&&s.controller===c.controller&&isCreature(c)){const n=g.players[s.controller].eclEntries?.length??0;st.p+=n;st.t+=n;}
          if(ab.ecl==='boneclub'&&s.id===c.id)st.p+=2*g.battlefield.filter(id=>id!==c.id&&g.cards[id].controller===c.controller&&hasType(g.cards[id],'Goblin')).length;
          if(ab.ecl==='moonVigil'&&s.id===c.id){const n=g.battlefield.filter(id=>g.cards[id].controller===c.controller&&isCreature(g.cards[id])).length+g.players[c.controller].graveyard.filter(id=>isCreature(g.cards[id])).length;st.p+=n;st.t+=n;}
          if(ab.ecl==='chronicle'&&s.eclType&&s.controller===c.controller&&isCreature(c)&&hasType(c,s.eclType)){st.p+=2;st.t+=2;st.kw.add('first_strike');st.kw.add('trample');}
        }
        if(ab.condition&&!checkCond(g,ab.condition,s.controller,s.id,[]))continue;
        if (s.id === c.id && ab.selfPowerCount) st.p += countMatching(g, ab.selfPowerCount, s.controller, s.id);
        if (s.id === c.id && ab.selfLandCounters) st.p += g.battlefield.reduce((n,id) => n + (g.cards[id].controller === s.controller && (isLand(g.cards[id])||g.cards[id].def.id==='tok-earth') ? g.cards[id].counters : 0), 0);
        if (ab.zookeeper && s.controller === c.controller && isCreature(c) && !c.def.subtypes?.includes('Human')) { const n = Math.min(10, c.def.subtypes?.length ?? 0); st.p += n; st.t += n; }
        if (ab.anthem && matches(g, ab.anthem.filter, c, s.controller, s.id)) apply(ab.anthem.grant);
        if (ab.self && s.id === c.id && (!ab.self.cond || checkCond(g, ab.self.cond, s.controller, s.id, []))) apply(ab.self.grant);
        if (ab.selfPumpGraveyardTypes && s.id === c.id) {
          const types = new Set<string>();
          for (const pl of g.players) for (const id of pl.graveyard) for (const ty of g.cards[id].def.types) types.add(ty);
          st.p += types.size;
          st.t += types.size;
        }
        if (ab.selfPowerDomain && s.id === c.id) {
          const basics = new Set<string>();
          for (const id of g.battlefield) {
            const l = g.cards[id];
            if (l.controller !== s.controller || !l.def.types.includes('Land')) continue;
            for (const sub of l.def.subtypes ?? []) if (['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].includes(sub)) basics.add(sub);
          }
          st.p += basics.size;
        }
        if (ab.selfPumpPerGy && s.id === c.id) {
          let n = 0;
          for (const id of g.players[s.controller].graveyard) if (matches(g, ab.selfPumpPerGy.filter, g.cards[id], s.controller, s.id)) n++;
          n = Math.floor(n / (ab.selfPumpPerGy.per ?? 1));
          st.p += n * (ab.selfPumpPerGy.p ?? 0);
          st.t += n * (ab.selfPumpPerGy.t ?? 0);
        }
      }
    }
    if (s.attachedTo === c.id) {
      const gr = s.def.aura?.grant ?? s.def.equip?.grant;
      if (gr) apply(gr);
    }
  }
  if (!ignoreEot) {
    for (const e of g.eot) {
      if (e.card !== c.id) continue;
      apply(e);
    }
  }
  if(!lost && d.id==='earthen-ally') {const colors=new Set<string>();for(const id of g.battlefield){const a=g.cards[id];if(a.controller===c.controller&&a.def.subtypes?.includes('Ally'))for(const col of colorsOf(a.def))colors.add(col);}st.p+=colors.size;}
  if(c.attachedTo==null) for(const id of g.battlefield){const a=g.cards[id];if(a.def.id==='avatar-destiny'&&a.attachedTo===c.id){const n=g.players[a.controller].graveyard.filter(id=>isCreature(g.cards[id])).length;st.p+=n;st.t+=n;}}
  if(st.p>=4 && g.battlefield.some(id=>g.cards[id].controller===c.controller&&abilitiesOf(g,g.cards[id]).some(a=>a.kind==='static'&&a.oneBlockerPower4)))st.onlyOneBlocker=true;
  if(!lost&&d.combatPowerMin!==undefined&&st.p<d.combatPowerMin){st.cantAttack=true;st.cantBlock=true;}
  for(const id of g.battlefield){const eq=g.cards[id];if(eq.attachedTo===c.id&&eq.def.equip?.powerPerArtifact)st.p+=g.battlefield.filter(id=>g.cards[id].controller===eq.controller&&g.cards[id].def.types.includes('Artifact')).length;}
  finApplyStats(g,c,st);
  mkmApplyStats(g,c,st);
  mshApplyStats(g,c,st);
  frontierStats(g,c,st);
  return st;
}

export function hasKw(g: GameState, c: Card, kw: Keyword): boolean {
  if (c.zone !== 'battlefield') return (c.def.keywords ?? []).includes(kw);
  return stats(g, c).kw.has(kw);
}

// ------------------------------------------------------------
// 篩選
// ------------------------------------------------------------
export function matches(g: GameState, f: Filter | undefined, c: Card, pov: PID, sourceId?: number): boolean {
  // 徽記不是永久物（只有明確要求徽記時才符合）
  if (c.def.types.includes('Emblem') && !(f?.type && asArr(f.type).includes('Emblem'))) return false;
  if (!f) return true;
  if(f.mvMaxSourcePower){const source=g.cards[sourceId??-1];if(!source||manaValue(c.def)>(source.zone==='battlefield'?stats(g,source).p:source.lastPower??stats(g,source).p))return false;}
  const outlaw=c.def.subtypes?.some(t=>['Assassin','Mercenary','Pirate','Rogue','Warlock'].includes(t))||c.zone==='battlefield'&&c.owner!==c.controller&&g.battlefield.some(id=>g.cards[id].controller===c.controller&&g.cards[id].def.id==='laughing-jasper-flint'&&!abilitiesSuppressed(g,g.cards[id]));
  if(f.outlaw&&!outlaw||f.notOutlaw&&outlaw)return false;
  if(f.enchanted!==undefined&&enchanted(g,c)!==f.enchanted)return false;
  if(f.alsoType&&!c.def.types.includes(f.alsoType))return false;
  if(f.frontierAdventure&&!c.def.adventure)return false;
  if(f.frontierSpellOrAdventure&&!c.def.adventure&&!c.def.types.some(t=>t==='Instant'||t==='Sorcery'))return false;
  if(f.frontierNoTokenName&&g.battlefield.some(id=>g.cards[id].controller===pov&&g.cards[id].token&&g.cards[id].def.name===c.def.name))return false;
  if(f.frontierUniqueName&&g.battlefield.some(id=>id!==c.id&&g.cards[id].controller===pov&&g.cards[id].def.name===c.def.name))return false;
  if(f.attachedToSource&&c.attachedTo!==sourceId)return false;
  if(f.mshWorthy&&(!hasSupertype(g,c,'Legendary')||c.def.subtypes?.includes('Villain')||!colorsOf(c.def).some(col=>col==='R'||col==='W')))return false;
  if(f.suspected!==undefined&&!!c.suspected!==f.suspected)return false;
  if(f.faceDown!==undefined&&!!c.hidden!==f.faceDown)return false;
  if(f.dealtDamage!==undefined&&(c.mkmMarks?.dealtDamage===g.turn)!==f.dealtDamage)return false;
  if(f.gyThisTurn&&c.gyTurn!==g.turn)return false;
  if(f.ids&&!f.ids.includes(c.id))return false;
  const original = cardDefinition(c);
  const typed=c.zone==='battlefield'&&c.def.id==='goddric-cloaked-reveler'&&!abilitiesSuppressed(g,c)&&(g.players[c.controller].nonlandEtbThisTurn??0)>=2?{...original,subtypes:['Dragon']}:original;
  const d=c.zone==='battlefield'&&isCreature(c)&&c.owner!==c.controller&&g.battlefield.some(id=>g.cards[id].controller===c.controller&&g.cards[id].def.id==='laughing-jasper-flint'&&!abilitiesSuppressed(g,g.cards[id]))?{...typed,subtypes:[...(typed.subtypes??[]),'Mercenary']}:typed;
  if (f.type && !asArr(f.type).some((t) => d.types.includes(t))) return false;
  if (f.nonType && asArr(f.nonType).some((t) => d.types.includes(t))) return false;
  if (f.ctrl) {
    const ctl = c.zone === 'battlefield' || c.zone === 'stack' ? c.controller : c.owner;
    if (f.ctrl === 'you' ? ctl !== pov : ctl === pov) return false;
  }
  if (f.color || f.nonColor) {
    const cols = c.zone==='battlefield'&&!isLand(c)&&mkmStatic(g,c.controller,'guildpact').length?['W','U','B','R','G']:colorsOf(d);
    if (f.color && !asArr(f.color).some((x) => cols.includes(x))) return false;
    if (f.nonColor && asArr(f.nonColor).some((x) => cols.includes(x))) return false;
  }
  if(f.chosenTribe){const source=g.cards[sourceId??-1];if(!source?.eclType||!(d.changeling||d.subtypes?.includes(source.eclType)))return false;}
  if(f.minusCounters!==undefined&&(c.counters<0)!==f.minusCounters)return false;
  const mshChangeling=c.def.id==='undercover-skrull'&&g.players[c.controller].graveyard.filter(id=>isCreature(g.cards[id])).length>=2&&!abilitiesSuppressed(g,c);
  const attachedChangeling=g.battlefield.some(id=>g.cards[id].attachedTo===c.id&&g.cards[id].def.id==='stalactite-dagger');
  const jobTypes=c.zone==='battlefield'?g.battlefield.filter(id=>g.cards[id].attachedTo===c.id&&!abilitiesSuppressed(g,g.cards[id])).flatMap(id=>g.cards[id].def.fin?.job?[g.cards[id].def.fin!.job!]:[]):[];
  const serumTypes=hasSerum(g,c)?['Soldier']:[];
  const mkmLandTypes=isLand(c)&&c.zone==='battlefield'&&mkmStatic(g,c.controller,'guildpact').length?['Plains','Island','Swamp','Mountain','Forest']:[];
  const foundationTypes:string[]=[];if(isCreature(c)){if(c.def.id==='skyknight-squire'&&c.counters>=3&&!abilitiesSuppressed(g,c))foundationTypes.push('Knight');if(c.def.id==='adaptive-automaton'&&c.eclType&&!abilitiesSuppressed(g,c))foundationTypes.push(c.eclType);for(const a of frontierStatic(g,c.controller,'dsk:allTribe'))if(a.eclType)foundationTypes.push(a.eclType);if(g.battlefield.some(id=>g.cards[id].attachedTo===c.id&&abilitiesOf(g,g.cards[id]).some(a=>a.kind==='static'&&a.frontier==='fdn:angelAura')))foundationTypes.push('Angel');}
  if (f.sub && !asArr(f.sub).some(x=>foundationTypes.includes(x)) && !asArr(f.sub).some(s=>serumTypes.includes(s)) && !asArr(f.sub).some(s=>mkmLandTypes.includes(s)) && !asArr(f.sub).some(s=>jobTypes.includes(s)) && !attachedChangeling && !mshChangeling && !d.changeling && !asArr(f.sub).some((s) => d.subtypes?.includes(s))) return false;
  if (f.nonSub && (asArr(f.nonSub).some(x=>foundationTypes.includes(x))||asArr(f.nonSub).some(s=>serumTypes.includes(s))||asArr(f.nonSub).some(s=>jobTypes.includes(s))||mshChangeling||d.changeling || asArr(f.nonSub).some((s) => d.subtypes?.includes(s)))) return false;
  if (f.attackedThisTurn !== undefined && (c.attackedTurn === g.turn) !== f.attackedThisTurn) return false;
  if(f.name&&d.name!==f.name)return false;
  if(f.nonNames?.includes(d.name))return false;
  if (f.legendary !== undefined && hasSupertype(g,c,'Legendary') !== f.legendary) return false;
  if (f.basic !== undefined && !!d.supertypes?.includes('Basic') !== f.basic) return false;
  const stackItem=c.zone==='stack'?g.stack.find(s=>s.kind==='spell'&&s.cardId===c.id):undefined;
  const valueDef=stackItem&&d.mkm?.split?{...d,cost:stackItem.alt==='adventure'?d.adventure?.cost:d.cost,mkm:undefined}:d;
  const actualManaValue=manaValue(valueDef)+(c.zone==='stack'?(g.stack.find(s=>s.kind==='spell'&&s.cardId===c.id)?.x??0)*(d.cost?.match(/\{X\}/g)?.length??0):0);
  if (f.mvMax !== undefined && actualManaValue > f.mvMax) return false;
  if (f.mvMin !== undefined && actualManaValue < f.mvMin) return false;
  if (f.tapped !== undefined && c.tapped !== f.tapped) return false;
  if(f.owner && c.owner!==(f.owner==='you'?pov:other(pov)))return false;
  if (f.attacking && !c.attacking) return false;
  if(f.crewedSourceThisTurn && !(g.cards[sourceId??-1]?.crewedTurn===g.turn&&g.cards[sourceId??-1]?.crewedBy?.includes(c.id)))return false;
  if(f.unblocked && (!c.attacking||c.wasBlocked||c.blockedBy.length))return false;
  if (f.inCombat && !c.attacking && c.blocking == null) return false;
  if (f.other && c.id === sourceId) return false;
  if (f.token !== undefined && c.token !== f.token) return false;
  if (f.enteredThisTurn !== undefined && (c.enteredTurn === g.turn) !== f.enteredThisTurn) return false;
  if (f.stunned && c.stun <= 0) return false;
  if (f.plusCounters !== undefined && c.counters > 0 !== f.plusCounters) return false;
  if (f.hasCounters !== undefined && (c.counters !== 0 || !!c.charge || !!c.stun || !!c.hexproofCounters || !!c.finality || !!c.lore || !!c.loyalty||Object.values(c.eclCounters??{}).some(n=>n>0)) !== f.hasCounters) return false;
  if (f.or && !f.or.some((x) => matches(g, x, c, pov, sourceId))) return false;
  if (f.vanilla !== undefined && (d.text.trim() === '' && !d.keywords?.length) !== f.vanilla) return false;
  if (f.damaged !== undefined && c.damage > 0 !== f.damaged) return false;
  if (f.equipped !== undefined) {
    const eq = g.battlefield.some((id) => g.cards[id].attachedTo === c.id && !!g.cards[id].def.equip);
    if (eq !== f.equipped) return false;
  }
  if (
    f.kw ||
    f.nonKw ||
    f.powMax !== undefined ||
    f.powMin !== undefined ||
    f.toughMin !== undefined ||
    f.toughMax !== undefined ||
    f.sumPTMax !== undefined
  ) {
    const st = stats(g, c);
    if (f.kw && !st.kw.has(f.kw)) return false;
    if (f.nonKw && st.kw.has(f.nonKw)) return false;
    if (f.powMax !== undefined && st.p > f.powMax) return false;
    if (f.powMin !== undefined && st.p < f.powMin) return false;
    if (f.toughMin !== undefined && st.t < f.toughMin) return false;
    if (f.toughMax !== undefined && st.t > f.toughMax) return false;
    if (f.sumPTMax !== undefined && st.p + st.t > f.sumPTMax) return false;
  }
  return true;
}

export function countMatching(g: GameState, f: Filter, pov: PID, sourceId?: number): number {
  let n = 0;
  for (const id of g.battlefield) if (matches(g, f, g.cards[id], pov, sourceId)) n++;
  return n;
}

// ------------------------------------------------------------
// 條件
// ------------------------------------------------------------
export function checkCond(
  g: GameState,
  cond: Cond,
  controller: PID,
  sourceId: number | undefined,
  targets: (TargetRef | null)[],
  ev?: GameEvent,
): boolean {
  const me = g.players[controller];
  const opp = g.players[other(controller)];
  switch (cond.c) {
    case 'msh':return mshCondition(g,cond,controller,sourceId??-1);
    case 'frontier':return frontierCondition(g,cond,controller,sourceId??-1,ev);
    case 'mkm':return mkmCondition(g,cond,controller,sourceId??-1,ev);
    case 'and':return cond.conds.every(c=>checkCond(g,c,controller,sourceId,targets,ev));
    case 'fin':return finCondition(g,cond,controller,sourceId??-1,ev);
    case 'ecl':{
      const src=g.cards[sourceId??-1], n=cond.n??1;
      if(cond.action.startsWith('paid'))return (src?.manaPaid??[]).filter(m=>m===cond.action.slice(4)).length>=n;
      switch(cond.action){
        case 'hasMinus':return (src?.counters??0)<0;
        case 'otherEntry':return (me.eclEntries??[]).some(id=>id!==sourceId);
        case 'creatureEntered':return !!me.eclEntries?.length;
        case 'counterPlaced':return !!me.eclCounterPlaced;
        case 'attackedMerfolk':return (me.eclAttackedMerfolk??0)>=n;
        case 'vividFive':return new Set(g.battlefield.flatMap(id=>g.cards[id].controller===controller?colorsOf(g.cards[id].def):[])).size===5;
        case 'graveEntry':{const c=ev&&'card'in ev?g.cards[ev.card]:undefined;return c?.enteredFrom==='graveyard'||(c?.enteredFrom==='stack'&&c?.castOrigin==='graveyard');}
        case 'chosenEvent':{const c=ev&&'card'in ev?g.cards[ev.card]:undefined;return !!c&&!!src?.eclType&&matches(g,{sub:src.eclType},c,controller);}
        default:throw new Error('Unknown ECL condition '+cond.action);
      }
    }

    case 'controls':
      return countMatching(g, { ...cond.filter, ctrl: 'you' }, controller, sourceId) >= (cond.n ?? 1);
    case 'lifeGte':
      return me.life >= cond.n;
    case 'lifeLte':
      return me.life <= cond.n;
    case 'gainedLifeGte':
      return me.lifeGainedThisTurn >= cond.n;
    case 'targetIs': {
      const t = targets[cond.t];
      if (!t || !('c' in t)) return false;
      const c = g.cards[t.c];
      return !!c && matches(g, cond.filter, c, controller, sourceId);
    }
    case 'instSorcCast':
      return me.instSorcThisTurn >= cond.n;
    case 'oppLostLife':
      return opp.lifeLostThisTurn > 0;
    case 'disappeared':return !!me.permanentLeftThisTurn;
    case 'artifactEntered':return !!me.artifactEnteredThisTurn;
    case 'firstCombat': return g.combatCount === 1;
    case 'classLevel':return (g.cards[sourceId??-1]?.classLevel??1)>=cond.n;
    case 'sneaked':return g.cards[sourceId??-1]?.sneakTurn===g.turn;
    case 'charge': return (g.cards[sourceId ?? -1]?.charge ?? 0) >= cond.n;
    case 'selfAttacking': return !!g.cards[sourceId ?? -1]?.attacking;
    case 'sacrificed': return !!me.sacrificedThisTurn;
    case 'poolGte': return (me.pool?.length ?? 0) + (me.firePool?.length ?? 0) >= cond.n;
    case 'yourTurn':
      return g.active === controller;
    case 'notYourTurn':
      return g.active !== controller;
    case 'oppLifeGteYou':
      return opp.life >= me.life;
    case 'youLifeGteOpp':
      return me.life >= opp.life;
    case 'landsLte':
      return landsOf(g, controller).length <= cond.n;
    case 'anyLifeLte':
      return me.life <= cond.n || opp.life <= cond.n;
    case 'myTurnLte':
      return Math.ceil(g.turn / 2) <= cond.n;
    case 'lostLifeGte':
      return me.lifeLostThisTurn >= cond.n;
    case 'handLte':
      return opp.hand.length <= cond.n || (cond.who === 'any' && me.hand.length <= cond.n);
    case 'attacked':
      return g.active === controller && g.attackedThisTurn;
    case 'drawsGte':
      return me.drawsThisTurn >= cond.n;
    case 'selfTapped':
      return sourceId != null && !!g.cards[sourceId]?.tapped;
    case 'spellsCast':
      return me.spellsThisTurn >= cond.n;
    case 'secondSpell':
      return me.spellsThisTurn === 2;
    case 'void':
      return !!g.voidThisTurn;
    case 'scried':
      return !!me.scriedThisTurn;
    case 'creaturesDiedGte':
      return (g.creaturesDiedCount ?? 0) >= cond.n;
    case 'not':
      return !checkCond(g, cond.cond, controller, sourceId, targets, ev);
    case 'handHas':
      return me.hand.some((id) => matches(g, cond.filter, g.cards[id], controller, sourceId));
    case 'loyaltyActivatedThisTurn':
      return !!me.loyaltyActivatedThisTurn;
    case 'selfWasCast':
      return sourceId != null && !!g.cards[sourceId]?.wasCast;
    case 'castFromGy':
      return false;
    case 'selfNoCombatDamage':
      return sourceId != null && !g.cards[sourceId]?.dealtCombat;
    case 'handGte':
      return me.hand.length >= cond.n;
    case 'evCardIs': {
      const id = ev && 'card' in ev ? ev.card : undefined;
      return id != null && !!g.cards[id] && matches(g, cond.filter, g.cards[id], controller, sourceId);
    }
    case 'noncreatureCastEq':
      return (me.noncreatureThisTurn ?? 0) === cond.n;
    case 'noncreatureCastGte':
      return (me.noncreatureThisTurn ?? 0) >= cond.n;
    case 'libraryEmpty':
      return me.library.length === 0;
    case 'selfNotToken':
      return sourceId != null && !g.cards[sourceId]?.token;
    case 'oppNoncombatThisTurn':
      return !!opp.noncombatThisTurn;
    case 'oppNoncombatLastTurn':
      return !!opp.noncombatLastTurn;
    case 'notPrepared':
      return sourceId != null && !g.cards[sourceId]?.prepared;
    case 'saddled':
      return sourceId != null && g.cards[sourceId]?.saddledTurn === g.turn;
    case 'maxSpeed':
      return (me.speed ?? 0) >= 4;
    case 'always':
      return true;
    case 'selfCounters':
      return sourceId != null && (g.cards[sourceId]?.counters ?? 0) >= cond.n;
    case 'or':
      return cond.conds.some((x) => checkCond(g, x, controller, sourceId, targets, ev));
    case 'jaceLoyaltyGte': {
      let n = 0;
      for (const id of g.battlefield) {
        const c = g.cards[id];
        if (c.controller === controller && c.def.types.includes('Planeswalker') && c.def.subtypes?.includes('Jace')) n += c.loyalty ?? 0;
      }
      return n >= cond.n;
    }
    case 'morbid':
      return !!g.creatureDiedThisTurn;
    case 'delirium': {
      const types = new Set<string>();
      for (const id of me.graveyard) for (const t of g.cards[id].def.types) types.add(t);
      return types.size >= 4;
    }
    case 'celebration':
      return (me.nonlandEtbThisTurn ?? 0) >= 2;
    case 'descended':
      return !!me.permToGyThisTurn;
    case 'gyCount': {
      let n = 0;
      for (const id of me.graveyard) if (matches(g, cond.filter, g.cards[id], controller, sourceId)) n++;
      return n >= cond.n;
    }
  }
}

/** 玩家操控的永久物中，有任何一個具有這個靜態標記 */
export function hasStaticFlag(g: GameState, pid: PID, key: 'noZeroLoyaltyDeath' | 'pwOneAttacker' | 'exileOppDying'): boolean {
  for (const id of g.battlefield) {
    const c = g.cards[id];
    if (c.controller !== pid) continue;
    for (const ab of abilitiesOf(g, c)) if (ab.kind === 'static' && ab[key]) return true;
  }
  return false;
}

export function lifegainBonus(g: GameState, pid: PID): number {
  let n = 0;
  for (const id of g.battlefield) {
    const c = g.cards[id];
    if (c.controller !== pid) continue;
    for (const ab of abilitiesOf(g, c)) if (ab.kind === 'static' && ab.lifegainPlus) n += ab.lifegainPlus;
  }
  return n;
}

/** 場上有「神器與生物進戰場不會使異能觸發」 */
export function etbTriggersSuppressed(g: GameState): boolean {
  for (const id of g.battlefield) {
    for (const ab of abilitiesOf(g, g.cards[id])) if (ab.kind === 'static' && ab.suppressEtbTriggers) return true;
  }
  return false;
}

export function uncounterableSpells(g:GameState,pid:PID){if(frontierStatic(g,pid,'fdn:spellUncounterable').length||frontierStatic(g,pid,'lci:uncounterable').length)return true;return g.battlefield.some(id=>g.cards[id].controller===pid&&abilitiesOf(g,g.cards[id]).some(a=>a.kind==='static'&&a.ecl==='squelcher'));}
