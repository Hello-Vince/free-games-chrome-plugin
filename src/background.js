import { createBackgroundController } from "./background-core.js";

const controller = createBackgroundController({
  chromeApi: chrome,
  fetchFn: fetch,
  now: () => Date.now()
});

controller.registerListeners();
