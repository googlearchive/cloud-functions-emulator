/**
 * Called when the require() method
 * @param {String} path The file system path to the module
 */
exports.onRequire = function (func, module) {
  // Return an object or module to override the named module argument
  return undefined;
};
