var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

// comment out while testing user login
/*app.get('/',
function(req, res) {
  res.render('index');
});*/

// send user to login page unless authenticated
app.get('/',
function(req, res){
  res.render('login');
});

// login url leads to login page
app.get('/login',
function(req, res) {
  res.render('login');
});

// signup url leads to signup page
app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.get('/create',
function(req, res) {
  res.render('index');
});

app.get('/logout',
function(req, res) {
  res.render('login');
});

app.get('/links',
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

// post for user login
app.post('/login',
function(req, res){
  var username = req.body.username;
  var password = req.body.password;

  // test case - username: Kiran, password: Password123
  new User({username: username}).fetch().then(function(found){
    if(found){ // if user exists
      var salt = found.get('salt');
      var hash = bcrypt.hashSync(password, salt);
      // is password correct?
      if (hash === found.get('password')){
        // TODO: Authenticate User session so get's past login page
        console.log('authenticate!')
        res.redirect('/');
      } else { // else
        // error user
        console.log('Not a valid password: ', password);
        return res.render('login', {
          error: 'Password is wrong'
        });
      }
    } else { // error user - highlight, signup
      console.log('Not a valid user');
      return res.render('signup', {
        error: 'Username does not exist'
      });
    }
  });
});

// create post for user signup - complete salt + hash as a part of this
app.post('/signup',
function(req, res){
  var username = req.body.username;
  var password = req.body.password;
  // used sync... change to callback?
  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);

  // new user signup
  new User({username: username}).fetch().then(function(found){
    if(found){ // if user exists
      console.log('User already exists')
      // return to login page
      return res.render('login', {
        error: 'Username already exists'
      });
    } else { // else
      // add user, new password, and salt to db
      var user = new User({
        username: username,
        password: hash,
        salt: salt
      });

      user.save().then(function(newUser){
        Users.add(newUser);
        // TODO: Authenticate User session so get's past login page
        res.redirect('/');
      });

    };
  });
});

app.post('/links',
function(req, res) {
  var uri = req.body.url;
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  /*console.log(req.url);*/
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });
      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
