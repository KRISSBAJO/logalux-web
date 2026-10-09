import { FlatCompat } from "@eslint/eslintrc";

// Next's own rules, as a flat config. The admin console is kept clean; other areas are linted but not yet gated.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      ".next-qa/**",
      "node_modules/**",
      "next-env.d.ts",
      "public/**",
      // Outside the admin console and not yet brought up to the rules. Remove a line here once its file is fixed.
      "scripts/checkout-request.test.cjs",
      "scripts/customer-booking-retry.cjs",
      "src/app/account/actions.ts",
      "src/app/account/privacy.tsx",
      "src/app/b/\\[slug\\]/book/repeat.tsx",
      "src/app/business/(app)/services/page.tsx",
      "src/app/business/(app)/staff/page.tsx",
      "src/app/mobile/continue/page.tsx",
    ],
  },
];

export default config;
