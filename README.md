
# Google Cloud Functions
## Local Execution Simulator (Unofficial)

This is a simple simulator that allows you to test your Cloud Functions on your local machine

### Setup

    npm install -g

### Help

    functions -h

### Usage

    functions [options] [command]

    Commands:

        start [options]                       Starts the simulator
        stop                                  Stops the simulator gracefully
        kill                                  Force kills the simulator process if it stops responding
        restart                               Restarts the simulator
        clear                                 Resets the simulator to its default state and clears any deploy functions
        prune                                 Removes any functions known to the simulator but which no longer exist in their corresponding module
        status                                Returns the status of the simulator
        deploy [options] <module> <function>  Deploys a function with the given module path and entry point
        delete <function>                     Undeploys a previously deployed function (does NOT delete the function source code)
        list                                  Lists deployed functions
        get-logs [options]                    Displays the logs for the simulator
        describe <function>                   Describes the details of a single deployed function
        call [options] <function>             Invokes a function

    Options:

        -h, --help     output usage information
        -V, --version  output the version number

### Deployment

The simulator can host both BACKGROUND and HTTP (foreground) Cloud Functions.  
By default the simulator will consider functions deployed to be BACKGROUND functions. 
To deploy an HTTP function, use the `--trigger-http` argument

    functions deploy <module> <function> --trigger-http

### Invoking a Function

Start the Simulator

    functions start    

Deploy a BACKGROUND function  
*(the first argument is the path to your module, the second argument is the name of the function)*

    functions deploy ../myModule helloWorld

Invoke the function

    functions call helloWorld

Stop the Simulator

    functions stop     

For HTTP functions, just use the `--trigger-http` argument

Deploy an HTTP function

    functions deploy ../myModule helloHttp --trigger-http  

Invoke the function (default port is 8008)

    curl http://localhost:8008/helloHttp    

### Config

A local configuration (**config.js**) file is provided that allows you to configure:

| Property | Type | Description |
|-------|---|----------|
| port | integer | The TCP port on which the simulator will listen (default: 8008) | 
| verbose | boolean | `true` if you want to see logs from the simulator itself (default: `false`) |
| projectId | string | Your GCP project ID (default: none) |
| timeout | integer | Timeout (ms) to wait for the simulator to start (default: 3000) |

### Logs

Functions running in the simulator run in their own (detached) process, so 
console logs from your function (e.g. `console.log()` calls) will not be piped to 
the stdout stream of the simulator.  Instead a log file can be found in **app/logs/simulator.log**

You can view the logs from your functions using the `get-logs` command

    functions get-logs

By default this will return the most recent 20 log lines.  You can alter this with the `--limit` flag

    functions get-logs --limit 100

Alternatively, you can simply *tail* the log file itself

Mac/Linux:

    tail -f app/logs/simulator.log

(Note this log will automatically roll when it reaches 1MB)

### Debugging

To start the simulator in *debug* mode, simply use the `--debug` flag

    functions start --debug

While running in debug mode a separate debug server will be started on port 5858 
(default debugger port for Node).  You can then attach to the debugger process 
with your favorite IDE

#### Debugging with Chrome Developer Tools

If your IDE doesn't support connecting to a Node.js debugger process, you can 
easily debug your Cloud Functions in the simulator using [node-inspector](https://github.com/node-inspector/node-inspector)

First, install node-inspector

    npm install -g node-inspector

Start the simulator in debug mode

    functions start --debug

Now start the node inspector process (we recommend doing this in a separate console window)

    node-inspector

This will start an HTTP server on port 8080, you can then browse to this URL in Chrome

    open http://127.0.0.1:8080/?port=5858

Now when you invoke your function, you can debug!

    functions call helloWorld

![Debugging with Chrome Developer Tools](img/debugging.png "Debugging with Chrome Developer Tools")    

### Known Issues and FAQ

 - If you see the following error in the console when you stop the debugger:

    `Assertion failed: ((err) == (0)), function Stop, file ../src/debug-agent.cc, line 155.`

    You can safely ignore it.  It's an [open issue](https://github.com/nodejs/node/issues/781) in Node.js

 - If you restart the simulator while the debug server is running you may need to refresh the browser for
   the default debug breakpoint to fire.

 - Disconnecting the debugger can sometimes leave the simulator in a *weird* state. 
   If you want to kill the simulator process (because it's stuck), then you'll have 
   to kill the underlying `node` process

   `functions kill`

   If that doesn't work, then you may need to go medieval

   Mac/Linux:

    `pgrep -f simulator.js | xargs kill`


- If you see the following error when deploying

    `Error: Module version mismatch`

    This usually means that the module you are trying to deploy has a dependency that either 
    conflicts with the same dependency in the simulator, but has a different version, or it
    indicates that the dependencies in the module being deployed was built with a different 
    version of npm.  In most cases, deleteing `node_modules` from the module being deployed and
    re-running `npm install` will resolve this.

- If you see the following error when trying to invoke a function

    `TypeError: res.send is not a function`

    It means you deployed an HTTP function as a BACKGROUND function (so it's expecting an 
    HTTP request but the simulator didn't give it one).  Make sure to deploy HTTP functions
    with the `--trigger-http` flag.