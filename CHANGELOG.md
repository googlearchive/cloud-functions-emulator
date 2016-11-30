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
