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

// render the template
include "$model->_TEMPLATE";
