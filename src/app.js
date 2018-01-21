/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var client_id = '4c90aaa531644903a0e64f2d7ca432d0'; // Your client id
var client_secret = 'cac6f25e74f349cebe7f582b2de40f2b'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email playlist-read-private playlist-modify playlist-modify-public playlist-modify-private user-top-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

var mood;
var people;
var concerts;
var dancing;

app.get('/submit', function(req, res) {
  mood = req.query.mood;
  people = req.query.people;
  concerts = req.query.concerts;
  dance = req.query.dance;
  res.redirect('/login');
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          var username = body.id; 
          var playlistID;
          //Create Playlist
          var postOptions = {
            url: 'https://api.spotify.com/v1/users/' +  body.id + '/playlists',
            headers: { 'Authorization': 'Bearer ' + access_token , 'Content-Type': 'application/json'},
            body: JSON.stringify({name: "mixr"})
          };
          request.post(postOptions, function(error, response, body) {
            playlistID = JSON.parse(body).id;
          });

          // Get Top Artists
          var artistOptions = {
            url: 'https://api.spotify.com/v1/me/top/artists?limit=5',
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
          }
          request.get(artistOptions, function(error, response, body) {
            // Variables for recommendations 
            var target_danceability;
            var target_energy;
            var target_liveness; // sounds more like it's live
            var target_loudness;
            var target_valence;

            if (mood === 'happy') {
              target_valence = 0.9;
            } else if (mood === 'sad') {
              target_valence = 0.2;

            } else if (mood === 'chill') {
              target_valence = 0.6;
            } else if (mood === 'upset') {
              target_valence = 0.1;
            }

            if (people === '1') {
              target_energy = 0.2;
              target_loudness = -45;
            } else if (people === '2') {
              target_energy = 0.4;
              target_loudness = -30;
            } else if (people === '5') {
              target_energy = 0.6;
              target_loudness = -15;
            } else if (people === '20') {
              target_energy = 0.8;
              target_loudness = -3;
            }

            if (concerts === 'yes') {
              target_liveness = 0.75;
            } else if (concerts === 'no') {
              target_liveness = 0.4;
            }

            if (dance === 'yes') {
              target_danceability = 0.9;
            } else if (dance === 'no') {
              target_danceability = 0.15;
            } else if (dance === 'sometimes') {
              target_danceability = 0.6;
            }

            //Get Recommendations
            var recommendationOptions = {
              url: 'https://api.spotify.com/v1/recommendations?limit=50&seed_artists=' + body.items[0].id + "," + body.items[1].id + 
              "," + body.items[2].id + "," + body.items[3].id + "," + body.items[4].id + '&target_valence=' + target_valence + '&target_energy=' + target_energy
              + '&target_danceability=' + target_danceability + '&target_loudness=' + target_loudness + '&target_liveness=' + target_liveness,
              headers: { 'Authorization': 'Bearer ' + access_token },
              json: true
            }
            request.get(recommendationOptions, function (error, response, body) {
              var trackArray = [];
              for (i = 0; i < body.tracks.length; i++) {
                trackArray.push(body.tracks[i].uri);
              }
              // Add songs from recommendations
              var playlistOptions = {
                url: 'https://api.spotify.com/v1/users/' + username + '/playlists/' + playlistID + '/tracks',
                headers: { 'Authorization': 'Bearer ' + access_token , 'Content-Type': 'application/json'},
                body: JSON.stringify({uris: trackArray})
              }

              request.post(playlistOptions, function(error, response, body) {
              });


            });

          });

        });

      
        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});


console.log('Listening on 8888');
app.listen(8888);
