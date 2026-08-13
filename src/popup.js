import { DEFAULT_PREFERENCES, STORAGE_KEYS } from "./constants.js";
import {
  discoverCategories,
  filterOffers,
  getUnseenOffers,
  mergeKnownCategories,
  normalizePreferences,
  pruneSeenOffers
} from "./domain.js";

const elements = {
  backButton: document.querySelector("#back-button"),
  clearAllButton: document.querySelector("#clear-all-button"),
  emptyAction: document.querySelector("#empty-action"),
  emptyMessage: document.querySelector("#empty-message"),
  emptyState: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-title"),
  feedView: document.querySelector("#feed-view"),
  headerSummary: document.querySelector("#header-summary"),
  lastUpdated: document.querySelector("#last-updated"),
  loading: document.querySelector("#loading"),
  notice: document.querySelector("#notice"),
  offerList: document.querySelector("#offer-list"),
  platformOptions: document.querySelector("#platform-options"),
  refreshButton: document.querySelector("#refresh-button"),
  restoreDefaultsButton: document.querySelector("#restore-defaults-button"),
  selectAllButton: document.querySelector("#select-all-button"),
  settingsButton: document.querySelector("#settings-button"),
  settingsStatus: document.querySelector("#settings-status"),
  settingsView: document.querySelector("#settings-view"),
  typeOptions: document.querySelector("#type-options")
};

let state = null;
let showingSettings = false;
let saveSequence = 0;

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function loadCachedState() {
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  const offersCache = stored.offersCache && Array.isArray(stored.offersCache.items)
    ? stored.offersCache
    : { items: [], fetchedAt: 0 };

  return {
    offersCache,
    preferences: normalizePreferences(stored.preferences),
    knownCategories: mergeKnownCategories(
      stored.knownCategories,
      discoverCategories(offersCache.items)
    ),
    seenOffers: pruneSeenOffers(stored.seenOffers),
    lastFetchError: stored.lastFetchError ?? {
      message: "Live refresh is temporarily unavailable.",
      at: Date.now()
    }
  };
}

function formatDate(isoDate) {
  if (!isoDate) return "End date unknown";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "End date unknown";
  return `Ends ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getUTCFullYear() === new Date().getUTCFullYear() ? undefined : "numeric",
    timeZone: "UTC"
  }).format(date)}`;
}

function formatUpdated(timestamp) {
  const date = new Date(Number(timestamp));
  if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) return "Not updated yet";
  return `Updated ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date)}`;
}

function meaningfulWorth(worth) {
  return worth && !/^(?:n\/?a|0|\$0(?:\.00)?)$/i.test(worth.trim());
}

function createTag(text, extraClass = "") {
  const tag = document.createElement("span");
  tag.className = `tag ${extraClass}`.trim();
  tag.textContent = text;
  return tag;
}

