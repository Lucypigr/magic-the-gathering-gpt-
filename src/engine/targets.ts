import {manaValue} from './mana';
import {finStatic} from './fin-support';
import {eclStatic} from './ecl-support';
import { colorsOf } from './mana';
import { hasKw, isCreature, matches, other } from './state';
import type { Card, GameState, PID, TargetRef, TargetSpec } from './types';

/** 辟邪：不能成為對手的咒語或異能的目標 */
export function targetable(g: GameState, c: Card, by: PID, sourceId?:number): boolean {
  const ks=hasKw(g,c,'protection_colors'),ko=hasKw(g,c,'protection_opponent');
  const source=sourceId!==undefined?g.cards[sourceId]:undefined;
  if(source&&ks&&colorsOf(source.def).length)return false;
  if(ko&&c.controller!==by)return false;
  if(source&&c.controller!==by&&eclStatic(g,c.controller,'tam').some(s=>s.id!==c.id)&&colorsOf(c.def).some(col=>colorsOf(source.def).includes(col)))return false;
  if(c.controller!==by&&source&&c.colorProtections?.some(p=>p.turn===g.turn&&colorsOf(source.def).includes(p.color)))return false;
  if(c.controller!==by&&c.colorProtection?.turn===g.turn&&source&&colorsOf(source.def).includes(c.colorProtection.color))return false;
  if(source&&c.controller!==by&&c.def.id==='niv-mizzet-guildpact'&&colorsOf(source.def).length>1)return false;
  if (c.controller !== by && hasKw(g, c, 'hexproof')) return false;
  return true;
}

export function legalTargets(g: GameState, spec: TargetSpec, controller: PID, sourceId?: number): TargetRef[] {
  const out: TargetRef[] = [];
  const f = spec.filter;
  const addPlayers = (onlyOpp: boolean) => {
    for (const pid of [0, 1] as PID[]) {
      if (onlyOpp && pid === controller) continue;
      if (f?.ctrl === 'opp' && pid === controller) continue;
      if (f?.ctrl === 'you' && pid !== controller) continue;
      if(pid!==controller&&finStatic(g,pid,'playerProtection').length)continue;
      out.push({ p: pid });
    }
  };
  const addPerms = (creatureOnly: boolean, orPlaneswalker = false) => {
    for (const id of g.battlefield) {
      const c = g.cards[id];
      if (creatureOnly && !isCreature(c) && !(orPlaneswalker && c.def.types.includes('Planeswalker'))) continue;
      if (spec.notSelf && id === sourceId) continue;
      if (!matches(g, f, c, controller, sourceId)) continue;
      if (!targetable(g, c, controller, sourceId)) continue;
      out.push({ c: id });
    }
  };
  switch (spec.kind) {
    case 'player':
      addPlayers(false);
      break;
    case 'opponent':
      if(!finStatic(g,other(controller),'playerProtection').length)out.push({ p: other(controller) });
      break;
    case 'creatureOrPlaneswalker':addPerms(true,true);break;
    case 'creature':
      addPerms(true);
      break;
    case 'permanent':
      addPerms(false);
      break;
    case 'any': {
      // 任意一個目標：生物、鵬洛客或玩家
      addPerms(true, true);
      for (const pid of [0, 1] as PID[])if(pid===controller||!finStatic(g,pid,'playerProtection').length)out.push({ p: pid });
      break;
    }
    case 'creatureOrGy':addPerms(true);for(const id of g.players.flatMap(p=>p.graveyard)){const c=g.cards[id];if(isCreature(c)&&id!==sourceId&&matches(g,f,c,controller,sourceId))out.push({c:id});}break;
    case 'spellOrPermanent':
    case 'spellOrCreature':
      addPerms(spec.kind==='spellOrCreature');
      for (const s of g.stack) {
        if (s.kind !== 'spell' || s.cardId === sourceId) continue;
        const c = g.cards[s.cardId];
        if (matches(g, f, c, controller, sourceId)) out.push({ c: c.id });
      }
      break;
    case 'spell':
      for (const s of g.stack) {
        if (s.kind !== 'spell' || s.cardId === sourceId) continue;
        const c = g.cards[s.cardId];
        if (matches(g, f, c, controller, sourceId) && (!spec.targetsOwnArtifactOrCreature || s.targets.some(t => t && 'c' in t && g.cards[t.c]?.controller === controller && (isCreature(g.cards[t.c]) || g.cards[t.c].def.types.includes('Artifact'))))) out.push({ c: c.id });
      }
      break;
    case 'gyCard':
      for (const pid of [0, 1] as PID[]) {
        if (f?.ctrl === 'you' && pid !== controller) continue;
        if (f?.ctrl === 'opp' && pid === controller) continue;
        for (const id of g.players[pid].graveyard) {
          const c = g.cards[id];
          if (matches(g, { ...f, ctrl: undefined }, c, controller, sourceId)) out.push({ c: id });
        }
      }
      break;
  }
  return out;
}

