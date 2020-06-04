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

test('Passing a model variable down from Express to PHP and getting it to render as a registered global', async t => {
  const res = await request(t.context.app).get('/defaults')
  t.true(res.text.includes('<p>world</p>'))
})

test('Passing a model down from Express to PHP with the _REGISTER_GLOBAL_MODEL feature disabled at the model level', async t => {
  const res = await request(t.context.app).get('/disableRegisterGlobalModelAtModelLevel')
  t.true(res.text.includes('<p></p><p>world</p>'))
})

test('Passing a model down from Express to PHP with the _REGISTER_GLOBAL_MODEL feature disabled globally', async t => {
  const res = await request(t.context.app).get('/disableRegisterGlobalModelGlobally')
  t.true(res.text.includes('<p></p><p>world</p>'))
})

test('Passing a model down from Express to PHP with the _REGISTER_GLOBAL_MODEL feature disabled globally then reenabled', async t => {
  const res = await request(t.context.app).get('/disableRegisterGlobalModelGloballyThenReenabled')
  t.true(res.text.includes('<p>world</p><p>world</p>'))
})