function createOfferCard(offer, isNew) {
  const article = document.createElement("article");
  article.className = "offer-card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "offer-image-wrap";
  const image = document.createElement("img");
  image.className = "offer-image";
  image.alt = "";
  image.loading = "lazy";
  if (offer.thumbnailUrl) {
    image.src = offer.thumbnailUrl;
    image.addEventListener("error", () => { image.hidden = true; });
  } else {
    image.hidden = true;
  }
  const imagePlaceholder = document.createElement("span");
  imagePlaceholder.className = "image-placeholder";
  imagePlaceholder.textContent = "No cover available";
  imageWrap.append(image, imagePlaceholder);

  if (isNew) {
    const newPill = document.createElement("span");
    newPill.className = "new-pill";
    newPill.textContent = "New";
    imageWrap.append(newPill);
  }

  const body = document.createElement("div");
  body.className = "offer-body";
  const title = document.createElement("h3");
  title.className = "offer-title";
  title.textContent = offer.title;

  const tags = document.createElement("div");
  tags.className = "tag-row";
  tags.append(createTag(offer.type.label, "type"));
  for (const platform of offer.platforms) tags.append(createTag(platform.label));

  body.append(title, tags);
  if (offer.description) {
    const description = document.createElement("p");
    description.className = "offer-description";
    description.textContent = offer.description;
    body.append(description);
  }

  const meta = document.createElement("div");
  meta.className = "offer-meta";
  const details = document.createElement("div");
  details.className = "offer-details";
  if (meaningfulWorth(offer.worth)) {
    const worth = document.createElement("span");
    worth.className = "offer-worth";
    worth.textContent = `Usually ${offer.worth}`;
    details.append(worth);
  }
  const ends = document.createElement("span");
  ends.textContent = formatDate(offer.endsAt);
  details.append(ends);

  const claimButton = document.createElement("button");
  claimButton.className = "claim-button";
  claimButton.type = "button";
  claimButton.textContent = offer.claimUrl ? "Get offer" : "Link unavailable";
  claimButton.disabled = !offer.claimUrl;
  claimButton.setAttribute("aria-label", `Get offer: ${offer.title}`);
  claimButton.addEventListener("click", async () => {
    claimButton.disabled = true;
    claimButton.textContent = "Opening…";
    try {
      const response = await sendMessage({ type: "MARK_SEEN", offerId: offer.id });
      if (response?.ok) {
        state = response.state;
        renderFeed();
      }
    } finally {
      await chrome.tabs.create({ url: offer.claimUrl });
    }
  });

  meta.append(details, claimButton);
  body.append(meta);
  article.append(imageWrap, body);
  return article;
}

function showEmpty(title, message, actionLabel = "", action = null) {
  elements.emptyTitle.textContent = title;
  elements.emptyMessage.textContent = message;
  elements.emptyAction.hidden = !actionLabel;
  elements.emptyAction.textContent = actionLabel;
  elements.emptyAction.onclick = action;
  elements.emptyState.hidden = false;
}

function renderFeed() {
  elements.loading.hidden = true;
  elements.emptyState.hidden = true;
  elements.notice.hidden = true;
  elements.offerList.replaceChildren();

  if (!state) return;

  const offers = state.offersCache.items;
  const visibleOffers = filterOffers(offers, state.preferences);
  const unseenIds = new Set(
    getUnseenOffers(offers, state.preferences, state.seenOffers).map((offer) => offer.id)
  );
  const unseenCount = unseenIds.size;
  elements.headerSummary.textContent = unseenCount
    ? `${unseenCount} new offer${unseenCount === 1 ? "" : "s"} to check`
    : `${visibleOffers.length} active offer${visibleOffers.length === 1 ? "" : "s"}`;
  elements.lastUpdated.textContent = formatUpdated(state.offersCache.fetchedAt);

  if (state.lastFetchError && state.offersCache.fetchedAt) {
    elements.notice.textContent = `${state.lastFetchError.message} Showing the last saved results.`;
    elements.notice.hidden = false;
  }

  const noSelections =
    state.preferences.enabledPlatforms.length === 0 || state.preferences.enabledTypes.length === 0;

  if (!state.offersCache.fetchedAt && state.lastFetchError) {
    showEmpty(
      "Couldn’t load giveaways",
      "Check your connection and try again.",
      "Try again",
      refresh
    );
  } else if (noSelections) {
    showEmpty(
      "No categories selected",
      "Choose at least one platform and offer type in settings.",
      "Open settings",
      showSettings
    );
  } else if (offers.length === 0) {
    showEmpty("No active giveaways", "GamerPower is not reporting any active offers right now.");
  } else if (visibleOffers.length === 0) {
    showEmpty(
      "No matching offers",
      "There are active giveaways, but none match your selected platforms and types.",
      "Change settings",
      showSettings
    );
  } else {
    const fragment = document.createDocumentFragment();
    for (const offer of visibleOffers) fragment.append(createOfferCard(offer, unseenIds.has(offer.id)));
    elements.offerList.append(fragment);
  }
}

