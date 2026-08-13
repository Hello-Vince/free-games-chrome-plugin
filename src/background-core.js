import {
  API_URL,
  DEFAULT_PREFERENCES,
  ICON_PATHS,
  POPUP_CACHE_MAX_AGE_MS,
  REFRESH_ALARM,
  REFRESH_INTERVAL_MINUTES,
  STORAGE_KEYS
} from "./constants.js";
import {
  discoverCategories,
  formatBadgeCount,
  getUnseenOffers,
  mergeKnownCategories,
  normalizeOffers,
  normalizePreferences,
  pruneSeenOffers
} from "./domain.js";

function publicError(error) {
  if (error instanceof TypeError && /array/i.test(error.message)) {
    return "The giveaway service returned an unexpected response.";
  }
  return "Unable to refresh giveaways right now.";
}

export function createBackgroundController({ chromeApi, fetchFn, now = () => Date.now() }) {
  let refreshPromise = null;

  async function readState() {
    const stored = await chromeApi.storage.local.get(Object.values(STORAGE_KEYS));
    const offersCache = stored.offersCache && Array.isArray(stored.offersCache.items)
      ? stored.offersCache
      : { items: [], fetchedAt: 0 };
    const preferences = normalizePreferences(stored.preferences);
    const knownCategories = mergeKnownCategories(
      stored.knownCategories,
      discoverCategories(offersCache.items)
    );

    return {
      offersCache,
      preferences,
      knownCategories,
      seenOffers: pruneSeenOffers(stored.seenOffers, now()),
      lastFetchError: stored.lastFetchError ?? null
    };
  }

  async function updateToolbar(state) {
    const unseenCount = getUnseenOffers(
      state.offersCache.items,
      state.preferences,
      state.seenOffers,
      now()
    ).length;
    const hasNewOffers = unseenCount > 0;

    // Toolbar presentation must never block state reads or refreshes. Some
    // Chromium builds omit newer action methods even when the core API works.
    const callAction = async (method, details) => {
      const actionMethod = chromeApi.action?.[method];
      if (typeof actionMethod !== "function") return;
      try {
        await actionMethod.call(chromeApi.action, details);
      } catch {
        // The cached offer state remains usable even if an icon call fails.
      }
    };

    await Promise.all([
      callAction("setIcon", { path: hasNewOffers ? ICON_PATHS.bright : ICON_PATHS.muted }),
      callAction("setBadgeText", { text: formatBadgeCount(unseenCount) }),
      callAction("setBadgeBackgroundColor", { color: "#0F766E" }),
      callAction("setBadgeTextColor", { color: "#FFFFFF" }),
      callAction("setTitle", {
        title: hasNewOffers
          ? `Free Games Tracker: ${unseenCount} new offer${unseenCount === 1 ? "" : "s"}`
          : "Free Games Tracker: no new offers"
      })
    ]);
  }

  async function refreshOffers({ force = false } = {}) {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      const current = await readState();
      const cacheAge = now() - Number(current.offersCache.fetchedAt || 0);
      if (!force && cacheAge >= 0 && cacheAge < POPUP_CACHE_MAX_AGE_MS) {
        await updateToolbar(current);
        return current;
      }

      try {
        const response = await fetchFn(API_URL, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store"
        });

        if (response.status !== 201 && !response.ok) {
          throw new Error(`GamerPower returned HTTP ${response.status}.`);
        }

        const payload = response.status === 201 ? [] : await response.json();
        const offers = normalizeOffers(payload);
        const knownCategories = mergeKnownCategories(
          current.knownCategories,
          discoverCategories(offers)
        );
        const seenOffers = pruneSeenOffers(current.seenOffers, now());
        const offersCache = { items: offers, fetchedAt: now() };
        const next = {
          offersCache,
          preferences: current.preferences,
          knownCategories,
          seenOffers,
          lastFetchError: null
        };

        await chromeApi.storage.local.set(next);
        await updateToolbar(next);
        return next;
      } catch (error) {
        const failed = {
          ...current,
          lastFetchError: { message: publicError(error), at: now() }
        };
        await chromeApi.storage.local.set({
          seenOffers: current.seenOffers,
          lastFetchError: failed.lastFetchError
        });
        await updateToolbar(failed);
        return failed;
      }
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  async function savePreferences(preferences) {
    const normalized = normalizePreferences(preferences, false);
    await chromeApi.storage.local.set({ preferences: normalized });
    const state = await readState();
    await updateToolbar(state);
    return state;
  }

  async function markSeen(offerId) {
    const id = String(offerId ?? "").trim();
    const state = await readState();
    if (id) state.seenOffers[id] = now();
    state.seenOffers = pruneSeenOffers(state.seenOffers, now());
    await chromeApi.storage.local.set({ seenOffers: state.seenOffers });
    await updateToolbar(state);
    return state;
  }

  async function initialize() {
    await chromeApi.alarms.create(REFRESH_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: REFRESH_INTERVAL_MINUTES
    });
    return refreshOffers({ force: true });
  }

  async function handleMessage(message) {
    switch (message?.type) {
      case "GET_STATE":
        return { ok: true, state: await refreshOffers({ force: false }) };
      case "REFRESH":
        return { ok: true, state: await refreshOffers({ force: true }) };
      case "SAVE_PREFERENCES":
        return { ok: true, state: await savePreferences(message.preferences) };
      case "MARK_SEEN":
        return { ok: true, state: await markSeen(message.offerId) };
      default:
        return { ok: false, error: "Unknown message type." };
    }
  }

  function registerListeners() {
    chromeApi.runtime.onInstalled.addListener(() => {
      void initialize();
    });
    chromeApi.runtime.onStartup.addListener(() => {
      void initialize();
    });
    chromeApi.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === REFRESH_ALARM) void refreshOffers({ force: true });
    });
    chromeApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      handleMessage(message)
        .then(sendResponse)
        .catch(() => sendResponse({ ok: false, error: "Extension request failed." }));
      return true;
    });
  }

  return {
    handleMessage,
    initialize,
    markSeen,
    readState,
    refreshOffers,
    registerListeners,
    savePreferences,
    updateToolbar
  };
}

export { DEFAULT_PREFERENCES };
