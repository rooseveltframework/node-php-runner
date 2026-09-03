const assert = require('node:assert')
const fs = require('node:fs')
const { after, before, test } = require('node:test')
const php = require('../index')
const expressSetup = require('./lib/_expressSetup')

const port = 43711
let server

before(() => {
  server = expressSetup().listen(port)
})

after(() => {
  server.close()
  php.stopWorkers()
})

// the error a call threw, for the tests that check what a failure says. node's assert.throws
// checks that something threw but does not hand the error back, and these want to read it
function caught (fn) {
  try {
    fn()
  } catch (error) {
    return error
  }
  assert.fail('expected this to throw, and it did not')
}

// the express tests ask the running server for a page, the way anything else would
async function get (path) {
  const res = await fetch(`http://localhost:${port}${path}`)
  return { status: res.status, text: await res.text() }
}

test('Executing a PHP script with `run`', () => {
  const res = php.run('./test/lib/templates/selfContainedTest.php')
  assert.ok(res.includes('<p>world</p>'))
})

test('Executing a PHP script with `runWithData` and passing it some data', () => {
  const res = php.runWithData('./test/lib/templates/basicTest.php', { hello: 'world' })
  assert.ok(res.includes('<p>world</p>'))
})

test('Executing a PHP script that has a coding error with `run`', () => {
  const err = caught(() => php.run('./test/lib/templates/codingError.php'))
  assert.ok(err.message.includes('PHP process exited with code 255'))
})

test('Shell metacharacters in the script path are not executed as shell commands', () => {
  const err = caught(() => php.run('./test/lib/templates/selfContainedTest.php; echo pwned'))
  assert.ok(err.message.includes('PHP process exited with code'))
})

test('Executing a PHP script that has a coding error with `runWithData`', () => {
  const err = caught(() => php.runWithData('./test/lib/templates/codingError.php'))
  assert.ok(err.message.includes('PHP process exited with code 255'))
})

test('Executing PHP code from memory with `runCode`', () => {
  const res = php.runCode('<?php echo "<p>world</p>"; ?>')
  assert.ok(res.includes('<p>world</p>'))
})

test('Executing PHP code from memory with `runCode` that mixes html and PHP', () => {
  const res = php.runCode('<?php $hello = "world"; ?><p><?=$hello?></p>')
  assert.ok(res.includes('<p>world</p>'))
})

test('Executing PHP code from memory with `runCode` that has a coding error', () => {
  const err = caught(() => php.runCode('<?php this is not php ;;; ?>'))
  assert.ok(err.message.includes('PHP process exited with code'))
})

test('Executing PHP code from memory with `runCodeWithData` and passing it some data', () => {
  const res = php.runCodeWithData('<p><?=$hello?></p>', { hello: 'world' })
  assert.ok(res.includes('<p>world</p>'))
})

test('Executing PHP code from memory with `runCodeWithData` that mixes html and PHP', () => {
  const res = php.runCodeWithData('<p><?=$hello?></p><?php echo "<b>ok</b>"; ?>', { hello: 'world' })
  assert.ok(res.includes('<p>world</p><b>ok</b>'))
})

test('Executing PHP code from memory with `runCodeWithData` and reading the model without registered globals', () => {
  const res = php.runCodeWithData('<p><?=$model->hello?></p>', { hello: 'world', _REGISTER_GLOBAL_MODEL: false })
  assert.ok(res.includes('<p>world</p>'))
})

test('Executing PHP code from memory with `runCodeWithData` preserves leading whitespace in the source', () => {
  const res = php.runCodeWithData('\n\n<p><?=$hello?></p>', { hello: 'world' })
  assert.strictEqual(res, '\n\n<p>world</p>')
})

test('Executing PHP code from memory with `runCodeWithData` renders identically to the same source in a file', () => {
  const template = './test/lib/templates/leadingWhitespaceTest.php'
  const source = fs.readFileSync(template, 'utf8')
  const fromMemory = php.runCodeWithData(source, { hello: 'world' })
  const fromFile = php.runWithData(template, { hello: 'world' })
  assert.strictEqual(fromMemory, fromFile)
})

test('Executing PHP code from memory with `runCodeWithData` that has a coding error', () => {
  const err = caught(() => php.runCodeWithData('<?php this is not php ;;; ?>'))
  assert.ok(err.message.includes('PHP process exited with code'))
})

