##### 1.0.0-alpha.5 - 28 February 2017

###### Bug fixes

- #46 - Request path not forwarded to function

##### 1.0.0-alpha.4 - 25 February 2017

###### Bug fixes

- #45 - Cannot Pass query string to cloud functions

##### 1.0.0-alpha.3 - 14 February 2017

###### Bug fixes

- #38 - Cannot find module 'upgrade-warning'

##### 1.0.0-alpha.2 - 13 February 2017

###### Bug fixes

- #32 - custom headers request headers are lost
- #34 - functions deploy fails on Windows

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
- #8, #9 - Added `--file` option to `call` command.

##### 0.3.1 - 23 November 2016

###### Backwards compatible changes
- Adds checks to deploy command to ensure module path is a directory
- Adds more clarity to README for deploy command

##### 0.1.0 - 24 October 2016

- Initial Release
