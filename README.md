# express-php-view-engine

[![Build Status](https://github.com/rooseveltframework/express-php-view-engine/workflows/CI/badge.svg
)](https://github.com/rooseveltframework/express-php-view-engine/actions?query=workflow%3ACI) [![codecov](https://codecov.io/gh/rooseveltframework/express-php-view-engine/branch/master/graph/badge.svg)](https://codecov.io/gh/rooseveltframework/express-php-view-engine) [![npm](https://img.shields.io/npm/v/php.svg)](https://www.npmjs.com/package/php)

This module allows you to use [PHP](https://php.net) as a templating system for [Express framework](https://expressjs.com) applications. This module was built and is maintained by the [Roosevelt web framework](https://github.com/rooseveltframework/roosevelt) [team](https://github.com/orgs/rooseveltframework/people), but it can be used independently of Roosevelt as well.

## Usage

First declare `php` as a dependency in your app.

Then set PHP as a view engine in your Express app:

```js
const express = require('express')
const app = express()
const php = require('php')

// setup php templating engine
app.set('views', path.join(__dirname, 'templates'))
app.set('view engine', 'php')
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

The ouptut will be:

```html
<p>world</p>
```

Note: This module presumes that the system you run this on has PHP installed and that it's in your PATH.

## Configuration

As shown in the above example, this module will register values from the Express model as global variables in your PHP script by default. You can disable this behavior if desired two ways:

Disable registering globally:

```js
const php = require('php')
php.disableRegisterGlobalModel()
// can be reenabled by calling php.enableRegisterGlobalModel()
```

Disable registering on a per route basis:

```js
app.get('/', (req, res) => {
  res.render('index.php', {
    _REGISTER_GLOBAL_MODEL: false,
    hello: 'world'
  })
})
```