export function sameTarget(a: TargetRef | null, b: TargetRef | null): boolean {
  if (!a || !b) return false;
  if ('p' in a && 'p' in b) return a.p === b.p;
  if ('c' in a && 'c' in b) return a.c === b.c;
  return false;
}

export function isLegalTarget(
  g: GameState,
  spec: TargetSpec,
  t: TargetRef,
  controller: PID,
  sourceId?: number,
): boolean {
  if ('c' in t) {
    const c = g.cards[t.c];
    if (!c) return false;
    const zoneOk =
      spec.kind==='creatureOrGy'?(c.zone==='battlefield'||c.zone==='graveyard'):spec.kind === 'spell' ? c.zone === 'stack' : spec.kind === 'gyCard' ? c.zone === 'graveyard' : (spec.kind === 'spellOrCreature'||spec.kind==='spellOrPermanent') ? c.zone === 'stack' || c.zone === 'battlefield' : c.zone === 'battlefield';
    if (!zoneOk) return false;
  }
  return legalTargets(g, spec, controller, sourceId).some((x) => sameTarget(x, t));
}

/** 驗證一組目標；回傳錯誤訊息或 null */
export function validateTargets(
  g: GameState,
  specs: TargetSpec[],
  targets: (TargetRef | null)[] | undefined,
  controller: PID,
  sourceId?: number,
): string | null {
  const ts = targets ?? [];
  for (let i = 0; i < specs.length; i++) {
    const t = ts[i] ?? null;
    if (!t) {
      if (!specs[i].optional) return '請選擇目標';
      continue;
    }
    if (!isLegalTarget(g, specs[i], t, controller, sourceId)) return '目標不合法';
    const graveIndex=specs[i].sameGraveyardAs,graveTarget=graveIndex!==undefined?ts[graveIndex]:null;if(graveTarget&&'c'in graveTarget&&'c'in t&&g.cards[graveTarget.c].owner!==g.cards[t.c].owner)return '必須選同一墳墓場的牌';
    const totalMax=specs[i].totalMvMax;if(totalMax!==undefined&&ts.reduce((n,t)=>n+(t&&'c'in t?manaValue(g.cards[t.c].def):0),0)>totalMax)return '目標總法力值超過限制';
    const sharedIndex=specs[i].sharesTypeWith;const shared=sharedIndex!==undefined?ts[sharedIndex]:null;
    if(shared&&'c'in shared&&'c'in t){const a=g.cards[shared.c],b=g.cards[t.c];if(!a.def.changeling&&!b.def.changeling&&!a.def.subtypes?.some(sub=>b.def.subtypes?.includes(sub)))return '目標必須共用生物類別';}
    const otherIndex = specs[i].differentControllerFrom;
    const previous = otherIndex !== undefined ? ts[otherIndex] : null;
    if (previous && 'c' in previous && 'c' in t && g.cards[previous.c].controller === g.cards[t.c].controller) return '兩個目標必須由不同玩家操控';
    for (let j = 0; j < i; j++) {
      if (!specs[i].allowRepeat && sameTarget(ts[j] ?? null, t) && specs[j].kind === specs[i].kind) return '不能重複選擇相同目標';
    }
  }
  return null;
}

/** 每個必選目標是否都至少有一個合法選項 */
export function hasTargetsAvailable(g: GameState, specs: TargetSpec[], controller: PID, sourceId?: number): boolean {
  return specs.every((s) => s.optional || legalTargets(g, s, controller, sourceId).length > 0);
}
