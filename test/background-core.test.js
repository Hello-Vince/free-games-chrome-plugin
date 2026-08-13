import test from "node:test";
import assert from "node:assert/strict";

import { createBackgroundController } from "../src/background-core.js";
import { REFRESH_ALARM } from "../src/constants.js";

const NOW = Date.UTC(2026, 7, 13, 18, 0, 0);

function rawOffer(overrides = {}) {
  return {
    id: 1,
    title: "Example Giveaway",
    description: "Free for a limited time.",
    platforms: "PC, Steam",
    type: "Game",
    thumbnail: "https://www.gamerpower.com/image.jpg",
    open_giveaway_url: "https://www.gamerpower.com/open/example",
    published_date: "2026-08-13 10:00:00",
    end_date: "2026-08-20 23:59:00",
    status: "Active",
    ...overrides
  };
}

function event() {
  const listeners = [];
  return {
    addListener(listener) { listeners.push(listener); },
    emit(...args) { return listeners.map((listener) => listener(...args)); },
    listeners
  };
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function createChromeMock(initial = {}) {
  const data = clone(initial);
  const actionCalls = [];
  const alarms = [];
  const chromeApi = {
    storage: {
      local: {
        async get(keys) {
          const result = {};
          for (const key of keys) if (key in data) result[key] = clone(data[key]);
          return result;
        },
        async set(values) { Object.assign(data, clone(values)); }
      }
    },
    action: {
      async setIcon(value) { actionCalls.push(["icon", clone(value)]); },
      async setBadgeText(value) { actionCalls.push(["badge", clone(value)]); },
      async setBadgeBackgroundColor(value) { actionCalls.push(["badgeBackground", clone(value)]); },
      async setBadgeTextColor(value) { actionCalls.push(["badgeTextColor", clone(value)]); },
      async setTitle(value) { actionCalls.push(["title", clone(value)]); }
    },
    alarms: {
      async create(name, options) { alarms.push({ name, options }); },
      onAlarm: event()
    },
    runtime: {
      onInstalled: event(),
      onStartup: event(),
      onMessage: event()
    }
  };
  return { chromeApi, data, actionCalls, alarms };
}

function response(payload, { status = 200, ok = true } = {}) {
  return { status, ok, async json() { return clone(payload); } };
}

function latestAction(calls, name) {
  return calls.filter(([type]) => type === name).at(-1)?.[1];
}

test("refreshes all offers, discovers categories, stores defaults, and counts selected unseen offers", async () => {
  const mock = createChromeMock();
  const fetchFn = async () => response([
    rawOffer(),
    rawOffer({ id: 2, title: "Console Pack", platforms: "Playstation 5", type: "Other" })
  ]);
  const controller = createBackgroundController({ chromeApi: mock.chromeApi, fetchFn, now: () => NOW });

  const state = await controller.refreshOffers({ force: true });

  assert.equal(state.offersCache.items.length, 2);
  assert.deepEqual(mock.data.preferences.enabledPlatforms, ["steam", "epic-games-store", "gog"]);
  assert.ok(mock.data.knownCategories.platforms.some(({ key }) => key === "playstation-5"));
  assert.equal(latestAction(mock.actionCalls, "badge").text, "1");
  assert.match(latestAction(mock.actionCalls, "title").title, /1 new offer/);
});

test("handles HTTP 201 as an empty successful feed", async () => {
  const mock = createChromeMock();
  const controller = createBackgroundController({
    chromeApi: mock.chromeApi,
    fetchFn: async () => response(null, { status: 201, ok: true }),
    now: () => NOW
  });

  const state = await controller.refreshOffers({ force: true });
  assert.deepEqual(state.offersCache.items, []);
  assert.equal(state.lastFetchError, null);
  assert.equal(latestAction(mock.actionCalls, "badge").text, "");
});

test("retains the last successful cache when refresh fails", async () => {
  const cached = {
    items: [{
      id: "1",
      title: "Cached",
      description: "",
      platforms: [{ key: "steam", label: "Steam" }],
      type: { key: "game", label: "Game" },
      thumbnailUrl: "",
      claimUrl: "https://www.gamerpower.com/open/cached",
      worth: "",
      publishedAt: null,
      endsAt: "2099-01-01T00:00:00.000Z"
    }],
    fetchedAt: NOW - 1000
  };
  const mock = createChromeMock({ offersCache: cached });
  const controller = createBackgroundController({
    chromeApi: mock.chromeApi,
    fetchFn: async () => { throw new Error("offline"); },
    now: () => NOW
  });

  const state = await controller.refreshOffers({ force: true });
  assert.deepEqual(state.offersCache, cached);
  assert.match(state.lastFetchError.message, /Unable to refresh/);
  assert.deepEqual(mock.data.offersCache, cached);
});

test("saving preferences changes the badge and clicking an offer marks only it seen", async () => {
  const mock = createChromeMock();
  const controller = createBackgroundController({
    chromeApi: mock.chromeApi,
    fetchFn: async () => response([
      rawOffer({ id: 1 }),
      rawOffer({ id: 2, platforms: "Playstation 5", type: "Other" })
    ]),
    now: () => NOW
  });
  await controller.refreshOffers({ force: true });

  await controller.savePreferences({ enabledPlatforms: ["playstation-5"], enabledTypes: ["other"] });
  assert.equal(latestAction(mock.actionCalls, "badge").text, "1");

  const state = await controller.markSeen("2");
  assert.equal(state.seenOffers[2], NOW);
  assert.equal(state.seenOffers[1], undefined);
  assert.equal(latestAction(mock.actionCalls, "badge").text, "");
});

test("fresh GET_STATE uses cache while explicit refresh fetches", async () => {
  const mock = createChromeMock({
    offersCache: { items: [], fetchedAt: NOW - 1000 }
  });
  let fetchCount = 0;
  const controller = createBackgroundController({
    chromeApi: mock.chromeApi,
    fetchFn: async () => { fetchCount += 1; return response([]); },
    now: () => NOW
  });

  await controller.handleMessage({ type: "GET_STATE" });
  assert.equal(fetchCount, 0);
  await controller.handleMessage({ type: "REFRESH" });
  assert.equal(fetchCount, 1);
});

test("registers install, startup, alarm, and message listeners", async () => {
  const mock = createChromeMock();
  const controller = createBackgroundController({
    chromeApi: mock.chromeApi,
    fetchFn: async () => response([]),
    now: () => NOW
  });
  controller.registerListeners();

  assert.equal(mock.chromeApi.runtime.onInstalled.listeners.length, 1);
  assert.equal(mock.chromeApi.runtime.onStartup.listeners.length, 1);
  assert.equal(mock.chromeApi.alarms.onAlarm.listeners.length, 1);
  assert.equal(mock.chromeApi.runtime.onMessage.listeners.length, 1);

  await controller.initialize();
  assert.equal(mock.alarms[0].name, REFRESH_ALARM);
});

test("an unavailable optional toolbar method cannot block popup state", async () => {
  const mock = createChromeMock();
  delete mock.chromeApi.action.setBadgeTextColor;
  const controller = createBackgroundController({
    chromeApi: mock.chromeApi,
    fetchFn: async () => response([rawOffer()]),
    now: () => NOW
  });

  await controller.refreshOffers({ force: true });
  const result = await controller.handleMessage({ type: "GET_STATE" });

  assert.equal(result.ok, true);
  assert.equal(result.state.offersCache.items.length, 1);
  assert.equal(latestAction(mock.actionCalls, "badge").text, "1");
});
