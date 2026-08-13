const platforms = [
  { key: "steam", label: "Steam" },
  { key: "epic-games-store", label: "Epic Games Store" },
  { key: "gog", label: "GOG" },
  { key: "playstation-5", label: "PlayStation 5" },
  { key: "nintendo-switch", label: "Nintendo Switch" },
  { key: "android", label: "Android" }
];
const types = [
  { key: "game", label: "Game" },
  { key: "dlc", label: "DLC" },
  { key: "early-access", label: "Early Access" },
  { key: "other", label: "Other" }
];

let previewState = {
  offersCache: {
    fetchedAt: Date.now(),
    items: [
      {
        id: "preview-1",
        title: "Clockwork Kingdom",
        description: "Build a mechanical city, solve intricate puzzles, and keep this adventure forever.",
        platforms: [{ key: "steam", label: "Steam" }, { key: "pc", label: "PC" }],
        type: { key: "game", label: "Game" },
        thumbnailUrl: "",
        claimUrl: "https://www.gamerpower.com/",
        worth: "$24.99",
        publishedAt: new Date().toISOString(),
        endsAt: "2099-08-20T23:59:00.000Z"
      },
      {
        id: "preview-2",
        title: "Beyond the Starlight — Explorer Pack",
        description: "A limited-time DLC pack with a new ship, cosmetic set, and digital soundtrack.",
        platforms: [{ key: "epic-games-store", label: "Epic Games Store" }],
        type: { key: "dlc", label: "DLC" },
        thumbnailUrl: "",
        claimUrl: "https://www.gamerpower.com/",
        worth: "$9.99",
        publishedAt: new Date().toISOString(),
        endsAt: null
      }
    ]
  },
  preferences: {
    enabledPlatforms: ["steam", "epic-games-store", "gog"],
    enabledTypes: ["game", "dlc"]
  },
  knownCategories: { platforms, types },
  seenOffers: { "preview-2": Date.now() },
  lastFetchError: null
};

const fallbackMode = new URLSearchParams(globalThis.location.search).has("fallback");

globalThis.chrome = {
  runtime: {
    async sendMessage(message) {
      if (fallbackMode) throw new Error("Previewing an unavailable service worker.");
      if (message.type === "SAVE_PREFERENCES") {
        previewState.preferences = structuredClone(message.preferences);
      }
      if (message.type === "MARK_SEEN") {
        previewState.seenOffers[message.offerId] = Date.now();
      }
      return { ok: true, state: structuredClone(previewState) };
    }
  },
  storage: {
    local: {
      async get(keys) {
        return Object.fromEntries(
          keys
            .filter((key) => Object.hasOwn(previewState, key))
            .map((key) => [key, structuredClone(previewState[key])])
        );
      }
    }
  },
  tabs: {
    async create() {}
  }
};
