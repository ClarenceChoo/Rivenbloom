import typeScriptEslint from '@typescript-eslint/eslint-plugin';
import typeScriptParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/', 'node_modules/', 'coverage/']
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typeScriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': typeScriptEslint
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
];
