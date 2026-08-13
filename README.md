# Free Games Tracker

Free Games Tracker is a configurable Chrome extension that displays every active giveaway returned by GamerPower. It stores preferences and visited-offer IDs locally, then highlights only unseen offers that match the selected platforms and offer types.

## Features

- Complete active GamerPower feed with future platform/type discovery
- Steam, Epic Games Store, and GOG games/DLC enabled by default
- Persistent platform and offer-type settings
- Bright toolbar icon and unseen-offer badge
- Local clicked-offer history with 90-day pruning
- Hourly background refresh and stale-cache fallback
- Accessible popup with no accounts, analytics, or backend

## Load the extension locally

1. Run `npm run icons` if the PNG icon files are missing.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this repository directory.
5. Pin **Free Games Tracker** from Chrome’s Extensions menu.

Chrome 120 or later is required.

## Develop and test

The runtime uses native JavaScript modules and has no production or development dependencies.

```sh
npm test
npm run icons
npm run package
```

`npm run package` validates the runtime layout by copying only extension files into `dist/` and creates `release/free-games-tracker-0.1.0.zip` for Chrome Web Store upload.

## Permissions

- `storage`: saves preferences, the latest offer cache, discovered categories, and clicked-offer timestamps locally.
- `alarms`: refreshes the feed once per hour while Chrome is running.
- `https://www.gamerpower.com/*`: retrieves giveaway data and images from GamerPower.

The extension does not request browsing-history, active-tab, notification, identity, or broad website access.

## Troubleshooting

- If the popup shows saved results, GamerPower may be temporarily unreachable. Use **Refresh** after checking the connection.
- If no offers appear, open settings and verify that at least one platform and one offer type are selected.
- For service-worker errors, open `chrome://extensions`, find the extension, and select its service-worker inspection link.

## Data and attribution

Giveaway information is provided by [GamerPower](https://www.gamerpower.com/). Clicking **Get offer** records that offer as seen, then opens GamerPower’s claim link. A click does not verify that an item was added to a storefront library.

See [PRIVACY.md](PRIVACY.md) for the complete privacy disclosure.
