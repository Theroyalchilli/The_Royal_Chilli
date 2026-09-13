const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

const customJestConfig = {
  setupFiles: ["<rootDir>/jest.setup.js"],
  testEnvironment: "node",
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/e2e/"],
  // next/jest's SWC transform resolves the "@/*" tsconfig path alias for
  // regular imports, but jest.mock()'s target string is resolved by Jest's
  // own resolver, which never learns about that alias without this — so
  // jest.mock("@/lib/supabase", ...) failed with "Cannot find module" even
  // though `import ... from "@/lib/supabase"` worked fine in the same file.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};

module.exports = createJestConfig(customJestConfig);
