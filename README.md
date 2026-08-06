# DealCheck

A mobile-first commercial property acquisition screening web app.

## What is included

- Rent input by $/m²/year or total annual rent
- Instant yield, equity, cash flow, ROI and exit calculations
- Automatic saving of the latest inputs on the device
- Installable Progressive Web App (PWA)
- Offline use after the first successful visit
- iPhone Home Screen icon and standalone display

## Test locally

A service worker requires the app to be served over HTTP rather than opened directly as a file:

```bash
python3 -m http.server 8000
```

Run that command inside the `dealcheck` folder, then open `http://localhost:8000`.

## Put it on an iPhone

1. Upload the contents of this folder to Netlify, Vercel, GitHub Pages, or another HTTPS web host.
2. Open the hosted address in Safari on the iPhone.
3. Tap Share, then **Add to Home Screen**.
4. Launch DealCheck from its new Home Screen icon.

The app will continue to work offline after it has loaded successfully once.

## Model limitation

The model assumes interest-only debt and provides a simplified, pre-tax screening result. It is not a valuation, tax calculation, lending assessment, or full development feasibility.
