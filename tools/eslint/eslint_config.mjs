import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';
import { defineConfig, globalIgnores } from "eslint/config";
export default defineConfig(
  globalIgnores(["**/dist/", "types/", '**/tmp2/', '**/tmp/', '**/unused_code/', '**/old', '**/converter_old/', '**/try/', "**/data/", "**/node_modules/", "**/*.json", "**/*.xml", "**/*.zip", "**/*.css"]),
  eslint.configs.recommended, //taking all rules from eslint, truning select ones off below
  tseslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: '../..'
      },
    },
  },
  {
    plugins: {
      'import-x': importX,
    },
    rules: {
      //'import-x/no-cycle': 'error', //commented out because slow, turn on when needed
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^(_|debug_)",
        caughtErrorsIgnorePattern: "^_",
      }],
      //less than recomended
      "@typescript-eslint/no-explicit-any": "off",
      "no-unused-labels": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-use-before-define": [
        "warn",
        {
          "ignoreTypeReferences": false
        }
      ],
      "@typescript-eslint/only-throw-error":"off",
      //more than recomended
      "no-duplicate-imports":"warn",
      "max-params":"warn",
      "complexity":"warn",
      "eqeqeq": ["error", "always", { "null": "ignore" }],

    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  }
);