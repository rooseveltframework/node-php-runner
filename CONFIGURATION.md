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
