import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'ts/no-empty-object-type': 'off',
    'e18e/prefer-static-regex)': 'off',
  },
  vue: true,
  typescript: true,
})
