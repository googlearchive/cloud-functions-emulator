var self = {
  _originalLoader: null,
  init: function (handler) {
    var Module = require('module');
    self._originalLoader = Module._load;
    Module._load = function () {
      var override = handler.onRequire(process.env['FUNCTION_NAME'], arguments[0]);
      return (override || self._originalLoader.apply(this, arguments));
    };
  }
};

module.exports = self;
