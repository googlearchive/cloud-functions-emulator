module.exports = {
  hello: function(context, data) {
    context.success('Hello World');
  },
  helloData: function(context, data) {
    context.success(data['foo']);
  },
  helloJSON: function(context, data) {
    context.success({
      "message": "Hello World"
    });
  },
  helloThrow: function(context, data) {
    throw 'uncaught exception!'
  }
};