test('Executing a PHP script with `runWithData` while registering the model as globals is disabled', () => {
  php.disableRegisterGlobalModel()
  const res = php.runWithData('./test/lib/templates/registerGlobalModelTest.php', { hello: 'world' })
  php.enableRegisterGlobalModel()
  assert.ok(res.includes('<p></p><p>world</p>'))
})

test('Passing a model leaves the caller\'s own object alone', () => {
  const mine = { hello: 'world' }
  php.runWithData('./test/lib/templates/basicTest.php', mine)
  assert.deepStrictEqual(Object.keys(mine), ['hello'], 'this module wrote its own keys into an object that belongs to the caller')
})

test('Passing a model with a key of its own called model still renders', () => {
  // what the loader needs to know used to live in the model, under a name a model could take
  const res = php.runWithData('./test/lib/templates/basicTest.php', { model: 'a value of my own', hello: 'world' })
  assert.ok(res.includes('<p>world</p>'))
})

test('A template sees only the model it was given, not what this module needed to run it', () => {
  const res = php.runCodeWithData('<?= implode(",", array_keys((array) $model)) ?>', { hello: 'world', count: 1 })
  assert.strictEqual(res.trim(), 'hello,count')
})

test('Passing a model that holds the same object in two places sends both copies, not a circular reference marker', () => {
  const shared = { name: 'world' }
  const res = php.runCodeWithData('<p><?=$a->name?></p><p><?=$b->name?></p>', { a: shared, b: shared })
  assert.strictEqual(res, '<p>world</p><p>world</p>')
})

test('Passing a model that holds the same object several times in an array sends every copy', () => {
  const shared = { name: 'world' }
  const res = php.runCodeWithData('<?php foreach ($list as $item) { ?><p><?=$item->name?></p><?php } ?>', { list: [shared, shared, shared] })
  assert.strictEqual(res, '<p>world</p><p>world</p><p>world</p>')
})

test('Passing a model whose separate branches share a nested object sends both copies', () => {
  const shared = { name: 'world' }
  const res = php.runCodeWithData('<p><?=$one->inner->name?></p><p><?=$two->inner->name?></p>', { one: { inner: shared }, two: { inner: shared } })
  assert.strictEqual(res, '<p>world</p><p>world</p>')
})

test('Passing a model that contains itself replaces the circular reference rather than following it', () => {
  const model = { hello: 'world' }
  model.self = model
  const res = php.runCodeWithData('<p><?=$hello?></p><p><?=$self?></p>', model)
  assert.strictEqual(res, '<p>world</p><p>[Circular]</p>')
})

test('Passing a model with a longer cycle in it replaces only the reference that closes the cycle', () => {
  const parent = { name: 'parent' }
  parent.child = { name: 'child', parent }
  const res = php.runCodeWithData('<p><?=$root->name?></p><p><?=$root->child->name?></p><p><?=$root->child->parent?></p>', { root: parent })
  assert.strictEqual(res, '<p>parent</p><p>child</p><p>[Circular]</p>')
})

console.log('\nExpress server tests:\n')

test('Passing a model variable down from Express to PHP and getting it to render as a registered global', async () => {
  const res = await get('/defaults')
  assert.ok(res.text.includes('<p>world</p>'))
})

test('Passing a model variable down from Express to PHP and getting it to render as a registered global, then calling a callback function', async () => {
  const res = await get('/defaultsWithCallbackFunction')
  assert.ok(res.text.includes('<p>world</p>'))
})

test('Passing a model variable down from Express to a PHP template that has a coding error', async () => {
  const res = await get('/codingError')
  // a worker survives a template it cannot parse, so what comes back names the error rather than
  // reporting that the process died
  assert.ok(res.text.includes('ParseError'))
  assert.ok(res.text.includes('codingError.php'))
})

test('A template that fails to render leaves the worker able to render the next one', async () => {
  await get('/codingError')
  const res = await get('/defaults')
  assert.ok(res.text.includes('<p>world</p>'))
})

test('Rendering through Express produces the same markup as rendering the same template on its own', async () => {
  const res = await get('/defaults')
  const direct = php.runWithData('./test/lib/templates/basicTest.php', { hello: 'world' })
  assert.strictEqual(res.text, direct)
})

test('Rendering the same template many times through Express keeps giving the same markup', async () => {
  const seen = new Set()
  for (let i = 0; i < 25; i++) {
    const res = await get('/defaults')
    seen.add(res.text)
  }
  assert.strictEqual(seen.size, 1)
  assert.ok([...seen][0].includes('<p>world</p>'))
})

