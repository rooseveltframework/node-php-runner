const execa = require('execa')
const circular = require('circular')
const path = require('path')
const settings = {}
settings.disableRegisterGlobalModel = false

async function render (template, model, callback) {
  model._TEMPLATE = template
  if (typeof model._REGISTER_GLOBAL_MODEL === 'undefined') { // if not overridden by the model
    // then source the setting from the global settings
    if (settings.disableRegisterGlobalModel) {
      model._REGISTER_GLOBAL_MODEL = false
    } else {
      model._REGISTER_GLOBAL_MODEL = true
    }
  }
  model._REGISTER_GLOBAL_MODEL = !!model._REGISTER_GLOBAL_MODEL // force a boolean
  model._VIEWS_PATH = model.settings.views // pass views path to php
  const jsonModel = JSON.stringify(model, circular()) // stringify with circular references stripped
  const { stdout } = await execa('php', [path.join(__dirname, '/loader.php')], { input: jsonModel }) // e.g. php loader.php <<< '["array entry", "another", "etc"]'
  const renderedTemplate = stdout
  callback(null, renderedTemplate)
}

function disableRegisterGlobalModel () {
  settings.disableRegisterGlobalModel = true
}

function enableRegisterGlobalModel () {
  settings.disableRegisterGlobalModel = false
}

module.exports.__express = render
module.exports.disableRegisterGlobalModel = disableRegisterGlobalModel
module.exports.enableRegisterGlobalModel = enableRegisterGlobalModel
