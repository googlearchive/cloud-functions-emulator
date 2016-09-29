var chai = require('chai');
var sinon = require('sinon');
var proxyquire = require('proxyquire').noCallThru();
var execSync = require('child_process').exec;

var controller = require('../app/controller.js');

var PROJECT_ID = 'foobar';

// Empty writer
controller.writer = {
  log: function() {},
  error: function() {},
  write: function() {}
};

describe('Cloud Functions Simulator Tests', function() {

  var TEST_MODULE = __dirname + '/test_module';

  beforeEach(function(done) {
    controller.status(function(err, status) {
      if (err) {
        done(err);
      } else if (status === controller.STOPPED) {
        controller.start(PROJECT_ID, false, done);
      } else {
        done();
      }
    });
  });

  afterEach(function(done) {
    controller.status(function(err, status) {
      if (err) {
        done(err);
      } else if (status !== controller.STOPPED) {
        controller.clear(done);
      } else {
        done();
      }
    });
  });

  after(function(done) {
    controller.status(function(err, status) {
      if (err) {
        done(err);
      } else if (status === controller.RUNNING) {
        controller.stop(done);
      } else {
        done();
      }
    });
  });

  it('Test status reports correct state after emulator start/stop',
    function(done) {

      //Expect to start in a RUNNING state
      controller.status(function(err, status) {

        if (err) {
          done(new Error(err));
          return;
        }

        if (status !== controller.RUNNING) {
          done(new Error('Simulator not running'));
          return;
        }

        // Stop the emulator
        controller.stop(function(err) {
          if (err) {
            done(new Error(err));
            return;
          }

          // We now expect it to report stopped
          controller.status(function(err, status) {
            if (status === controller.STOPPED) {
              done();
            } else {
              done(new Error(
                'Status did not report STOPPED after stop was called'
              ));
            }
          });
        });
      });
    });

  it('Test status reports correct state after emulator restart', function(
    done) {
    // Expect to start running
    controller.status(function(err, status) {
      if (err) {
        done(new Error(err));
        return;
      }

      if (status === controller.RUNNING) {
        // Restart the emulator
        controller.restart(function(err) {
          if (err) {
            done(new Error(err));
            return;
          }

          // We now expect it to report running
          controller.status(function(err, status) {
            if (err) {
              done(new Error(err));
            } else if (status !== controller.RUNNING) {
              done(new Error(
                'Status did not report RUNNING after restart was called'
              ));
            } else {
              done();
            }
          });
        });
      } else {
        done(new Error('Simulator not running'));
      }
    });
  });

  it('Deploys without error when the module and function exist', function(
    done) {
    controller.deploy(TEST_MODULE, 'hello', {}, done);
  });

  it('Fails deployment when the module doesn\'t exist', function(done) {
    controller.deploy('foobar', 'hello', {}, function(err) {
      if (err) {
        done();
        return;
      }
      done(new Error('Deployment should have failed but didn\'t'));
    });
  });

  it('Fails deployment when the function doesn\'t exist', function(done) {
    controller.deploy(TEST_MODULE, 'foobar', {}, function(err) {
      if (err) {
        done();
        return;
      }
      done(new Error('Deployment should have failed but didn\'t'));
    });
  });

  it('Returns the expected values in the list after deployment', function(
    done) {
    controller.deploy(TEST_MODULE, 'hello', 'B', function(err) {
      if (err) {
        done(err);
        return;
      }

      controller.list(function(err, list) {
        if (err) {
          done(err);
          return;
        }

        try {
          chai.expect(list).to.deep.equal({
            "hello": {
              name: 'hello',
              path: TEST_MODULE,
              type: 'BACKGROUND',
              url: null
            }
          });

          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  it('Returns the expected values in the list after deployment AND clear',
    function(
      done) {
      controller.deploy(TEST_MODULE, 'hello', 'B', function(err) {
        if (err) {
          done(err);
          return;
        }

        controller.clear(function(err) {
          if (err) {
            done(err);
            return;
          }
          controller.list(function(err, list) {
            try {
              chai.expect(list).to.deep.equal({});
              done();
            } catch (e) {
              done(e);
            }
          });
        });
      });
    });

  it('Calling a function works', function(
    done) {
    controller.deploy(TEST_MODULE, 'hello', 'B', function(err) {
      if (err) {
        done(err);
        return;
      }
      controller.call('hello', {}, function(err, body) {
        if (err) {
          done(err);
          return;
        }
        try {
          chai.expect(body).to.equal('Hello World');
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  it('Calling a function with JSON data works', function(
    done) {
    controller.deploy(TEST_MODULE, 'helloData', 'B', function(err) {
      if (err) {
        done(err);
        return;
      }
      controller.call('helloData', {
        "foo": "bar"
      }, function(err, body) {
        if (err) {
          done(err);
          return;
        }
        try {
          chai.expect(body).to.equal('bar');
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  it('Calling a function with a string of a JSON object works', function(
    done) {
    controller.deploy(TEST_MODULE, 'helloData', 'B', function(err) {
      if (err) {
        done(err);
        return;
      }
      controller.call('helloData', '{\"foo\": \"bar\"}', function(
        err, body) {
        if (err) {
          done(err);
          return;
        }
        try {
          chai.expect(body).to.equal('bar');
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  it('Returning JSON from a function works', function(
    done) {
    controller.deploy(TEST_MODULE, 'helloJSON', 'B', function(err) {
      if (err) {
        done(err);
        return;
      }
      controller.call('helloJSON', {}, function(err, body) {
        if (err) {
          done(err);
          return;
        }
        try {
          chai.expect(body).to.deep.equal({
            message: 'Hello World'
          });
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  it('Functions that throw exceptions don\'t crash the process', function(
    done) {
    controller.deploy(TEST_MODULE, 'helloThrow', 'B', function(err) {
      if (err) {
        done(err);
        return;
      }
      controller.call('helloThrow', {}, function(err, body) {
        if (err) {
          try {
            chai.expect(err).to.equal('uncaught exception!');

            // Ensure the process is still running
            controller.status(function(err, status) {
              if (err) {
                done(new Error(err));
              } else if (status !== controller.RUNNING) {
                done(new Error(
                  'Status did not report RUNNING after uncaught exception'
                ));
              } else {
                done();
              }
            });
          } catch (e) {
            done(e);
          }
          return;
        }
        done('Expected error but didn\'t get one');
      });
    });
  });
});