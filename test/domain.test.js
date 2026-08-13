import test from "node:test";
import assert from "node:assert/strict";

import {
  discoverCategories,
  filterOffers,
  formatBadgeCount,
  getUnseenOffers,
  mergeKnownCategories,
  normalizeKey,
  normalizeOffer,
  normalizeOffers,
  normalizePreferences,
  parseProviderDate,
  pruneSeenOffers
} from "../src/domain.js";
import { SEEN_RETENTION_MS } from "../src/constants.js";

const futureDate = "2099-08-20 23:59:00";

function rawOffer(overrides = {}) {
  return {
    id: 1,
    title: "Example Game Giveaway",
    description: "A game that is free for a limited time.",
    platforms: "PC, Steam",
    type: "Game",
    thumbnail: "https://www.gamerpower.com/example.jpg",
    open_giveaway_url: "https://www.gamerpower.com/open/example",
    worth: "$19.99",
    published_date: "2026-08-13 10:00:00",
    end_date: futureDate,
    status: "Active",
    ...overrides
  };
}

test("normalizes keys and provider dates consistently", () => {
  assert.equal(normalizeKey("Xbox Series X|S"), "xbox-series-x-s");
  assert.equal(normalizeKey("Itch.io"), "itch-io");
  assert.equal(parseProviderDate("2026-08-13 10:00:00"), "2026-08-13T10:00:00.000Z");
  assert.equal(parseProviderDate("N/A"), null);
});

test("normalizes an active offer and rejects invalid or inactive data", () => {
  const offer = normalizeOffer(rawOffer());
  assert.equal(offer.id, "1");
  assert.equal(offer.type.key, "game");
  assert.deepEqual(offer.platforms.map(({ key }) => key), ["pc", "steam"]);
  assert.equal(offer.claimUrl, "https://www.gamerpower.com/open/example");

  assert.equal(normalizeOffer(rawOffer({ status: "Expired" })), null);
  assert.equal(normalizeOffer(rawOffer({ id: null })), null);
  assert.equal(normalizeOffer(rawOffer({ platforms: "" })), null);
});

test("keeps unknown future categories, deduplicates, merges platforms, and sorts by expiry", () => {
  const offers = normalizeOffers([
    rawOffer({ id: 1, end_date: "2099-08-22 00:00:00" }),
    rawOffer({ id: 1, platforms: "VR", description: "Updated" }),
    rawOffer({ id: 2, title: "Mystery", type: "Future Drop", platforms: "Cloud Deck", end_date: "N/A" }),
    rawOffer({ id: 3, title: "Soon", end_date: "2099-08-19 00:00:00" })
  ]);

  assert.deepEqual(offers.map(({ id }) => id), ["3", "1", "2"]);
  assert.deepEqual(offers[1].platforms.map(({ key }) => key), ["pc", "steam", "vr"]);
  assert.equal(offers[2].type.key, "future-drop");
});

test("requires an array response", () => {
  assert.throws(() => normalizeOffers({ error: "bad payload" }), /array/i);
});

test("discovers and merges categories without losing known inactive stores", () => {
  const offers = normalizeOffers([
    rawOffer({ type: "Future Drop", platforms: "Cloud Deck" })
  ]);
  const discovered = discoverCategories(offers);
  const merged = mergeKnownCategories(discovered);

  assert.ok(merged.platforms.some(({ key }) => key === "gog"));
  assert.ok(merged.platforms.some(({ key }) => key === "cloud-deck"));
  assert.ok(merged.types.some(({ key }) => key === "future-drop"));
});

test("uses original-focus defaults and preserves explicit empty preferences", () => {
  assert.deepEqual(normalizePreferences(null), {
    enabledPlatforms: ["steam", "epic-games-store", "gog"],
    enabledTypes: ["game", "dlc"]
  });
  assert.deepEqual(normalizePreferences({}, false), {
    enabledPlatforms: [],
    enabledTypes: []
  });
});

test("filters with OR inside groups and AND between platform and type", () => {
  const offers = normalizeOffers([
    rawOffer({ id: 1, type: "Game", platforms: "PC, Steam" }),
    rawOffer({ id: 2, type: "DLC", platforms: "Epic Games Store" }),
    rawOffer({ id: 3, type: "Other", platforms: "Steam" }),
    rawOffer({ id: 4, type: "Game", platforms: "Playstation 5" }),
    rawOffer({ id: 5, type: "Game", platforms: "Steam", end_date: "2020-01-01 00:00:00" })
  ]);
  const filtered = filterOffers(offers, {
    enabledPlatforms: ["steam", "epic-games-store"],
    enabledTypes: ["game", "dlc"]
  }, Date.UTC(2026, 7, 13));

  assert.deepEqual(filtered.map(({ id }) => id), ["1", "2"]);
});

test("unseen state only includes visible unclicked offers", () => {
  const offers = normalizeOffers([
    rawOffer({ id: 1, platforms: "Steam" }),
    rawOffer({ id: 2, platforms: "Epic Games Store" })
  ]);
  const preferences = { enabledPlatforms: ["steam"], enabledTypes: ["game"] };

  assert.deepEqual(getUnseenOffers(offers, preferences, {}, Date.UTC(2026, 7, 13)).map(({ id }) => id), ["1"]);
  assert.deepEqual(getUnseenOffers(offers, preferences, { 1: 10 }, Date.UTC(2026, 7, 13)), []);
});

test("prunes old seen state and formats badge counts", () => {
  const now = 10_000_000_000;
  const pruned = pruneSeenOffers({
    recent: now - SEEN_RETENTION_MS + 1,
    old: now - SEEN_RETENTION_MS - 1,
    invalid: "yesterday"
  }, now);

  assert.deepEqual(pruned, { recent: now - SEEN_RETENTION_MS + 1 });
  assert.equal(formatBadgeCount(0), "");
  assert.equal(formatBadgeCount(8), "8");
  assert.equal(formatBadgeCount(140), "99+");
});
