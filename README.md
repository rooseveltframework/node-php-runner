# node-php-runner

[![Build Status](https://github.com/rooseveltframework/express-php-view-engine/workflows/CI/badge.svg
)](https://github.com/rooseveltframework/express-php-view-engine/actions?query=workflow%3ACI) [![codecov](https://codecov.io/gh/rooseveltframework/express-php-view-engine/branch/master/graph/badge.svg)](https://codecov.io/gh/rooseveltframework/express-php-view-engine) [![npm](https://img.shields.io/npm/v/php.svg)](https://www.npmjs.com/package/php)

This module allows you to run [PHP](https://php.net) code in Node.js in various ways:

- Run PHP scripts.
- Run PHP scripts and pass them JSON data from Node.js.
- Use PHP as a view engine (templating system) for [Express framework](https://expressjs.com) applications.

To use this module, you must have PHP installed and in your PATH.

This module was built and is maintained by the [Roosevelt web framework](https://github.com/rooseveltframework/roosevelt) [team](https://github.com/orgs/rooseveltframework/people), but it can be used independently of Roosevelt as well.

## Run a PHP script in Node.js

```javascript
const php = require('php')
const output = await php.run('some_php_script.php')
```

## Run a PHP script in Node.js and pass it data

```javascript
const php = require('php')
const output = await php.runWithData('some_php_script.php', { hello: 'world' })
```

Then, assuming your `some_php_script.php` file looks like this:

```php
<p><?=$hello?></p>
```

The output will be:

```html
<p>world</p>
```

## Use with Express

```js
const express = require('express')
const app = express()
const php = require('php')

// setup PHP templating engine
app.set('views', path.join(__dirname, 'templates'))
app.set('view engine', 'php') // set PHP as a view engine in your Express app
app.engine('php', php.__express)

// define a route
app.get('/', (req, res) => {
  res.render('index.php', {
    hello: 'world'
  })
})
```

Then, assuming your `templates/index.php` looks like this:

```php
<p><?=$hello?></p>
```

The output will be:

```html
<p>world</p>
```

## Configuration

As shown in the above examples, this module will register values from the data model you pass to the PHP script as global variables in your PHP script by default when you use PHP as an Express view engine or when you call `runWithData`. You can disable this behavior if desired in the following ways:

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

