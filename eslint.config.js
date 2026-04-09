import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'ts/no-empty-object-type': 'off',
    'e18e/prefer-static-regex': 'off',
    'regexp/no-unused-capturing-group': 'off',
    'unicorn/no-new-array': 'off',
    'unused-imports/no-unused-vars': 'off',
  },
  vue: true,
  typescript: true,
})
