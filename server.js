'use strict';

let dns = require('dns');

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/
mongoose.connect(process.env.MONGOLAB_URI, { useNewUrlParser: true })
.then(
function() {
  // Connection successfuls

  // Create the model that will store the urls
  let surlSchema = mongoose.Schema({
    url : String,
    index : Number
  });
  let Surl = mongoose.model('Surl', surlSchema);

  let index;

  Surl.findOne({}).sort('-_id').select('index')
  .then(
  function(doc) {

    index = doc ? doc.index || 0 : 0;

    console.log("index is " + index);
    
    // Functions that query and change the database
    function createAndSaveSurl(url, done) {

      let surl = new Surl({
        url : url,
        index : index + 1
      });

      surl.save()
        .then(data => done(null, data))
        .catch(err => done(err));
    };


    app.use(cors());

    /** this project needs to parse POST bodies **/
    // you should mount the body-parser here
    let bodyParser = require('body-parser');
    app.use(bodyParser.urlencoded({extended: false}));

    app.use('/public', express.static(process.cwd() + '/public'));

    app.get('/', function(req, res){
      res.sendFile(process.cwd() + '/views/index.html');
    });


    // your first API endpoint... 
    app.get("/api/hello", function (req, res) {
      res.json({greeting: 'hello API'});
    });


    app.route('/api/shorturl/new')
      .post(function(req, res) {
        console.log("posting url...");
        let url = req.body.url;
      
        // www.example.com and www.example.com/ are the same
        if (url[url.length-1] === "/") url = url.slice(0, -1);

        // Surl.findOneAndDelete({url: req.body.url}, {useFindAndModify: false}).then(() => res.json({deleted: 'yes'})).catch(err => res.send(err))
        Surl.findOne({url: url})
          .then(function(doc) {
            console.log("searched if url already exists...");
            if (doc) {
              res.json({original_url: doc.url, short_url: doc.index});
              }
            else {
              // Check if url is valid
              
              console.log("Checking if url is valid...");
              let host = url.match(/\/\/[^/]+/)[0].slice(2);
              
              dns.lookup(host, function(err) {
                if (err) return res.json({"error": "invalid URL (hostname)"});
                
                let protocol = url.match(/^https?:\/\//);
                
                if (!protocol) return res.json({"error": "invalid URL (protocol)"});
                
                protocol = protocol[0];
                
                // Hope that the user won't enter an invalid path!
                // Be more thorough in checking the validity of the url if this was a real app
                
                createAndSaveSurl(url, function(err, data) {
                  if (err) {
                    console.error("Error while trying to insert new url: \n" + err);
                    return res.send("Error while trying to insert new url");
                  }

                  // Creation successful, so update index
                  index = data.index;
                  console.log("new index is " + index);
                  res.json({original_url: data.url, short_url: data.index});
                });
              });
            }
          })
          .catch(function(err) {
            console.error("Error when trying to find req.body.url: \n" + err);
            return res.send("Error when trying to find req.body.url");
          });
      });
    
    
    // Redirect short urls
    app.route('/api/shorturl/:index')
      .get(function(req, res) {
      Surl.findOne({index : req.params.index}).then(doc => {
        if (doc) return res.redirect(doc.url);
        res.send('Short url: "' + req.params.index + '" does not correspond to any link.')
      })
    });



    app.listen(port, function () {
      console.log('Node.js listening ...');
    });
  },
  err => console.error("Error when trying to find one and sort by id: \n" + err)
  )
},
// Connection failed
err => console.error("Connection Error: \n" + err)
)