/**
 * Setup an Express app to test against
 */

const express = require('express')
const path = require('path')

module.exports = () => {
  // init express app
  const app = express()
  const php = require('../..')

  // setup php templating engine
  app.set('views', path.join(__dirname, 'templates'))
  app.set('view engine', 'php')
  app.engine('php', php.__express)

  // route to test the default settings
  app.get('/defaults', (req, res) => {
    res.render('basicTest', {
      hello: 'world'
    })
  })

  // route to test disabling registering the model as globals
  app.get('/disableRegisterGlobalModelAtModelLevel', (req, res) => {
    res.render('registerGlobalModelTest', {
      _REGISTER_GLOBAL_MODEL: false,
      hello: 'world'
    })
  })

  // route to test disabling registering the model as globals
  app.get('/disableRegisterGlobalModelGlobally', (req, res) => {
    php.disableRegisterGlobalModel()
    res.render('registerGlobalModelTest', {
      hello: 'world'
    })
  })

  // route to test disabling registering the model as globals
  app.get('/disableRegisterGlobalModelGloballyThenReenabled', (req, res) => {
    php.disableRegisterGlobalModel()
    php.enableRegisterGlobalModel()
    res.render('registerGlobalModelTest', {
      hello: 'world'
    })
  })

  return { app, php };
}
