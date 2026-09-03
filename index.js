const path = require('path')
const { spawnSync } = require('child_process')
const pool = require('./pool')
const settings = {}
// whether a model's keys become variables the template can read. stored as what it is rather than as its opposite, so that reading it does not need untangling
settings.registerGlobalModel = true

function execPhp (args, input) {
  const result = spawnSync('php', args, { input })

  // php could not be started at all, e.g. it is not installed or not in the PATH
  if (result.error) throw result.error

  // on failure fold php's diagnostics into the error rather than letting them leak to stderr
  if (result.status !== 0) {
    const stderr = result.stderr.toString().trim()
    throw new Error(`PHP process exited with code ${result.status}${stderr ? `\n${stderr}` : ''}`)
  }

  // on success php may still have emitted warnings or notices, so pass those along
  if (result.stderr.length) process.stderr.write(result.stderr)

  return result.stdout.toString()
}

function run (script) {
  return execPhp([path.join(__dirname, script)])
}

function runCode (code) {
  // php reads the script from stdin when it is given no file argument
  return execPhp([], code)
}

function runWithData (template, model) {
  return runLoader(model, { template })
}

function runCodeWithData (code, model) {
  return runLoader(model, { source: code })
}

// hands one template and one model to loader.php, as a request that wraps the model rather than adding to it
//
// what the loader needs to know used to be written into the model itself, which meant a caller got their own object back with three of this module's keys added to it, and meant a model with a key of its own called `model` took the loader down with it. it now travels beside the model instead
function runLoader (model, what) {
  model = model || {}
  const request = {
    ...what,
    registerGlobalModel: registerGlobalModel(model),
    viewsPath: model?.settings?.views || './',
    model
  }
  return execPhp([path.join(__dirname, '/loader.php')], JSON.stringify(request, circular()))
}

// express hands a view engine a callback rather than expecting a return value, so a render can be answered by a php process that is already running instead of by one started for the occasion
//
// that is worth a great deal: starting php costs several milliseconds and rendering a template costs a fraction of one, so most of what a render used to cost was not the render. the workers also keep php's opcode cache warm, so a template is compiled once rather than once per render
function __express (template, model, callback) {
  if (!pool.settings.enabled) {
    try {
      callback(null, runWithData(template, model))
    } catch (err) {
      callback(err)
    }
    return
  }

  if (!model) model = {}
  pool
    .render(template, model, model?.settings?.views || './', registerGlobalModel(model))
    .then(markup => callback(null, markup))
    .catch(callback)
}

// whether the model's keys should become variables the template can read, which the model may decide for itself and otherwise follows the module wide setting
function registerGlobalModel (model) {
  if (typeof model._REGISTER_GLOBAL_MODEL !== 'undefined') return !!model._REGISTER_GLOBAL_MODEL
  return settings.registerGlobalModel
}

function disableRegisterGlobalModel () {
  settings.registerGlobalModel = false
}

function enableRegisterGlobalModel () {
  settings.registerGlobalModel = true
}

// json cannot describe a value that contains itself, so one that does is replaced rather than followed
//
// what makes a value circular is that it is already on the path from the root down to where it is being written, which is not the same as it having been written somewhere before. a model is perfectly entitled to hold the same object in two places, and both of those should be written out in full: a featured product that also appears in a list of products is one object, not a loop
//
// this used to remember every object it had ever written and replace any repeat, so the second place a shared object appeared received the replacement string instead of the object. keeping only the ancestors also means the check is against the depth of the model rather than its size
function circular () {
  const ancestors = []
  return function (key, val) {
    if (!val || typeof val !== 'object') {
      return val
    }
    // `this` is the object val is being written into, so anything still on the stack below it belongs to a branch that has already been finished and is no longer an ancestor of val
    while (ancestors.length && ancestors[ancestors.length - 1] !== this) {
      ancestors.pop()
    }
    if (ancestors.includes(val)) {
      return '[Circular]'
    }
    ancestors.push(val)
    return val
  }
}

module.exports.run = run
module.exports.runCode = runCode
module.exports.runWithData = runWithData
module.exports.runCodeWithData = runCodeWithData
module.exports.__express = __express
module.exports.disableRegisterGlobalModel = disableRegisterGlobalModel
module.exports.enableRegisterGlobalModel = enableRegisterGlobalModel
module.exports.configureWorkers = pool.configure
module.exports.stopWorkers = pool.shutdown
