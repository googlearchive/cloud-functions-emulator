# Google Cloud Functions Emulator [![NPM][1]][2] [![Tests][3]][4] [![Coverage][5]][6]

[1]: https://img.shields.io/npm/v/@google-cloud/functions-emulator.svg?style=flat
[2]: https://www.npmjs.org/package/@google-cloud/functions-emulator
[3]: https://img.shields.io/circleci/project/GoogleCloudPlatform/cloud-functions-emulator.svg
[4]: https://circleci.com/gh/GoogleCloudPlatform/cloud-functions-emulator
[5]: https://img.shields.io/codecov/c/github/GoogleCloudPlatform/cloud-functions-emulator/master.svg
[6]: https://codecov.io/github/GoogleCloudPlatform/cloud-functions-emulator

_Disclaimer: This is not an official Google product._

This is a simple emulator that allows you to test your Cloud Functions on your
local machine.

**@google-cloud/functions-emulator is currently in pre-1.0.0 development. Before
the 1.0.0 release backwards compatible changes and bug fixes will bump the patch
version number and breaking changes will bump the minor version number.**

## Table of Contents

* [Installation](#installation)
* [Using the CLI](#using-the-cli)
  * [Deployment](#deployment)
  * [Invoking a Function](#invoking-a-function)
  * [Config](#config)
  * [Logs](#logs)
  * [Debugging](#debugging)
    * [Debugging with Visual Studio Code](#debugging-with-visual-studio-code)
    * [Debugging with Chrome Developer Tools](#debugging-with-chrome-developer-tools)
  * [Using Mocks](#using-mocks)
  * [Known issues and FAQ](#known-issues-and-faq)

## Installation

    npm install -g @google-cloud/functions-emulator

## Using the CLI

Print the available commands:

    functions --help

### Usage

    Commands:
      call <function>      Invokes a function.
      clear                Resets the emulator to its default state and clears and
                           deployed functions.
      delete <function>    Undeploys a previously deployed function (does NOT delete
                           the function source code).
      deploy               Deploys a function with the given module path and entry
                           point.
      describe <function>  Describes the details of a single deployed function.
      logs                 Manages emulator logs access.
      kill                 Force kills the emulator process if it stops responding.
      list                 Lists deployed functions.
      prune                Removes any functions known to the emulator but which no
                           longer exist in their corresponding module.
      restart              Restarts the emulator.
      start                Starts the emulator.
      status               Removes any functions known to the emulator but which no
                           longer exist in their corresponding module.
      stop                 Stops the emulator gracefully.

    Options:
      --help  Show help                                                    [boolean]

### Deployment

The emulator can host both BACKGROUND and HTTP (foreground) Cloud Functions.
By default the emulator will consider functions deployed to be BACKGROUND
functions. To deploy an HTTP function, use the `--trigger-http` argument:

    functions deploy <module path> <function name> --trigger-http

For example:

    functions deploy ~/myModule helloWorld --trigger-http

This would deploy the `helloWorld` function in the Node module contained in the ~/myModule path.  

### Invoking a Function

Start the Emulator:

    functions start

Deploy a BACKGROUND function *(the first argument is the path to your module,
the second argument is the name of the function)*:

    functions deploy ../myModule helloWorld

Invoke the function:

    functions call helloWorld

Stop the Emulator:

    functions stop

For HTTP functions, just use the `--trigger-http` argument.

Deploy an HTTP function:

    functions deploy ../myModule helloHttp --trigger-http

Invoke the function (default port is 8008):

    curl http://localhost:8008/helloHttp

### Config

A local configuration (**config.js**) file is provided that allows you to
configure:

| Property | Type | Description |
|-------|---|----------|
| port | integer | The TCP port on which the emulator will listen (default: 8008) |
| verbose | boolean | `true` if you want to see logs from the emulator itself (default: `false`) |
| projectId | string | Your GCP project ID (default: none) |
| timeout | integer | Timeout (ms) to wait for the emulator to start (default: 3000) |

### Logs

Functions running in the emulator run in their own (detached) process, so
console logs from your function (e.g. `console.log()` calls) will not be piped to
the stdout stream of the emulator. Instead a log file can be found in **app/logs/cloud-functions-emulator.log**

You can view the logs from your functions using the `logs read` command:

    functions logs read

By default this will return the most recent 20 log lines. You can alter this
with the `--limit` flag.

    functions logs read --limit 100

Alternatively, you can simply *tail* the log file itself.

Mac/Linux:

    tail -f logs/cloud-functions-emulator.log

(Note this log will automatically roll when it reaches 1MB.)

### Debugging

To start the emulator in *debug* mode, simply use the `--debug` flag:

    functions start --debug

While running in debug mode a separate debug server will be started on port 5858
(default debugger port for Node). You can then attach to the debugger process
with your favorite IDE.

#### Debugging with Visual Studio Code

If you started the emulator with the `--debug` flag, you can simply "Attach" to the emulator from withing Visual Studio Code.

Refer to the documentation for [debugging in Visual Studio Code](https://code.visualstudio.com/Docs/editor/debugging) for more information.

#### Debugging with Chrome Developer Tools

##### Node version 7+

Node 7.0.0 introduces a new (experimental) `--inspect` flag to allow for integration with Chrome Developer Tools.  
To debug functions in the emulator when running Node 7+, start the emulator with the `--inspect` flag (instead of `--debug`)

    functions start --inspect

This will start the internal Node process with this flag.  To access the debugger in Chrome, you'll need to inspect the 
log file written by the emulator, which by default is located in `logs\cloud-functions-emulator.log`.  Look for a log entry 
that appears like this:

    Debugger listening on port 9229.
    Warning: This is an experimental feature and could change at any time.
    To start debugging, open the following URL in Chrome:
        chrome-devtools://devtools/remote/serve_file/@60cd6e859b9f557d2312f5bf532f6aec5f284980/inspector.html?experiments=true&v8only=true&ws=localhost:9229/165471ce-1e76-421f-b52d-e3b8a14bcb0c

When you open the chrome devtools debugger you may not see your function source file.  Just invoke your function once to have its source file appear in the debugger window

##### Node versions prior to 7

If your IDE doesn't support connecting to a Node.js debugger process, you can
easily debug your Cloud Functions in the emulator using [node-inspector](https://github.com/node-inspector/node-inspector)

First, install node-inspector

    npm install -g node-inspector

Start the emulator in debug mode

    functions start --debug

Now start the node inspector process (we recommend doing this in a separate console window)

    node-inspector

This will start an HTTP server on port 8080, you can then browse to this URL in Chrome

    open http://127.0.0.1:8080/?port=5858

Now when you invoke your function, you can debug!

    functions call helloWorld

![Debugging with Chrome Developer Tools](img/debugging.png "Debugging with Chrome Developer Tools")

### Using Mocks

When running functions locally you sometimes want to change the behavior of modules which connect to external services.
For example you might be accessing a database, API or external system that you don't want to, or can't access from your local 
environment.

The Cloud Functions Emulator provides a way to inject *mock* versions of node modules imported into your function.

1. Enable the use of mocks in `config.js`

    ```
    {
        ...
        enableMocks: true,
        ...
    }
    ```

2. Edit `mocks.js` and mock the dependencies you want

    ```javascript
    // You can create handcrafted mocks, or use a mocking library
    var sinon = require('sinon');

    /**
    * Called when the require() method is called
    * @param {String} func The name of the current function being invoked
    * @param {String} module The name of the module being required
    */
    exports.onRequire = function (func, module) {
        // Return an object or module to override the named module argument
        if(module === 'redis') {
            // Create a mock of redis
            var mockRedis = sinon.mock(require("redis"));
            mockRedis.expects('createClient').returns({});

            // Mock more methods as needed...

            return mockRedis;
        }
        return undefined;
    };
    ```

3. You don't need to change your function code at all!

    ```javascript

    exports.helloRedis = function (event, callback) {
        var redis = require("redis"); // <== this will be a mock
        client = redis.createClient();

        ...
    };
    ```    


### Known Issues and FAQ

 - If you see the following error in the console when you stop the debugger:

    `Assertion failed: ((err) == (0)), function Stop, file ../src/debug-agent.cc, line 155.`

    You can safely ignore it. It's an [open issue](https://github.com/nodejs/node/issues/781) in Node.js

 - If you restart the emulator while the debug server is running you may need to refresh the browser for
   the default debug breakpoint to fire.

 - Disconnecting the debugger can sometimes leave the emulator in a *weird* state.
   If you want to kill the emulator process (because it's stuck), then you'll have
   to kill the underlying `node` process

   `functions kill`

   If that doesn't work, then you may need to go medieval

   Mac/Linux:

    `pgrep -f emulator.js | xargs kill`

- If you see the following error when deploying

    `Error: Module version mismatch`

    This usually means that the module you are trying to deploy has a dependency that either
    conflicts with the same dependency in the emulator, but has a different version, or it
    indicates that the dependencies in the module being deployed was built with a different
    version of npm. In most cases, deleteing `node_modules` from the module being deployed and
    re-running `npm install` will resolve this.

- If you see the following error when trying to invoke a function

    `TypeError: res.send is not a function`

    It means you deployed an HTTP function as a BACKGROUND function (so it's expecting an
    HTTP request but the emulator didn't give it one). Make sure to deploy HTTP functions
    with the `--trigger-http` flag.

- If the emulator times out when starting, check the logs (`logs\cloud-functions-emulator.log`)  

    If you see the following error:

    `Unable to open devtools socket: address already in use`

    It means the chrome devtools debugger is running and using the default debug port.  Close the 
    Chrome tab with the debugger and try again.

## License

Copyright 2016, Google, Inc.

Licensed under the Apache License, Version 2.0

See the [full license](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/blob/master/LICENSE).
