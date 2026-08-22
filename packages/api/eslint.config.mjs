import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='json'] > ObjectExpression:not(:has(Property[key.name='error']))",
          message:
            'Do not pass bare success object literals directly to res.json(). Assign to a typed @basbuddy/shared response interface first.',
        },
      ],
    },
  },
];
