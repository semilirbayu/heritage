import { createApp, type AppStore } from "./app/app";
import { emptyTree } from "./domain/tree";

const store: AppStore = { tree: emptyTree() };
const port = Number(process.env.PORT ?? 3000);

Bun.serve({
  port,
  fetch: createApp(store).fetch,
});

// eslint-disable-next-line no-console
console.log(`Heritage on http://localhost:${port}`);
