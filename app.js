var express = require('express'),
    path = require('path'),
    favicon = require('static-favicon'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose'),
    crypto = require('crypto'),
    dotenv = require('dotenv');

dotenv.load();

var sendgrid = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);

var dburi = 
    process.env.MONGOLAB_URI || 
    process.env.MONGOHQ_URL || 
    'mongodb://localhost/node-emailauth';

mongoose.connect(dburi, function (err, res) {
    if (err) { 
        console.log ('ERROR connecting to: ' + dburi + '. ' + err);
    } else {
        console.log ('Succeeded connected to: ' + dburi);
    }
});

var userSchema = new mongoose.Schema({
    email: { type: String, required:true, unique:true },
    authToken: { type: String, required:true, unique:true },
    isAuthenticated: { type: Boolean, required:true }
});

var User = mongoose.model('User', userSchema);

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

app.post('/login', function(req,res) {
    console.log(req.body);

    //generate authentication token
    var seed = crypto.randomBytes(20);
    var authToken = crypto.createHash('sha1').update(seed + req.body.email).digest('hex');

    var newUser = new User({
        email: req.body.email,
        authToken: authToken,
        isAuthenticated: false
    });

    newUser.save(function(err, newUser) {
        if (err) {
            return console.error(err);
        }
        console.dir(newUser);

        var authenticationURL = 'http://localhost:3000/verify_email?token=' + newUser.authToken;
        sendgrid.send({
            to:       newUser.email,
            from:     'emailauth@heitor.io',
            subject:  'Confirm your email',
            html:     '<a target=_blank href=\"' + authenticationURL + '\">Confirm your email</a>'
            }, function(err, json) {
                if (err) { return console.error(err); }
            console.log(json);
        });
    });

    res.render('index', {title: 'Sent authentication email'});
});

app.get('/verify_email', function(req,res) {
    console.log('verify_email token: ',req.query.token);

    User.findOne({ authToken: req.query.token }, function(err, user) {
        if (err) { return console.error(err); }
        console.dir(user);

        user.isAuthenticated = true;
        user.save(function (err) {
            if (err) return console.error(err);
            console.log('succesfully updated user');
            console.log(user);

            sendgrid.send({
                to:       user.email,
                from:     'emailauth@heitor.io',
                subject:  'Email confirmed!',
                html:     'Awesome! We can now send you kick-ass emails'
                }, function(err, json) {
                    if (err) { return console.error(err); }
                console.log(json);
            });

            res.send(user);
            
            //update page
        });
    });

    res.render('index', {title: 'Authenticating...'});
});

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
