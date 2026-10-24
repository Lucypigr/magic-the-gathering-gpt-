import { matchFilter } from "../src/ui/DeckBuilder";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CARDS, TOKENS } from "../src/data";
import {
  displayRulesText,
  traditionalRulesText,
} from "../src/data/localization";
import { setCardLanguage } from "../src/data/names";
import { CardDetail, CardFace, ImagesEnabled } from "../src/ui/CardView";
import { termNotes, lineNotes } from "../src/ui/explain";
import type { CardDef } from "../src/engine/types";

vi.mock("../src/ui/images", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/ui/images")>()),
  useImageVersion: () => 0,
}));

const find = (id: string) => CARDS.find((c) => c.id === id)!;
afterEach(() => {
  setCardLanguage(false);
  vi.unstubAllGlobals();
});

describe("offline Traditional Chinese rules", () => {
  it("covers every card, back face, Adventure and Room without changing Oracle text", () => {
    const visit = (c: CardDef) => {
      const source = c.text;
      if (source && !/[\u3400-\u9fff]/.test(source)) {
        const zh = traditionalRulesText(source);
        expect(zh, c.name).toMatch(/[\u3400-\u9fff]/);
        expect(zh, c.name).not.toMatch(
          /\b(?:whenever|target creature|you control|until end of turn|draw a card|sacrifice|graveyard)\b/i,
        );
        expect(c.text).toBe(source);
      }
      if (c.back) visit(c.back);
      if (c.adventure)
        visit({
          ...c,
          ...c.adventure,
          back: undefined,
          adventure: undefined,
          room: undefined,
        });
      if (c.room)
        for (const door of [c.room.left, c.room.right])
          visit({
            ...c,
            ...door,
            back: undefined,
            adventure: undefined,
            room: undefined,
          });
    };
    for (const c of [...CARDS, ...TOKENS]) visit(c);
  });
  it("keeps Chinese/English settings separate and preserves numeric and target scope", () => {
    const season = find("doubling-season"),
      chandra = find("chandra-flameshaper");
    setCardLanguage(true);
    expect(displayRulesText(season.text)).toContain("兩倍數量的衍生物");
    expect(displayRulesText(season.text)).toContain("由你操控的永久物");
    expect(displayRulesText(chandra.text)).toContain("{R}{R}{R}");
    expect(displayRulesText(chandra.text)).toContain("共8點傷害");
    setCardLanguage(false);
    expect(displayRulesText(season.text)).toBe(season.text);
    expect(
      matchFilter(season, {
        q: "兩倍數量",
        color: "",
        type: "",
        set: "",
        rarity: "",
      }),
    ).toBe(true);
  });
  it("shows translated card frames, details and explanations without fetching translations", () => {
    setCardLanguage(true);
    const card = find("bloodthirsty-conqueror");
    const html = renderToStaticMarkup(
      createElement(
        ImagesEnabled.Provider,
        { value: false },
        createElement(CardFace, { def: card, showText: true }),
        createElement(CardDetail, { def: card }),
      ),
    );
    expect(html).toContain("每當一位對手失去生命時");
    expect(html).not.toContain("Whenever an opponent");
    expect(
      lineNotes(card).some(
        (l) => l.kind === "triggered" && l.text.includes("每當"),
      ),
    ).toBe(true);
    const room = traditionalRulesText(
      find("dollmakers-shop-porcelain-gallery").text,
    );
    expect(room).toContain("巫術時機");
    expect(room).toContain("非玩具");
    expect(room).toContain("基礎力量與防禦力");
    expect(
      termNotes(find("defiant-survivor")).find((t) => t.term === "生存")?.desc,
    ).toContain("第二主階段");
    expect(
      termNotes(find("overlord-of-the-mistmoors")).some(
        (t) => t.term === "迫臨 N",
      ),
    ).toBe(true);
  });
  it("keeps the original English card image when Chinese art is unavailable", async () => {
    vi.stubGlobal("window", {
      __CARD_IMAGES__: {
        "offline sample": { art: "art.jpg", full: "english.jpg" },
      },
    });
    vi.doUnmock("../src/ui/images");
    vi.resetModules();
    const images = await import("../src/ui/images");
    images.setLanguage(true);
    expect(images.imageFor("Offline Sample")).toEqual({
      art: "art.jpg",
      full: "english.jpg",
    });
    images.setLanguage(false);
    expect(images.imageFor("Offline Sample")?.full).toBe("english.jpg");
  });
});
