const path = require('path')
const { spawnSync } = require('child_process')
const settings = {}
settings.disableRegisterGlobalModel = false

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
  if (!model) model = {}
  model._TEMPLATE = template
  return runLoader(model)
}

function runCodeWithData (code, model) {
  if (!model) model = {}
  model._TEMPLATE_SOURCE = code
  return runLoader(model)
}

function runLoader (model) {
  if (typeof model._REGISTER_GLOBAL_MODEL === 'undefined') {
    if (settings.disableRegisterGlobalModel) {
      model._REGISTER_GLOBAL_MODEL = false
    } else {
      model._REGISTER_GLOBAL_MODEL = true
    }
  }
  model._REGISTER_GLOBAL_MODEL = !!model._REGISTER_GLOBAL_MODEL
  model._VIEWS_PATH = model?.settings?.views || './'
  const jsonModel = JSON.stringify(model, circular())

  return execPhp([path.join(__dirname, '/loader.php')], jsonModel)
}

function __express (template, model, callback) {
  try {
    const stdout = runWithData(template, model)
    callback(null, stdout)
  } catch (err) {
    callback(err)
  }
}

function disableRegisterGlobalModel () {
  settings.disableRegisterGlobalModel = true
}

function enableRegisterGlobalModel () {
  settings.disableRegisterGlobalModel = false
}

function circular (ref, methods) {
  ref = ref || '[Circular]'
  const seen = []
  return function (key, val) {
    if (typeof val === 'function' && methods) {
      val = val.toString()
    }
    if (!val || typeof (val) !== 'object') {
      return val
    }
    if (~seen.indexOf(val)) {
      if (typeof ref === 'function') return ref(val)
      return ref
    }
    seen.push(val)
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
