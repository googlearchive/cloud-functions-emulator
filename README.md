<img src="https://avatars2.githubusercontent.com/u/2810941?v=3&s=96" alt="Google Inc. logo" title="Google" align="right" height="96" width="96"/>

# Google Cloud Functions Emulator

[![NPM][1]][2] [![Tests][3]][4] [![Coverage][5]][6]

[1]: https://img.shields.io/npm/v/@google-cloud/functions-emulator.svg?style=flat
[2]: https://www.npmjs.org/package/@google-cloud/functions-emulator
[3]: https://img.shields.io/circleci/project/GoogleCloudPlatform/cloud-functions-emulator.svg
[4]: https://circleci.com/gh/GoogleCloudPlatform/cloud-functions-emulator
[5]: https://img.shields.io/codecov/c/github/GoogleCloudPlatform/cloud-functions-emulator/master.svg
[6]: https://codecov.io/github/GoogleCloudPlatform/cloud-functions-emulator

_Disclaimer: This is not an official Google product._

**Table of Contents**

* [What is the Google Cloud Functions Emulator?](#what-is-the-google-cloud-functions-emulator)
* [How do I get started?](#how-do-i-get-started)
* [Where is the documentation?](#where-is-the-documentation)
  * CLI Docs: `functions --help`
  * [How-To Guides](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki/How-To-Guides)
* [Contributing](#contributing)
* [License](#license)

## What is the Google Cloud Functions Emulator?

The **Google Cloud Functions Emulator** is a Node.js application that implements the Google Cloud Functions API, and includes a CLI with which you can manage the application.

The Emulator allows you to [**deploy**](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki/Deploying-functions), [**run**](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki/Calling-functions), and [**debug**](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki/Debugging-functions) your Cloud Functions on your local machine before deploying them to the production Google Cloud Functions service.

### Note
The Emulator only supports Node `v6.x.x`. It does *not* support Node `v8.x.x` or Python.

## How do I get started?

1. Write a function:

        mkdir helloWorld
        cd helloWorld
        touch index.js
        echo 'exports.helloWorld = (req, res) => res.send("Hello, World!");' > index.js

1. Install the Emulator:

    NPM:

        npm install -g @google-cloud/functions-emulator

    Yarn:

        yarn global add @google-cloud/functions-emulator

    Or read more in the detailed [installation instructions](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki/Installation).

1. Start the Emulator:

        functions start

1. Deploy your function:

        functions deploy helloWorld --trigger-http

    Get help deploying a function with `functions deploy --help`.

1. Call your function:

        functions call helloWorld

1. View the logs:

        functions logs read

## Where is the documentation?

For a quick reference, the Emulator CLI is self-documenting. Run the following to get help with the CLI:

    functions --help

For everything else see the [How-To Guides](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/wiki/How-To-Guides).

## Contributing

To give feedback, report a bug, or request a feature, please [open an issue](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/issues).

To contribute a change, [check out the contributing guide](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/blob/master/.github/CONTRIBUTING.md).

## License

Copyright 2017, Google, Inc.

Licensed under the Apache License, Version 2.0

See the [full license](https://github.com/GoogleCloudPlatform/cloud-functions-emulator/blob/master/LICENSE).
