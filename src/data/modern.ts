import snapshot from './modern-legality.json';
import lists from './modern-decklists.json';
import { deck, type DeckList } from './decks';
import type { CardDef, Color } from '../engine/types';
const key = (s: string) => s.normalize('NFKD').replace(/Æ/g, 'AE').replace(/æ/g, 'ae').toLowerCase().replace(/[^a-z0-9]/g, '');
const legal = new Set(snapshot.legalKeys), banned = new Set(snapshot.bannedNames.map(key));
export const MODERN_AS_OF = snapshot.asOf;
export const isModernLegal = (d: Pick<CardDef, 'name'>) => legal.has(key(d.name));
export const isModernBanned = (d: Pick<CardDef, 'name'>) => banned.has(key(d.name));
export const MODERN_AI_DECKS: DeckList[] = lists.map((d, i) => deck(d.id, d.name,
  '近代賽果敢套牌；主牌60張，備牌15張。', [['G', 'U', 'R'], ['U', 'R'], ['W', 'U', 'R']][i] as Color[],
  d.main as [number, string][], { sideboard: deck('', '', '', [], d.side as [number, string][]).cards, style: 'tempo', meta: d.sourceName }));
