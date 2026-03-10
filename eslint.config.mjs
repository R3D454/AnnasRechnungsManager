import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: ["build/**", ".react-router/**", "node_modules/**"],
  },
  {
    rules: {
      "no-unused-vars": "off",
    },
  },
];
