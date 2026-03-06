module.exports = {
  '*.{ts,tsx}': ['ESLINT_USE_FLAT_CONFIG=false eslint --fix', 'prettier --write'],
};