function createOption(category, kind, selectedKeys) {
  const label = document.createElement("label");
  label.className = "option";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = selectedKeys.has(category.key);
  checkbox.dataset.kind = kind;
  checkbox.value = category.key;
  checkbox.addEventListener("change", saveOptionsFromForm);
  const text = document.createElement("span");
  text.textContent = category.label;
  label.append(checkbox, text);
  return label;
}

function renderSettings() {
  if (!state) return;
  const selectedPlatforms = new Set(state.preferences.enabledPlatforms);
  const selectedTypes = new Set(state.preferences.enabledTypes);
  const platformFragment = document.createDocumentFragment();
  const typeFragment = document.createDocumentFragment();

  for (const category of state.knownCategories.platforms) {
    platformFragment.append(createOption(category, "platform", selectedPlatforms));
  }
  for (const category of state.knownCategories.types) {
    typeFragment.append(createOption(category, "type", selectedTypes));
  }

  elements.platformOptions.replaceChildren(platformFragment);
  elements.typeOptions.replaceChildren(typeFragment);
}

function readOptionsForm() {
  return {
    enabledPlatforms: [...document.querySelectorAll('input[data-kind="platform"]:checked')]
      .map((input) => input.value),
    enabledTypes: [...document.querySelectorAll('input[data-kind="type"]:checked')]
      .map((input) => input.value)
  };
}

async function persistPreferences(preferences) {
  const sequence = ++saveSequence;
  elements.settingsStatus.textContent = "Saving…";
  const response = await sendMessage({ type: "SAVE_PREFERENCES", preferences });
  if (sequence !== saveSequence) return;
  if (!response?.ok) {
    elements.settingsStatus.textContent = "Could not save settings.";
    return;
  }
  state = response.state;
  elements.settingsStatus.textContent = "Saved locally";
  renderFeed();
}

function saveOptionsFromForm() {
  void persistPreferences(readOptionsForm());
}

function setAllOptions(checked) {
  for (const input of document.querySelectorAll("#settings-view input[type=checkbox]")) {
    input.checked = checked;
  }
  void persistPreferences(readOptionsForm());
}

function restoreDefaults() {
  void persistPreferences({
    enabledPlatforms: [...DEFAULT_PREFERENCES.enabledPlatforms],
    enabledTypes: [...DEFAULT_PREFERENCES.enabledTypes]
  }).then(renderSettings);
}

function showSettings() {
  showingSettings = true;
  elements.feedView.hidden = true;
  elements.settingsView.hidden = false;
  elements.settingsButton.hidden = true;
  renderSettings();
  elements.backButton.focus();
}

function showFeed() {
  showingSettings = false;
  elements.settingsView.hidden = true;
  elements.feedView.hidden = false;
  elements.settingsButton.hidden = false;
  renderFeed();
  elements.settingsButton.focus();
}

async function refresh() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = "Refreshing…";
  try {
    const response = await sendMessage({ type: "REFRESH" });
    if (response?.ok) {
      state = response.state;
      showingSettings ? renderSettings() : renderFeed();
    }
  } finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = "Refresh";
  }
}

async function initialize() {
  try {
    const response = await sendMessage({ type: "GET_STATE" });
    if (!response?.ok) throw new Error(response?.error || "Unable to load extension state.");
    state = response.state;
    renderFeed();
  } catch {
    try {
      state = await loadCachedState();
      renderFeed();
    } catch {
      elements.loading.hidden = true;
      showEmpty("Extension unavailable", "Reload the extension from chrome://extensions and try again.");
    }
  }
}

elements.settingsButton.addEventListener("click", showSettings);
elements.backButton.addEventListener("click", showFeed);
elements.refreshButton.addEventListener("click", refresh);
elements.selectAllButton.addEventListener("click", () => setAllOptions(true));
elements.clearAllButton.addEventListener("click", () => setAllOptions(false));
elements.restoreDefaultsButton.addEventListener("click", restoreDefaults);

void initialize();
