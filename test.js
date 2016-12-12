// const grpc = require('grpc');
// const http = require('http');
// const uuid = require('uuid');

// const Model = require('./src/model');
// const { Operation, CloudFunction, protos } = Model;
// const { Operations, CloudFunctionsService } = protos;

// function notImplemented (call, cb) {
//   cb({
//     code: grpc.status.UNIMPLEMENTED,
//     details: http.STATUS_CODES['501']
//   });
// }

// const functionName = `projects/p/locations/l/functions/f`;
// const operationName = `operations/${uuid.v4()}`;

// const cloudfunction = new CloudFunction(functionName, {
//   pubsubTrigger: 'foo',
//   gcsUrl: 'gs://bucket/file.zip'
// });

// function createFunction (call, cb) {
//   console.log('createFunction REQUEST');
//   console.log(JSON.stringify(call.request, null, 2));
//   try {
//     const operation = new Operation(operationName, {
//       done: true,
//       response: {
//         typeUrl: protos.getPath(protos.CloudFunction),
//         value: cloudfunction.toJSON()
//       }
//     });
//     cb(null, operation.toProtobuf());
//     return;
//   } catch (err) {
//     console.error(err);
//     cb({
//       code: 5,
//       details: err.message
//     });
//     return;
//   }
// }

// function getFunction (call, cb) {
//   try {
//     const err = new Error('Operation operations/doesNotExist does not exist');
//     const error = {
//       code: grpc.status.NOT_FOUND,
//       message: err.message,
//       details: [
//         {
//           typeUrl: 'types.googleapis.com/google.rpc.DebugInfo',
//           value: {
//             stackEntries: err.stack.split('\n'),
//             detail: err.message
//           }
//         },
//         {
//           typeUrl: 'types.googleapis.com/google.rpc.ResourceInfo',
//           value: {
//             resourceType: 'types.googleapis.com/google.longrunning.Operation',
//             resourceName: 'operations/doesNotExist',
//             description: err.message
//           }
//         }
//       ]
//     };
//     console.log(JSON.stringify(error, null, 2));
//     error.details.forEach((detail) => {
//       protos.encodeAnyType(detail);
//     });
//     console.log(JSON.stringify(error, null, 2));
//     cb(error);
//     return;
//   } catch (err) {
//     console.error(err);
//     cb({
//       code: 5,
//       details: err.message
//     });
//     return;
//   }
// }

// const server = new grpc.Server();

// server.addProtoService(Operations.service, {
//   cancelOperation: notImplemented,
//   deleteOperation: notImplemented,
//   getOperation: notImplemented,
//   listOperations: notImplemented
// });

// server.addProtoService(CloudFunctionsService.service, {
//   callFunction: notImplemented,
//   createFunction,
//   deleteFunction: notImplemented,
//   getFunction,
//   listFunctions: notImplemented,
//   updateFunction: notImplemented
// });

// server.bind('localhost:50051', grpc.ServerCredentials.createInsecure());
// server.start();

// const operationsClient = new Operations(
//   'localhost:50051',
//   grpc.credentials.createInsecure()
// );
// const functionsClient = new CloudFunctionsService(
//   'localhost:50051',
//   grpc.credentials.createInsecure()
// );

// function stop () {
//   server.tryShutdown(() => {});
// }

// setTimeout(() => {
//   functionsClient.getFunction({
//     name: functionName
//   }, (err, cloudfunction) => {
//     if (err) {
//       console.error('ERROR');
//       console.error(err);
//       stop();
//     } else {
//       console.log('DECODED');
//       operation = new Operation(operation.name, operation);
//       console.log(JSON.stringify(operation, null, 2));

//       // functionsClient.getFunction({
//       //   name: operation.response.value.name
//       // }, (err, cloudfunction) => {
//       //   if (err) {
//       //     console.error('ERROR');
//       //     console.error(err);
//       //     stop();
//       //   } else {
//       //     try {
//       //       console.log('DECODED');
//       //       cloudfunction = new CloudFunction(cloudfunction.name, cloudfunction);
//       //       console.log(JSON.stringify(cloudfunction, null, 2));
//       //     } catch (err) {
//       //       console.error(JSON.stringify(err, null, 2));
//       //     }
//           stop();
//         // }
//       // });
//     }
//   });
// }, 500);

