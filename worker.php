<?php
// a php process that stays alive and renders one template per request
//
// starting php costs several milliseconds, which is far more than rendering a typical template costs, so a process that renders one template and exits spends most of its life starting up. this one is spawned once and then reads requests for as long as node keeps it open, which also lets the opcode cache do its job: a template is compiled the first time it is rendered rather than every time
//
// requests and responses are length prefixed. a response body is written as raw bytes rather than as json, because a template is entitled to emit anything at all and json cannot carry bytes that are not valid utf-8

// what a template is not allowed to disturb, so a template that assigns to a name this loop happens to use cannot derail it
$phpRunnerState = [
  'in' => fopen('php://stdin', 'rb'),
  'out' => fopen('php://stdout', 'wb')
];

// functions that read the variables of whatever called them, by name. a template naming one of these as a string can reach a part of the model without ever writing a variable for it
const PHP_RUNNER_READS_SCOPE = ['compact', 'get_defined_vars'];

// the above, plus the ones that write names into the caller's scope. those cannot smuggle a read past this on their own, since the template still has to name what they created, but a template using one is doing something this would rather not reason about
const PHP_RUNNER_TOUCHES_SCOPE = ['compact', 'get_defined_vars', 'extract', 'parse_str'];

// which names a template can read, or null when it can reach a name this cannot see coming
//
// php's own tokenizer is used rather than a search through the text, so a $variable written inside a string or a comment is not mistaken for one the template reads
//
// anything that can produce a name at render time means the answer cannot be trusted, and the caller is told so rather than given a list that might be missing something
function phpRunnerAnalyze ($file, array &$files) {
  $real = realpath($file);

  // a file already looked at contributes nothing this does not know about
  if ($real && isset($files[$real])) return [];

  // a file that cannot be found or read is one this can say nothing about, and saying it reads nothing would mean a template being sent less of the model than it needs. php caches what it resolved a path to, so a path can still resolve after the file behind it has gone
  $contents = $real === false ? false : @file_get_contents($real);
  if ($contents === false) return null;

  $files[$real] = true;

  $tokens = token_get_all($contents);
  $count = count($tokens);
  $names = [];

  for ($i = 0; $i < $count; $i++) {
    $token = $tokens[$i];

    // a bare $ is a variable whose name is worked out at render time: $$name
    if ($token === '$') return null;
    if (!is_array($token)) continue;

    // ${expression} is the same thing written differently. "{$foo}" is not: the name is right there
    if ($token[0] === T_DOLLAR_OPEN_CURLY_BRACES) return null;

    if ($token[0] === T_VARIABLE) {
      $name = substr($token[1], 1);
      // the whole model is readable under this name, and so is everything through the globals array
      if ($name === 'model' || $name === 'GLOBALS') return null;
      if ($name !== 'this') $names[$name] = true;
      continue;
    }

    if ($token[0] === T_EVAL) return null;

    // a function that reads the caller's variables by name, written as a string rather than as a variable. php will not let one of these be called through a variable, but it will let one be called through a name written out in full, as call_user_func('compact', ...) does
    //
    // only a name being passed to something counts. php refuses a name that arrived by any other route, so "compact" sitting in an array or assigned to a variable can reach nothing
    if ($token[0] === T_CONSTANT_ENCAPSED_STRING && in_array(strtolower(trim($token[1], "'\"")), PHP_RUNNER_READS_SCOPE, true)) {
      $before = $i - 1;
      while ($before >= 0 && is_array($tokens[$before]) && in_array($tokens[$before][0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) $before--;
      if (isset($tokens[$before]) && ($tokens[$before] === '(' || $tokens[$before] === ',')) return null;
      continue;
    }

    // a call that can bring names into scope, or read them, from somewhere this cannot follow
    //
    // the name may be written plainly, or fully qualified as \compact(). only a call counts: $flags->compact reads a property that happens to share a name with a function
    if (in_array($token[0], [T_STRING, T_NAME_FULLY_QUALIFIED, T_NAME_QUALIFIED], true)) {
      $called = strtolower(substr(strrchr('\\' . $token[1], '\\'), 1));
      if (in_array($called, PHP_RUNNER_TOUCHES_SCOPE, true)) {
        $before = $i - 1;
        while ($before >= 0 && is_array($tokens[$before]) && $tokens[$before][0] === T_WHITESPACE) $before--;
        $isMember = $before >= 0 && is_array($tokens[$before]) && in_array($tokens[$before][0], [T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR, T_DOUBLE_COLON, T_FUNCTION], true);
        // a comment may sit between the name and its bracket, and does not stop it being a call
        $after = $i + 1;
        while ($after < $count && is_array($tokens[$after]) && in_array($tokens[$after][0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) $after++;
        if (!$isMember && isset($tokens[$after]) && $tokens[$after] === '(') return null;
      }
      continue;
    }

    // a partial is part of the template, so whatever it reads counts too. one named by anything other than a plain string cannot be followed
    if (in_array($token[0], [T_INCLUDE, T_INCLUDE_ONCE, T_REQUIRE, T_REQUIRE_ONCE], true)) {
      $next = $i + 1;
      while ($next < $count && is_array($tokens[$next]) && in_array($tokens[$next][0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) $next++;
      // include and require are not functions, but they are commonly written as though they were
      if (isset($tokens[$next]) && $tokens[$next] === '(') {
        $next++;
        while ($next < $count && is_array($tokens[$next]) && in_array($tokens[$next][0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) $next++;
      }
      if (!isset($tokens[$next]) || !is_array($tokens[$next]) || $tokens[$next][0] !== T_CONSTANT_ENCAPSED_STRING) return null;
      $path = trim($tokens[$next][1], "'\"");
      $nested = phpRunnerAnalyze(dirname($real) . '/' . $path, $files);
      if ($nested === null) return null;
      foreach ($nested as $name) $names[$name] = true;
    }
  }

  return array_keys($names);
}



// renders one template and returns its markup
//
// this happens inside a function so that the variables a template defines are gone when it returns, rather than accumulating in the global scope where the next render would see them
//
// the model is made available three ways, to match what the one shot loader gives a template: as $model, as local variables, and as globals, the last so that a template declaring `global $foo` still finds it
function phpRunnerRender ($phpRunnerRequest) {
  $model = $phpRunnerRequest->model;
  $phpRunnerGlobals = [];

  if (!empty($phpRunnerRequest->registerGlobalModel)) {
    foreach ($model as $phpRunnerKey => $phpRunnerValue) {
      $GLOBALS[$phpRunnerKey] = $phpRunnerValue;
      $phpRunnerGlobals[] = $phpRunnerKey;
    }
    extract((array) $model, EXTR_SKIP);
  }

  $phpRunnerLevel = ob_get_level();
  try {
    ob_start();
    include $phpRunnerRequest->template;
    return ['ok', ob_get_clean()];
  } catch (Throwable $phpRunnerError) {
    // a template that failed part way through has left output behind that no one wants
    while (ob_get_level() > $phpRunnerLevel) {
      ob_end_clean();
    }
    return ['err', get_class($phpRunnerError) . ': ' . $phpRunnerError->getMessage() . ' in ' . $phpRunnerError->getFile() . ' on line ' . $phpRunnerError->getLine()];
  } finally {
    // the model is only in scope for the render that asked for it
    foreach ($phpRunnerGlobals as $phpRunnerKey) {
      unset($GLOBALS[$phpRunnerKey]);
    }
  }
}

while (true) {
  $phpRunnerHeader = fgets($phpRunnerState['in']);
  if ($phpRunnerHeader === false) {
    break; // node closed the pipe, so there is nothing left to render
  }
  $phpRunnerHeader = trim($phpRunnerHeader);
  if ($phpRunnerHeader === '') {
    continue;
  }

  $phpRunnerLength = (int) $phpRunnerHeader;
  $phpRunnerPayload = '';
  while (strlen($phpRunnerPayload) < $phpRunnerLength) {
    $phpRunnerChunk = fread($phpRunnerState['in'], $phpRunnerLength - strlen($phpRunnerPayload));
    if ($phpRunnerChunk === false || $phpRunnerChunk === '') {
      break 2; // the pipe closed mid request, so this render can never be completed
    }
    $phpRunnerPayload .= $phpRunnerChunk;
  }

  $phpRunnerRequest = json_decode($phpRunnerPayload);
  $phpRunnerMeta = [];

  if ($phpRunnerRequest === null) {
    $phpRunnerResult = ['err', 'the model could not be decoded as JSON'];
  } else {
    set_include_path($phpRunnerRequest->viewsPath);

    // node asks what this template reads the first time it sends it, and remembers the answer along with the files it came from, so that it can notice an edit and ask again
    if (!empty($phpRunnerRequest->analyze)) {
      $phpRunnerFiles = [];
      $phpRunnerMeta['reads'] = phpRunnerAnalyze($phpRunnerRequest->template, $phpRunnerFiles);
      $phpRunnerMeta['files'] = array_keys($phpRunnerFiles);
    }

    $phpRunnerResult = phpRunnerRender($phpRunnerRequest);
  }

  $phpRunnerBody = $phpRunnerResult[1];
  $phpRunnerMetaJson = json_encode($phpRunnerMeta);
  fwrite($phpRunnerState['out'], $phpRunnerResult[0] . ' ' . strlen($phpRunnerBody) . ' ' . strlen($phpRunnerMetaJson) . "\n" . $phpRunnerBody . $phpRunnerMetaJson);
  fflush($phpRunnerState['out']);
}
