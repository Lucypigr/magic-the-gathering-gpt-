import { createServer } from "vite";
import { writeFileSync } from "node:fs";
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { CARDS, TOKENS } = await server.ssrLoadModule("/src/data/index.ts");
  const cards = [];
  const visit = (c) => {
    cards.push(c);
    for (const k of ["back", "adventure", "copyFront"]) if (c[k]) visit(c[k]);
    if (c.room)
      for (const face of Object.values(c.room))
        cards.push({ ...c, ...face, room: undefined });
  };
  for (const c of [...CARDS, ...TOKENS]) visit(c);
  writeFileSync(
    process.argv[2] ?? "/tmp/translation-cards.json",
    JSON.stringify(cards),
  );
} finally {
  await server.close();
}
