const php = require('../index')
const request = require('supertest')
const test = require('ava')
const expressSetup = require('./lib/_expressSetup')

test.before(t => {
  const app = expressSetup()

  t.context.app = app
  t.context.server = app.listen('43711')
})

test.after(t => {
  t.context.server.close()
})

console.log('General tests:\n')

test.serial('Executing a PHP script with `run`', async t => {
  const res = await php.run('./test/lib/templates/selfContainedTest.php')
  t.true(res.includes('<p>world</p>'))
})

test.serial('Executing a PHP script with `runWithData` and passing it some data', async t => {
  const res = await php.runWithData('./test/lib/templates/basicTest.php', { hello: 'world' })
  t.true(res.includes('<p>world</p>'))
})

test.serial('Executing a PHP script that has a coding error with `run`', async t => {
  try {
    await php.run('./test/lib/templates/codingError.php')
  } catch (e) {
    t.true(e.message.includes('PHP process exited with code 255'))
  }
})

test.serial('Executing a PHP script that has a coding error with `runWithData`', async t => {
  try {
    await php.runWithData('./test/lib/templates/codingError.php')
  } catch (e) {
    t.true(e.message.includes('PHP process exited with code 255'))
  }
})

console.log('\nExpress server tests:\n')

test.serial('Passing a model variable down from Express to PHP and getting it to render as a registered global', async t => {
  const res = await request(t.context.app).get('/defaults')
  t.true(res.text.includes('<p>world</p>'))
})

test.serial('Passing a model variable down from Express to PHP and getting it to render as a registered global, then calling a callback function', async t => {
  const res = await request(t.context.app).get('/defaultsWithCallbackFunction')
  t.true(res.text.includes('<p>world</p>'))
})

test.serial('Passing a model variable down from Express to a PHP template that has a coding error', async t => {
  const res = await request(t.context.app).get('/codingError')
  t.true(res.text.includes('Error: PHP process exited with code 255'))
})

test.serial('Passing a model down from Express to PHP with the _REGISTER_GLOBAL_MODEL feature disabled at the model level', async t => {
  const res = await request(t.context.app).get('/disableRegisterGlobalModelAtModelLevel')
  t.true(res.text.includes('<p></p><p>world</p>'))
})

test.serial('Passing a model down from Express to PHP with the _REGISTER_GLOBAL_MODEL feature disabled globally', async t => {
  const res = await request(t.context.app).get('/disableRegisterGlobalModelGlobally')
  t.true(res.text.includes('<p></p><p>world</p>'))
})

test.serial('Passing a model down from Express to PHP with the _REGISTER_GLOBAL_MODEL feature disabled globally then reenabled', async t => {
  const res = await request(t.context.app).get('/disableRegisterGlobalModelGloballyThenReenabled')
  t.true(res.text.includes('<p>world</p><p>world</p>'))
})
