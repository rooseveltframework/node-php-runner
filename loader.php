<?php
// get model data from STDIN and decode the JSON into a proper PHP object
$model = json_decode(stream_get_contents(STDIN));

// declare global variables for each model variable (if the setting to do so is enabled)
if ($model->_REGISTER_GLOBAL_MODEL) {
  foreach ($model as $key => $value) {
    $$key = $value;
  }
}

// add express templates path to php includes path
set_include_path($model->_VIEWS_PATH);

// render the template, either from source held in memory or from a file
if (isset($model->_TEMPLATE_SOURCE)) {
  // the closing tag prefix drops into inline html mode so the source parses like a template file would
  // the newline after it is padding: php swallows one newline following a closing tag, so this absorbs the swallow and leaves leading whitespace in the source intact
  eval('?>' . "\n" . $model->_TEMPLATE_SOURCE);
} else {
  include "$model->_TEMPLATE";
}
