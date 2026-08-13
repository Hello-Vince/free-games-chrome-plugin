# Privacy Notice — Free Games Tracker

Last updated: August 13, 2026

Free Games Tracker does not collect, sell, transmit, or analyze personal information. It has no account system, analytics, advertising, or extension-owned backend.

## Data stored locally

Chrome’s local extension storage contains:

- Selected platform and offer-type preferences
- A cached copy of active giveaway data
- Discovered platform and offer-type labels
- GamerPower offer IDs and timestamps for offers the user clicked
- The time and generic status of the latest refresh attempt

Clicked-offer timestamps are retained for up to 90 days and are then removed automatically. The other locally stored information remains until it is replaced, cleared, or the extension is removed.

This information stays in the current Chrome profile and is not synchronized by the extension. Click activity stored by the extension is not transmitted to the developer or used to build a profile of the user.

## External requests

The extension contacts `www.gamerpower.com` to retrieve the active giveaway feed and cover images. Those requests necessarily reveal standard connection information, such as the user’s IP address and browser request metadata, to GamerPower under its own privacy policy.

Selecting **Get offer** opens a GamerPower claim link in a new tab. GamerPower may redirect the user to the relevant game store. The destination sites apply their own privacy policies.

## Chrome permissions

The extension uses local storage, periodic alarms, and narrowly scoped access to `https://www.gamerpower.com/*`. It does not read browsing history, storefront accounts, game libraries, page content, or passwords.

## Limited Use

The use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. Free Games Tracker uses locally stored information only to provide its giveaway feed, filters, visited-offer state, cached fallback, and unseen-offer badge. It does not sell data, use data for advertising, or transfer user data to third parties.

## Delete local data

Removing Free Games Tracker from Chrome deletes the extension's local storage under Chrome's normal extension-removal behavior. Users and testers may also clear `chrome.storage.local` through the extension service worker's developer tools, which immediately resets preferences, cached offers, and visited-offer history.

## Changes

Material changes to this notice will be included with a new extension version and reflected by the date above.

The public version of this notice is available at [hello-vince.github.io/free-games-chrome-plugin/privacy/](https://hello-vince.github.io/free-games-chrome-plugin/privacy/).
