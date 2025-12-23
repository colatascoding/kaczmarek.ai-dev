module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "script"
  },
  rules: {
    "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": "off" // Allow console.log in CLI and server
  },
  ignorePatterns: [
    "node_modules/",
    ".kaczmarek-ai/",
    "coverage/"
  ]
};

