const path = require('path')
const { execSync } = require('child_process')
const settings = {}
settings.disableRegisterGlobalModel = false

function run (script) {
  try {
    const stdout = execSync(`php ${path.join(__dirname, script)}`)
    return stdout.toString()
  } catch (err) {
    throw new Error(`PHP process exited with code ${err.status}`)
  }
}

function runWithData (template, model) {
  if (!model) model = {}
  model._TEMPLATE = template
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

  try {
    const stdout = execSync(`php ${path.join(__dirname, '/loader.php')}`, {
      input: jsonModel
    })
    return stdout.toString()
  } catch (err) {
    throw new Error(`PHP process exited with code ${err.status}`)
  }
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
module.exports.runWithData = runWithData
module.exports.__express = __express
module.exports.disableRegisterGlobalModel = disableRegisterGlobalModel
module.exports.enableRegisterGlobalModel = enableRegisterGlobalModel
