To use this module, you must have PHP installed and in your PATH.

## Run a PHP script in Node.js

```javascript
const php = require('php')
const output = php.run('some_php_script.php')
```

## Run a PHP script in Node.js and pass it data

```javascript
const php = require('php')
const output = php.runWithData('some_php_script.php', { hello: 'world' })
```

Then, assuming your `some_php_script.php` file looks like this:

```php
<p><?=$hello?></p>
```

The output will be:

```html
<p>world</p>
```

## Run PHP code from memory in Node.js

If you have PHP code in a string rather than in a file, you can execute it without writing it to disk first:

```javascript
const php = require('php')
const output = php.runCode('<?php echo "<p>world</p>"; ?>')
```

Like a PHP file, the code can mix HTML and PHP:

```javascript
const output = php.runCode('<?php $hello = "world"; ?><p><?=$hello?></p>')
```

## Run PHP code from memory in Node.js and pass it data

```javascript
const php = require('php')
const output = php.runCodeWithData('<p><?=$hello?></p>', { hello: 'world' })
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
