import openmrs from '@openmrs/eslint-config';

export default [
  { ignores: ['dist/**', 'coverage/**'] },
  ...openmrs,
  {
    rules: {
      // ban-types no longer names a rule on typescript-eslint v8, so the
      // three rules it was split into were being enforced.
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',
      '@typescript-eslint/triple-slash-reference': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
