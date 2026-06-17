// .lighthouserc.cjs
"use strict";

module.exports = {
  ci: {
    collect: {
      // Runs against the production server (npm run start:prod)
      url: [
        "http://127.0.0.1:3000/cs",
        "http://127.0.0.1:3000/cs/pricing",
      ],
      // Server must be running before lhci autorun — use lighthouse:ci:server
      numberOfRuns: 1,
      settings: {
        // Czech locale for accurate i18n audit
        locale: "cs-CZ",
        // Emulate Moto G4 (Lighthouse default)
        preset: "desktop",
        // Ignore PWA category — SW disabled in dev; run against prod build only
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.75 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
        // Core Web Vitals
        "largest-contentful-paint": ["warn", { maxNumericValue: 3500 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 500 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