test('A template cannot see variables left behind by the render before it', async () => {
  await get('/leakSetter')
  const res = await get('/leakReader')
  assert.ok(res.text.includes('<p>not set</p>'))
})

test('A template that takes the whole PHP process down is reported rather than left hanging', async () => {
  const res = await get('/killsTheWorker')
  assert.ok(res.text.includes('PHP worker process exited with code 3'))
  assert.ok(res.text.includes('killsTheWorker'))
})

test('A worker that died is replaced, so the next render still works', async () => {
  await get('/killsTheWorker')
  const res = await get('/defaults')
  assert.ok(res.text.includes('<p>world</p>'))
})

test('Editing a template shows up on the next render rather than after a delay', async () => {
  // both renders have to land on the same worker: each one compiles a template for itself, so a
  // render that went to a second worker would compile the new text no matter what, and this would
  // pass whether or not the first worker had been told to notice the edit
  //
  // the pool is left at one worker afterwards, which the tests below this one set for themselves
  php.configureWorkers({ size: 1 })

  const template = './test/lib/templates/editedWhileRunning.php'
  const render = () => new Promise(resolve => php.__express(template, {}, (err, html) => resolve(err || html)))

  // php will not keep a compiled copy of a file written in the last couple of seconds, on the
  // grounds that it may be half written. so each version is backdated: the first far enough for php
  // to compile and keep it, and the second newer than that but still old enough to be trusted
  //
  // without this there would be no compiled copy to serve, and a stale one is the whole point
  const write = (contents, secondsAgo) => {
    fs.writeFileSync(template, contents)
    const when = new Date(Date.now() - secondsAgo * 1000)
    fs.utimesSync(template, when, when)
  }

  try {
    write('<p>before</p>\n', 10)
    const before = await render()
    write('<p>after</p>\n', 5)
    const after = await render()
    assert.ok(String(before).includes('<p>before</p>'))
    assert.ok(String(after).includes('<p>after</p>'), 'the edit was not picked up, so a stale compiled copy was served')
  } finally {
    fs.rmSync(template, { force: true })
  }
})

// a template is sent only the parts of a model it reads, worked out from the template itself. these
// cover what that has to get right: the same markup either way, everything sent to a template whose
// reads cannot be worked out, and a template that starts reading something new being noticed
const trimModel = { one: 'first', two: 'second' }

// the first render of a template is the one that works out what it reads, and it is sent the whole
// model while doing so. it is the render after that which is sent less, so that is the one these
// have to look at
async function renderTwice (template) {
  const once = () => new Promise(resolve => php.__express(template, { ...trimModel }, (err, html) => resolve(err || html)))
  await once()
  return String(await once())
}

test('A template is rendered the same whether or not the model is trimmed to what it reads', async () => {
  const template = './test/lib/templates/trimReadsOne.php'
  php.configureWorkers({ trimModel: false })
  const whole = await renderTwice(template)
  php.configureWorkers({ trimModel: true })
  const trimmed = await renderTwice(template)
  assert.strictEqual(trimmed, whole)
  assert.ok(trimmed.includes('<p>first</p>'))
})

test('A template that reads the model through $model is sent all of it', async () => {
  assert.ok((await renderTwice('./test/lib/templates/trimUsesWholeModel.php')).includes('<p>second</p>'))
})

test('A template that names parts of the model as strings rather than as variables is sent all of it', async () => {
  const html = await renderTwice('./test/lib/templates/trimUsesCompact.php')
  assert.ok(html.includes('<p>first,second</p>'), 'compact() read names the analysis cannot see, so the whole model has to be sent')
})

test('What a partial reads counts as what the template reads', async () => {
  const html = await renderTwice('./test/lib/templates/trimIncludesPartial.php')
  assert.ok(html.includes('<p>first</p>'))
  assert.ok(html.includes('<p>second</p>'), 'the partial did not get the part of the model it reads')
})

// each of these reads the model by a route that an earlier version of the analysis did not see, and
// each was a template that rendered differently once its model was trimmed
test('A template reaching the model by an awkward route is still sent what it needs', async () => {
  const awkward = [
    ['trimCompactQualified', 'a fully qualified \\compact() call'],
    ['trimCompactCallUserFunc', 'compact() reached through call_user_func'],
    ['trimCompactComment', 'a comment between compact and its bracket'],
    ['trimGetDefinedVarsQualified', 'a fully qualified \\get_defined_vars() call']
  ]
  for (const [name, why] of awkward) {
    const html = await renderTwice('./test/lib/templates/' + name + '.php')
    assert.ok(html.includes('first,second'), why + ' was not noticed, so the template was sent less than it reads')
  }
})

