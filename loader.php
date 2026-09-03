<?php
// runs one template and exits, for the synchronous methods
//
// the request arrives as JSON on stdin and carries the template to run, the model to run it against, and where to look for anything the template includes. worker.php answers a request of the same shape, and differs in staying alive to answer more of them and in rendering each one in a scope of its own; this runs a single template at the top level of the script and stops

// everything this needs to know is read before the model is unpacked, because unpacking it defines whatever names the model happens to carry. a model with a key called `model` used to overwrite the variable this was reading its own settings out of, and took the render down with it
$phpRunnerRequest = json_decode(stream_get_contents(STDIN));
$phpRunnerSource = $phpRunnerRequest->source ?? null;
$phpRunnerTemplate = $phpRunnerRequest->template ?? null;
$phpRunnerRegister = !empty($phpRunnerRequest->registerGlobalModel);

set_include_path($phpRunnerRequest->viewsPath);

// the whole model under one name, and then a name per key if the request asked for that. this happens at the top level of the script, so those are globals, and so is anything the template goes on to define
$model = $phpRunnerRequest->model;

if ($phpRunnerRegister) {
  foreach ($phpRunnerRequest->model as $phpRunnerKey => $phpRunnerValue) {
    $$phpRunnerKey = $phpRunnerValue;
  }
}

if ($phpRunnerSource !== null) {
  // the closing tag prefix drops into inline html mode so the source parses like a template file would the newline after it is padding: php swallows one newline following a closing tag, so this absorbs the swallow and leaves leading whitespace in the source intact
  eval('?>' . "\n" . $phpRunnerSource);
} else {
  include $phpRunnerTemplate;
}
