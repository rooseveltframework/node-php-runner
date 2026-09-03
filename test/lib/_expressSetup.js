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

  // route to test the default settings with a callback function
  app.get('/defaultsWithCallbackFunction', (req, res) => {
    res.render('basicTest', {
      hello: 'world'
    }, (err, html) => {
      if (err) return
      res.send(html)
    })
  })

  // route to test parsing a template with a coding error
  app.get('/codingError', (req, res) => {
    res.render('codingError', {
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

  // route to test a template that takes the whole PHP process down with it
  app.get('/killsTheWorker', (req, res) => {
    res.render('killsTheWorker', {})
  })

  // routes to test that one render cannot see what an earlier one left behind
  app.get('/leakSetter', (req, res) => {
    res.render('leakSetter', {})
  })

  app.get('/leakReader', (req, res) => {
    res.render('leakReader', {})
  })

  // express prints the stack of any 500 it serves, and two of these routes fail on purpose, so the
  // test output would carry stack traces that mean nothing. the message still reaches the response,
  // which is what the tests read
  app.use((err, req, res, next) => {
    res.status(500).send('Error: ' + err.message)
  })

  return app
}