test('A partial pulled in with brackets around its name is followed like any other', async () => {
  const html = await renderTwice('./test/lib/templates/trimIncludeParens.php')
  assert.ok(html.includes('<p>first</p>'))
  assert.ok(html.includes('<p>second</p>'))
})

test('A template that starts reading something new is sent it, rather than what it used to read', async () => {
  const template = './test/lib/templates/trimEdited.php'
  const render = () => new Promise(resolve => php.__express(template, { ...trimModel }, (err, html) => resolve(err || html)))
  try {
    fs.writeFileSync(template, '<p><?= $one ?></p>\n')
    const before = await render()
    // now it reads a part of the model that was being left out
    fs.writeFileSync(template, '<p><?= $two ?></p>\n')
    const after = await render()
    assert.ok(String(before).includes('<p>first</p>'))
    assert.ok(String(after).includes('<p>second</p>'), 'the template was still being sent only what it used to read')
  } finally {
    fs.rmSync(template, { force: true })
  }
})

test('A template whose partial has been deleted is worked out again rather than rendered from what it used to read', async () => {
  const template = './test/lib/templates/trimLosesPartial.php'
  const partial = './test/lib/templates/_trimLostPartial.php'
  const render = () => new Promise(resolve => php.__express(template, { ...trimModel }, (err, html) => resolve(err || html)))
  try {
    fs.writeFileSync(partial, '<p><?= $two ?></p>\n')
    fs.writeFileSync(template, "<p><?= $one ?></p><?php include '_trimLostPartial.php' ?>\n")
    assert.ok(String(await render()).includes('<p>second</p>'))
    await render()
    fs.rmSync(partial)
    // the partial is gone, so what the template reads is no longer what it was
    const after = String(await render())
    assert.ok(after.includes('<p>first</p>'))
    assert.ok(!after.includes('<p>second</p>'))
  } finally {
    fs.rmSync(template, { force: true })
    fs.rmSync(partial, { force: true })
  }
})

test('A template that runs away is stopped by the memory limit rather than being left to take the machine with it', async () => {
  // php's command line runtime has no memory limit of its own, so without one this test would run
  // until the operating system picked something to kill. a small limit makes it quick
  php.configureWorkers({ memoryLimit: '32M' })
  const err = await new Promise(resolve => php.__express('./test/lib/templates/runsAwayForever.php', {}, resolve))
  assert.ok(err, 'a template that never finishes should be reported, not waited on forever')
  assert.ok(String(err.message).includes('PHP worker process'))

  // and the pool has to be usable afterwards
  const after = await new Promise(resolve => php.__express('./test/lib/templates/basicTest.php', { hello: 'world' }, (e, html) => resolve(e || html)))
  assert.ok(String(after).includes('<p>world</p>'))
  php.configureWorkers({ memoryLimit: '256M' })
})

test('Rendering through Express with more than one worker in the pool', async () => {
  php.configureWorkers({ size: 4 })
  const results = await Promise.all(Array.from({ length: 20 }, () => get('/defaults')))
  assert.ok(results.every(res => res.text.includes('<p>world</p>')))
  php.configureWorkers({ size: 1 })
})

test('Rendering through Express with the worker pool switched off falls back to one process per render', async () => {
  php.configureWorkers({ enabled: false })
  const res = await get('/defaults')
  assert.ok(res.text.includes('<p>world</p>'))
  const err = await get('/codingError')
  assert.ok(err.text.includes('PHP process exited with code 255'))
  php.configureWorkers({ enabled: true })
})

test('Passing a model down from Express to PHP with the _REGISTER_GLOBAL_MODEL feature disabled at the model level', async () => {
  const res = await get('/disableRegisterGlobalModelAtModelLevel')
  assert.ok(res.text.includes('<p></p><p>world</p>'))
})

test('Passing a model down from Express to PHP with the _REGISTER_GLOBAL_MODEL feature disabled globally', async () => {
  const res = await get('/disableRegisterGlobalModelGlobally')
  assert.ok(res.text.includes('<p></p><p>world</p>'))
})

test('Passing a model down from Express to PHP with the _REGISTER_GLOBAL_MODEL feature disabled globally then reenabled', async () => {
  const res = await get('/disableRegisterGlobalModelGloballyThenReenabled')
  assert.ok(res.text.includes('<p>world</p><p>world</p>'))
})
