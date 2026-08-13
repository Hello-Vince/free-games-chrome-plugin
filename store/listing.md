# Chrome Web Store submission — Free Games Tracker 0.1.0

## Store listing

### Product name

Free Games Tracker

### Summary

Find active game giveaways and track which offers you have already visited.

### Detailed description

Free Games Tracker brings active game giveaways from GamerPower into a lightweight Chrome popup.

- Browse active giveaways and limited-time game offers in one place.
- Filter the feed by platform and offer type.
- See an extension badge when matching offers have not been opened yet.
- Open a giveaway's GamerPower claim link in a new tab.
- Keep using the most recently saved results if a live refresh is temporarily unavailable.

Preferences, cached offers, and visited-offer history stay in Chrome's local extension storage. Free Games Tracker has no account system, analytics, advertising, or extension-owned backend.

Giveaway information is provided by GamerPower. Availability, eligibility, end times, and redemption requirements are controlled by the giveaway provider and may vary by region. Opening an offer does not verify that it was redeemed or added to a game library.

### Classification

- Category: Shopping
- Language: English
- Pricing: Free
- Regions: All regions
- Initial visibility: Unlisted

### URLs

- Homepage: https://hello-vince.github.io/free-games-chrome-plugin/
- Privacy policy: https://hello-vince.github.io/free-games-chrome-plugin/privacy/
- Support: https://github.com/Hello-Vince/free-games-chrome-plugin/issues

## Privacy practices

### Single purpose

Free Games Tracker retrieves active game giveaways from GamerPower, lets users filter them by platform and offer type, and locally tracks which offers they have opened.

### Permission justifications

#### storage

Required to save selected filters, cached giveaway data, discovered categories, clicked-offer IDs and timestamps, and the latest refresh status in `chrome.storage.local`. This supports persistent preferences, the unseen-offer badge, visited-offer state, and cached fallback when the live service is unavailable.

#### alarms

Required to schedule an hourly background refresh so the cached giveaway list and unseen-offer badge stay current while Chrome is running.

#### Host access: `https://www.gamerpower.com/*`

Required only to retrieve giveaway JSON and cover images from `www.gamerpower.com`, the extension's sole data provider. The extension does not inject scripts into GamerPower pages or read the user's activity on that website.

### Remote code

Select **No, I am not using remote code**. All executable JavaScript and CSS is included in the submitted extension package. GamerPower responses and images are treated only as data and are never evaluated as code.

### User data disclosure

Select **User activity** because the extension locally records the IDs and timestamps of giveaway links clicked inside its own popup. This information is used only to mark offers as visited and update the unseen-offer badge. It remains in `chrome.storage.local`, is retained for up to 90 days, is not synchronized by the extension, and is not transmitted to the developer or another third party.

Do not select personally identifiable information, health information, financial or payment information, authentication information, personal communications, location, web history, or website content. The extension does not collect or use those categories.

### Certifications

Confirm that:

- User data is not sold to third parties.
- User data is not used or transferred for purposes unrelated to the extension's single purpose.
- User data is not used or transferred to determine creditworthiness or for lending.
- The extension complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Test instructions

No account, credentials, payment, or special environment is required.

1. Install the extension and open its toolbar popup.
2. Confirm that active GamerPower offers load and that the footer attributes GamerPower.
3. Select **Refresh** to request current results.
4. Open settings, change platform and offer-type filters, return to the feed, and confirm that the list changes.
5. Select **Get offer** on a card. Confirm that a GamerPower claim link opens in a new tab and the offer is no longer counted as new.
6. If GamerPower is temporarily unreachable, the extension displays the last saved results and a refresh notice.

## Graphic assets

- Store icon: `store/assets/icon-128.png` — 128×128 PNG with 96×96 artwork and transparent padding.
- Small promo tile: `store/assets/promo-440x280.png` — 440×280 PNG.
- Screenshot 1: `store/assets/screenshot-1-feed.png` — 1280×800 PNG.
- Screenshot 2: `store/assets/screenshot-2-filters.png` — 1280×800 PNG.
- Screenshot 3: `store/assets/screenshot-3-visited.png` — 1280×800 PNG.

## Distribution and rollout

Publish version 0.1.0 as **Unlisted** in all regions. Validate the store-installed build in at least two fresh Chrome profiles for 3–7 days. If feed loading, filters, persistence, badges, claim links, and cached fallback remain healthy, change the same listing to **Public** and complete any additional review.
