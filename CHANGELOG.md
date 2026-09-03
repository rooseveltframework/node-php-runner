## 2.0.0

- Improved performance considerably in several places.
- Added `configureWorkers` to set how many PHP processes to keep, whether PHP rechecks a template on disk before reusing its compiled form, and whether to use worker processes at all. Added `stopWorkers` to stop them. See CONFIGURATION.md.
- Added `trimModel` param, on by default. Model trimming is a performance optimization, but you can turn it off if you see buggy behavior.
- Added a memory limit for the PHP processes, defaulting to 256 MB. PHP's command line runtime has none of its own, so a template that ran away would keep taking memory until the operating system killed something, which need not have been PHP. It is now the render that fails, and the worker is replaced. Added `memoryLimit` to `configureWorkers` to change it or turn it off.
- Fixed some ambiguous errors and improved stability.
- Fixed overly aggressive handling of circular references in model data.
- Updated various dependencies.

## 1.2.0

- Added `runCode` and `runCodeWithData` methods so PHP code can be executed from memory instead of from a file.
- Hardened input handling to prevent command injection.
- Altered thrown error message to include PHP error output instead of being written directly to stderr.
- Altered error thrown when failing to start PHP at all. It now reports the underlying spawn error instead of `PHP process exited with code undefined`.
- Added TypeScript definitions for `run` and `runWithData`, which were previously missing.
- Updated various dependencies.

## 1.1.0

- Added `run` and `runWithData` methods so this module can be used as a general purpose PHP runner.
- Updated various dependencies.

## 1.0.2

- Added TypeScript definitions.
- Various dependencies bumped.

## 1.0.1

- Renamed package from `express-php-view-engine` to `php`. Thanks to Elmer Bulthuis for transferring the package name.
- Various dependencies bumped.

## 1.0.0

- Initial version of superseding project.
  - `express-php-view-engine` notably does not attempt to finish the work of the old `php` module. Instead it allows the native PHP parser to execute as a child process within Express applications.

## 0.0.1

- Initial version of original project.
  - Originally the `php` module on npm was used by a separate project that attempted to implement a PHP parser in JavaScript for Node.js, but was never finished. One work in progress version was published, then the project remained stale for 8 years.
