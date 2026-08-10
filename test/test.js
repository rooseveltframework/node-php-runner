const fs = require('node:fs')
const php = require('../index')
const request = require('supertest')
const test = require('ava').default
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

test.serial('Executing a PHP script with `run`', t => {
  const res = php.run('./test/lib/templates/selfContainedTest.php')
  t.true(res.includes('<p>world</p>'))
})

test.serial('Executing a PHP script with `runWithData` and passing it some data', t => {
  const res = php.runWithData('./test/lib/templates/basicTest.php', { hello: 'world' })
  t.true(res.includes('<p>world</p>'))
})

test.serial('Executing a PHP script that has a coding error with `run`', t => {
  const err = t.throws(() => php.run('./test/lib/templates/codingError.php'))
  t.true(err.message.includes('PHP process exited with code 255'))
})

test.serial('Shell metacharacters in the script path are not executed as shell commands', t => {
  const err = t.throws(() => php.run('./test/lib/templates/selfContainedTest.php; echo pwned'))
  t.true(err.message.includes('PHP process exited with code'))
})

test.serial('Executing a PHP script that has a coding error with `runWithData`', t => {
  const err = t.throws(() => php.runWithData('./test/lib/templates/codingError.php'))
  t.true(err.message.includes('PHP process exited with code 255'))
})

test.serial('Executing PHP code from memory with `runCode`', t => {
  const res = php.runCode('<?php echo "<p>world</p>"; ?>')
  t.true(res.includes('<p>world</p>'))
})

test.serial('Executing PHP code from memory with `runCode` that mixes html and PHP', t => {
  const res = php.runCode('<?php $hello = "world"; ?><p><?=$hello?></p>')
  t.true(res.includes('<p>world</p>'))
})

test.serial('Executing PHP code from memory with `runCode` that has a coding error', t => {
  const err = t.throws(() => php.runCode('<?php this is not php ;;; ?>'))
  t.true(err.message.includes('PHP process exited with code'))
})

test.serial('Executing PHP code from memory with `runCodeWithData` and passing it some data', t => {
  const res = php.runCodeWithData('<p><?=$hello?></p>', { hello: 'world' })
  t.true(res.includes('<p>world</p>'))
})

test.serial('Executing PHP code from memory with `runCodeWithData` that mixes html and PHP', t => {
  const res = php.runCodeWithData('<p><?=$hello?></p><?php echo "<b>ok</b>"; ?>', { hello: 'world' })
  t.true(res.includes('<p>world</p><b>ok</b>'))
})

test.serial('Executing PHP code from memory with `runCodeWithData` and reading the model without registered globals', t => {
  const res = php.runCodeWithData('<p><?=$model->hello?></p>', { hello: 'world', _REGISTER_GLOBAL_MODEL: false })
  t.true(res.includes('<p>world</p>'))
})

test.serial('Executing PHP code from memory with `runCodeWithData` preserves leading whitespace in the source', t => {
  const res = php.runCodeWithData('\n\n<p><?=$hello?></p>', { hello: 'world' })
  t.is(res, '\n\n<p>world</p>')
})

test.serial('Executing PHP code from memory with `runCodeWithData` renders identically to the same source in a file', t => {
  const template = './test/lib/templates/leadingWhitespaceTest.php'
  const source = fs.readFileSync(template, 'utf8')
  const fromMemory = php.runCodeWithData(source, { hello: 'world' })
  const fromFile = php.runWithData(template, { hello: 'world' })
  t.is(fromMemory, fromFile)
})

test.serial('Executing PHP code from memory with `runCodeWithData` that has a coding error', t => {
  const err = t.throws(() => php.runCodeWithData('<?php this is not php ;;; ?>'))
  t.true(err.message.includes('PHP process exited with code'))
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
