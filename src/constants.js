export const API_URL = "https://www.gamerpower.com/api/giveaways";

export const REFRESH_ALARM = "refresh-giveaways";
export const REFRESH_INTERVAL_MINUTES = 60;
export const POPUP_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
export const SEEN_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export const STORAGE_KEYS = Object.freeze({
  offersCache: "offersCache",
  preferences: "preferences",
  knownCategories: "knownCategories",
  seenOffers: "seenOffers",
  lastFetchError: "lastFetchError"
});

export const DEFAULT_PREFERENCES = Object.freeze({
  enabledPlatforms: ["steam", "epic-games-store", "gog"],
  enabledTypes: ["game", "dlc"]
});

export const KNOWN_CATEGORIES = Object.freeze({
  platforms: [
    { key: "steam", label: "Steam" },
    { key: "epic-games-store", label: "Epic Games Store" },
    { key: "gog", label: "GOG" },
    { key: "pc", label: "PC" },
    { key: "drm-free", label: "DRM-Free" },
    { key: "itch-io", label: "Itch.io" },
    { key: "vr", label: "VR" },
    { key: "playstation-4", label: "PlayStation 4" },
    { key: "playstation-5", label: "PlayStation 5" },
    { key: "xbox-360", label: "Xbox 360" },
    { key: "xbox-one", label: "Xbox One" },
    { key: "xbox-series-x-s", label: "Xbox Series X|S" },
    { key: "nintendo-switch", label: "Nintendo Switch" },
    { key: "android", label: "Android" },
    { key: "ios", label: "iOS" }
  ],
  types: [
    { key: "game", label: "Game" },
    { key: "dlc", label: "DLC" },
    { key: "early-access", label: "Early Access" },
    { key: "loot", label: "Loot" },
    { key: "beta", label: "Beta" },
    { key: "other", label: "Other" }
  ]
});

export const ICON_PATHS = Object.freeze({
  bright: {
    16: "icons/bright-16.png",
    32: "icons/bright-32.png",
    48: "icons/bright-48.png",
    128: "icons/bright-128.png"
  },
  muted: {
    16: "icons/muted-16.png",
    32: "icons/muted-32.png",
    48: "icons/muted-48.png",
    128: "icons/muted-128.png"
  }
});
