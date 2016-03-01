(function() {
    var locals = {

        /* Basic functionallity */
        window: {
        },
        document: {
        },
        Math: window.Math,
        Number: window.Number,
        NaN: window.NaN,
        Infinity: window.Infinity,
        Boolean: window.Boolean,
        Function: window.Function,
        Array: window.Array,
        String: window.String,

        /* Libraries */
        moment: window.moment,
        d3: window.d3
    };

    var that = Object.create(null); // create our own this object for the user code

    var createSandbox = function (func, that, locals) {

        var validVariable = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

        var code = '"use strict"; return ' + func + "";
        var params = []; // the names of local variables
        var args = []; // the local variables

        var keys = Object.getOwnPropertyNames( window );

        for( var i = 0; i < keys.length; ++i ) {
            if(typeof locals[keys[i]] === 'undefined') {
                locals[keys[i]] = null;
            }
        }

        delete locals['eval'];
        delete locals['arguments'];


        for (var param in locals) {
            if (locals.hasOwnProperty(param) && validVariable.test(param)) {
                args.push(locals[param]);
                params.push(param);
            }
        }

        var context = Array.prototype.concat.call(that, params, code); // create the parameter list for the sandbox
        //console.log(context);
        var sandbox = new (Function.prototype.bind.apply(Function, context)); // create the sandbox function
        context = Array.prototype.concat.call(that, args); // create the argument list for the sandbox

        return Function.prototype.bind.apply(sandbox, context); // bind the local variables to the sandbox
    };

    var createSandboxedFuntion = function(func) {
        return createSandbox(func, that, locals);
    };

    window.createSandboxedFuntion = createSandboxedFuntion;
})();