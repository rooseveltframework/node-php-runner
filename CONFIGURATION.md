This module will register values from the data model you pass to the PHP script as global variables in your PHP script by default when you use PHP as an Express view engine or when you call `runWithData`. You can disable this behavior if desired in the following ways:

Disable registering globally:

```js
const php = require('php')
php.disableRegisterGlobalModel()
// can be reenabled by calling php.enableRegisterGlobalModel()
```

Disable registering on a per render basis in Express:

```js
app.get('/', (req, res) => {
  res.render('index.php', {
    _REGISTER_GLOBAL_MODEL: false,
    hello: 'world'
  })
})
```

Disable registering on a per render basis in `runWithData` (though if you're doing this, you probably should just use `php.run()` instead, as that method was written to use simpler logic that doesn't support passing data to PHP):

```js
const output = await php.runWithData('some_php_script.php', {
  _REGISTER_GLOBAL_MODEL: false,
  hello: 'world'
})
```

## Configuring the PHP worker processes

When PHP is used as an Express view engine, renders are sent to PHP processes that are already running. `configureWorkers` changes how those are run, and takes any of three settings:

```js
const php = require('php')

php.configureWorkers({
  size: 4, // how many PHP processes to keep (default: 4, or the number of cores if that is fewer)
  validateTimestamps: false, // whether PHP rechecks a template on disk before reusing its compiled form (default: true)
  enabled: false, // false starts a PHP process per render instead, as this module did before workers existed (default: true)
  trimModel: false, // false sends a template the whole model rather than the parts of it the template reads (default: true)
  memoryLimit: '256M' // how much memory one render may use before PHP stops it (default: '256M', '-1' for no limit)
})
```

Calling it stops any workers already running, so the next render starts them again under the new settings.

## Stopping the PHP worker processes

Workers do not keep Node running: an app that is otherwise finished will exit and take them with it. `stopWorkers` stops them sooner, for a test suite or an app that wants PHP gone before it finishes its own shutdown:

```js
php.stopWorkers()
```

The next render starts them again.
