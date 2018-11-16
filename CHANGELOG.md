##### 1.0.0-beta.5 - 31 July 2018

###### Bug fixes
- [#161](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/161) - The emulator behaves differently than the production version with respect to the rawBody property
- [#261](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/pull/261) - Update Node.js version warning message

###### Other
- Updated dependencies

##### 1.0.0-beta.4 - 06 March 2018

###### Bug fixes
- [#191](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/191) - allow for nested functions from firebase

###### Bug fixes
- Fixed missing promise
- Fixed default `source` value in Controller#deploy
- Fixed outdated discovery doc

##### 1.0.0-beta.2 - 20 February 2018

###### Other
- Updated dependencies

##### 1.0.0-beta.1 - 20 February 2018

###### Breaking changes
- Removed all support for gRPC.

###### Backwards compatible changes
- Added new `--event-type` and `--resource` flags to the `deploy` command.
- Added support for `generateUploadUrl`.

###### Bug fixes
- [#176](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/176) - Wrong error message

###### Other
- Updated dependencies

##### 1.0.0-alpha.29 - 12 December 2017

###### Bug fixes
- [#171](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/171) - changed getter for supervisorHost to allow for bindHost option

##### 1.0.0-alpha.28 - 05 December 2017

###### Bug fixes
- [#162](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/162) - Emulator doesn't support functions with underscore in function name
- [#165](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/165) - Update supported Node.js version to 6.11.5
- Fixed the `host` config option not being preserved.

###### Other
- Updated dependencies

##### 1.0.0-alpha.27 - 13 November 2017

###### Bug fixes
- [#159](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/159) - Emulator rejects function names with underscores

###### Other
- Updated dependencies

##### 1.0.0-alpha.26 - 06 November 2017

###### Bug fixes
- [#152](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/pull/152) - Fixed body parser limits

###### Other
- Updated dependencies
- Integrated `@google-cloud/nodejs-repo-tools`

##### 1.0.0-alpha.25 - 23 August 2017

###### Bug fixes
- Removed extraneous logging on file change

##### 1.0.0-alpha.24 - 22 August 2017

###### Backwards compatible changes
- [#63](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/pull/63) - Add option to disable file watcher
  - Added `--watch` and `--watchIgnore` options.
- [#66](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/pull/66) - Make worker idle timeout configurable
  - Added `--maxIdle` and `--idlePruneInterval` options.

###### Bug fixes
- [#115](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/pull/115) - Emulator crashes unpredictably
  - This is a partial fix. The full fix requires adding worker pools to each
    deployed function and enforcing one concurrent request per worker.
    Currently, only one worker is deployed per function, which handles all
    requests.

###### Other
- Upgraded dependencies

##### 1.0.0-alpha.23 - 08 August 2017

###### Bug fixes
- [#121](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/pull/121) - Support Firebase event types in REST client laurenzlong@
- [#130](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/pull/130) - Replace deprecated addProtoService with addService laurenzlong@

###### Other
- Upgraded dependencies

##### 1.0.0-alpha.22 - 17 July 2017

###### Bug fixes
- [#124](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/pull/124) - Update supported Node.js version to 6.11.1 by max@

###### Other
- Upgraded dependencies

##### 1.0.0-alpha.21 - 16 June 2017

###### Bug fixes
- [#59](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/59) - New logs not written
- [#110](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/110) - Not working with latest stable version of node

###### Other
- Upgraded dependencies

##### 1.0.0-alpha.20 - 07 June 2017

###### Bug fixes
- [#105](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/105) - Warning probably not needed for semver minor changes
- [#108](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/108) - Call command does not appear in help text

###### Other
- Upgraded dependencies

##### 1.0.0-alpha.19 - 11 May 2017

###### Bug fixes
- [#103](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/103) - Prevent emulator from hanging from requiring user code that doesn't exit., by @laurenlong

###### Other
- Upgraded dependencies

##### 1.0.0-alpha.18 - 08 May 2017

###### Backwards compatible changes
- Hid some annoying warning messages
- Add ability to set more options on the Emulator child process

##### 1.0.0-alpha.17 - 04 May 2017

###### Breaking changes
- [#92](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/92) - Switch to `host` and `bindHost` options, by @kpruden
  - Fixes [#91](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/91) (Support connecting to an emulator behind a NAT)

###### Backwards compatible changes
- [#89](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/89) - Refactor how the logs work, by @laurenlong
  - Added a `--tail` option to `functions start`. If `true`, `functions start`
    will not exit right away. Instead the Emulator's logs will be streamed to
    the terminal. Pressing Ctrl+C would stop the Emulator.

###### Bug fixes
- [#90](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/90) - JSON payload not being parsed correctly on Windows Shell
- [#97](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/97) - Improve --stage-bucket support

###### Other
- Upgraded dependencies

##### 1.0.0-alpha.16 - 13 April 2017

###### Backwards compatible changes
- [#73](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/73) - Warn user when local version of Node is greater than 6.9.
- When calling `Controller#start` programmatically, you can now pass an options object to configure the child process, and you'll receive the handle to the child process when the promise resolves.
- Add a `getOperation` method to the clients
- Added more debug logging
- [#84](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/84) - Support for testing a database trigger

###### Bug fixes
- Function timeouts now work
- Fixed gRPC client request deadlines
- Hopefully fixed the following (they're hard to reproduce):
  - [#76](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/76) - Progress bar for deploying functions?
  - [#77](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/77) - Emulator fails to start
  - [#80](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/80) - NotFoundError

##### 1.0.0-alpha.15 - 10 March 2017

###### Bug fixes
- [#71](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/71) - "status" option produces bad 'HTTP Trigger' path

##### 1.0.0-alpha.14 - 08 March 2017

###### Bug fixes
- Fixes undefined method error when trying to invoke functions that don't exist.

##### 1.0.0-alpha.13 - 08 March 2017

###### Breaking changes
- [#69](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/69) - Move --debug and --inspect into their own commands. Debugging has changed, please see [Debugging-functions](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki/Debugging-functions) for details.

##### 1.0.0-alpha.12 - 06 March 2017

###### Bug fixes
- [#64](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/64) - Can start Emulator with mismatching versions

##### 1.0.0-alpha.11 - 06 March 2017

###### Breaking changes
- Some options have been removed from commands where they weren't needed

###### Other
- Cleaned up of the CLI help text

##### 1.0.0-alpha.10 - 05 March 2017

###### Backwards compatible changes
- Export all Emulator classes

##### 1.0.0-alpha.9 - 05 March 2017

###### Breaking changes
- [#62](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/62) - Add support for live-reloading of functions. Function workings will now automatically shutdown when they detect changes to the function's code. A new worker will be started the next time the function is called.

##### 1.0.0-alpha.8 - 05 March 2017

###### Bug fixes
- [#48](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/48) - Deploying an already deployed function should update the existing function, not fail

##### 1.0.0-alpha.7 - 05 March 2017

###### Breaking changes
- [#35](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/35), [#44](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/44) - Re-architect to process per function, allowing simulation of "warm" functions
- [#43](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/43) - Improve upgrade awareness of the Emulator. CLI and Emulator version can no longer mismatch.
- [#31](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/31), [#54](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/54) - Cleanup temporary archives

###### Backwards compatible changes
- [#52](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/52) - Display on default console window in Mac is difficult to read

###### Bug fixes
- [#46](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/46) (again) - Inconsistent behaviour for parsing path and path params
- [#53](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/53) - HTTP Function hangs when debugging
- [#56](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/56) - Deployments are slow
- [#60](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/60) - `GCP_PROJECT` environment variable not set

##### 1.0.0-alpha.6 - 28 February 2017

###### Bug fixes

- [#47](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/47) - Sometimes function is killed before it reports result

##### 1.0.0-alpha.5 - 28 February 2017

###### Bug fixes

- [#46](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/46) - Request path not forwarded to function

##### 1.0.0-alpha.4 - 25 February 2017

###### Bug fixes

- [#45](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/45) - Cannot Pass query string to cloud functions

##### 1.0.0-alpha.3 - 14 February 2017

###### Bug fixes

- [#38](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/38) - Cannot find module 'upgrade-warning'

##### 1.0.0-alpha.2 - 13 February 2017

###### Bug fixes

- [#32](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/32) - custom headers request headers are lost
- [#34](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/34) - functions deploy fails on Windows

##### 1.0.0-alpha.1 - 01 February 2017

###### Breaking changes

- This release includes a complete rewrite of the entire Emulator.
- Documentation for the new release can be found at https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki
- If you have trouble upgrading, delete the following folder:
  - OSX/Linux - `/Users/YOUR_USERNAME/.config/configstore/@google-cloud/functions-emulator`
  - Windows - `C:\Users\YOUR_USERNAME\.config\configstore\@google-cloud\functions-emulator`

##### 0.4.0 - 05 December 2016

###### Breaking changes

- The emulator now **requires** Node.js v6.9.1 so as to match the production Google Cloud Functions environment.
- `functions call` - Switched position of `modulePath` and `functionName` arguments for consistency with other commands.
- Moved the config file from `config.js` to a `config.json` file in the user's home directory.

###### Backwards compatible changes
- Added `functions config list` and `functions config set` commands.

###### Other
- Refactored the tests to exercise the CLI itself.
- Lots of architectural changes in the code for better maintainability, testability, and extensibility.

##### 0.3.2 - 25 November 2016

###### Backwards compatible changes
- [#8](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/8), [#9](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues/9) - Added `--file` option to `call` command.

##### 0.3.1 - 23 November 2016

###### Backwards compatible changes
- Adds checks to deploy command to ensure module path is a directory
- Adds more clarity to README for deploy command

##### 0.1.0 - 24 October 2016

- Initial Release
