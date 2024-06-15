const ava = require('eslint-plugin-ava')

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 'latest'
    },
    plugins: {
      ava
    }
  }
]
