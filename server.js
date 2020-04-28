const express = require('express');
const path = require('path')
const request = require('request'); // "Request" library
const cors = require('cors');
const compression = require('compression')
const dotenv = require('dotenv');
const querystring = require('query-string');
const fbAdmin = require('firebase-admin');
const FieldValue = fbAdmin.firestore.FieldValue;
const app = express();

dotenv.config();

app.get('*.html', function (req, res, next) {
  req.url = req.url + '.gz';
  res.set('Content-Encoding', 'gzip');
  res.set('Content-Type', 'text/html');
  next();
});

app.get('*.js', function (req, res, next) {
  req.url = req.url + '.gz';
  res.set('Content-Encoding', 'gzip');
  res.set('Content-Type', 'text/javascript');
  next();
});

app.get('*.css', function (req, res, next) {
  req.url = req.url + '.gz';
  res.set('Content-Encoding', 'gzip');
  res.set('Content-Type', 'text/css');
  next();
});

app.use(express.static(__dirname + '/dist'))
    .use(cors())
    .use(express.json())
    .use(compression());

const server_port = process.env.PORT || 8081;
const scope = 'user-read-private user-read-email user-read-birthdate user-top-read user-read-recently-played user-modify-playback-state user-read-playback-state user-read-currently-playing streaming user-library-modify user-library-read';
const client_id = process.env.Spotify_client_id;
const client_secret = process.env.Spotify_client_secret;
const redirect_uri = process.env.Spotify_redirect_uri;

app.listen(server_port, () => {
  console.log("Server is listening on port: " + server_port);
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/dist/index.html'))
})

app.get('/about', function (req, res) {
  res.sendFile(path.join(__dirname, '/dist/index.html'))
})

app.get('/dashboard', function (req, res) {
  res.sendFile(path.join(__dirname, '/dist/index.html'))
})


app.get('/community', function (req, res) {
  res.sendFile(path.join(__dirname, '/dist/index.html'))
})

app.get('/login', function (req, res) {
  // redirect to Spotify login page
  res.writeHead(302, {
    'Location': `https://accounts.spotify.com/authorize` +
      `?client_id=${client_id}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURI(redirect_uri)}` +
      `&scope=${encodeURI(scope)}` +
      `&show_dialog=true`
  });
  res.send();
});

app.get('/callback' , function (req, res) {
  const code = req.query.code || null;
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: code,
      redirect_uri: redirect_uri,
      grant_type: 'authorization_code'
    },
    headers: {
      'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
    },
    json: true
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      const access_token = body.access_token;
      const refresh_token = body.refresh_token;
      res.cookie('accessToken', access_token);
      res.cookie('refreshToken', refresh_token);
      res.redirect('/');
    } else {
      res.redirect('/' +
        querystring.stringify({
          error: 'invalid_token'
        }));
    }
  })
});

app.post('/refreshToken', function (req, res) {
  const refreshToken = req.body.refreshToken;
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      const access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

/** Firebase */

const serviceAccount = {
  "type": process.env.Type,
  "project_id": process.env.Project_id,
  "private_key_id": process.env.Private_key_id,
  "private_key": process.env.Private_key.replace(/\\n/g, '\n'),
  "client_email": process.env.Client_email,
  "client_id": process.env.Client_id,
  "auth_uri": process.env.Auth_uri,
  "token_uri": process.env.Token_uri,
  "auth_provider_x509_cert_url": process.env.Auth_provider_x509_cert_url,
  "client_x509_cert_url": process.env.Client_x509_cert_url,
};

fbAdmin.initializeApp({
  credential: fbAdmin.credential.cert(serviceAccount),
  databaseURL: "https://tessellator-space.firebaseio.com"
});

app.post('/authUser', function (req, res) {
  const userID = req.body.id;
  fbAdmin.auth().createCustomToken(userID)
    .then(function(customToken) {
      // Send token back to client
      res.send(customToken);
    })
    .catch(function(error) {
      console.log('Error creating custom token:', error);
    })
});

app.post('/addUser', function (req, res) {
  const userData = req.body.userData;
  fbAdmin.firestore().collection('users').doc(userData.id).set({
    userData: userData
  }, { merge: true }).then(ref => {
    // console.log('Added document with ID: ', ref)
  }).catch((error) => {
    console.log(error)
  })
})

app.post('/addTrackPlayed', function (req, res) {
  const trackData = req.body.trackData;
  const userID = req.body.userID;
  const trackRef = fbAdmin.firestore().collection('topUserTracks').doc(trackData.id);
  trackRef.set({
    count: FieldValue.increment(1),
    trackData: trackData
  }, { merge: true });
  trackRef.collection('users').doc(userID).set({
    count: FieldValue.increment(1)
  }, { merge: true });
})

app.post('/addArtistsPlayed', function (req, res) {
  const artistsData = req.body.artistsData;
  const userID = req.body.userID;
  
  artistsData.forEach(artist => {
    const artistRef = fbAdmin.firestore().collection('topUserArtists').doc(artist.id);
    artistRef.set({
      count: FieldValue.increment(1),
      artistData: artist
    }, { merge: true });
    artistRef.collection('users').doc(userID).set({
      count: FieldValue.increment(1)
    }, { merge: true });
  })
})
/** Move below to a separate firestore-utils */

function incrementCounter(docRef, numShards) {
  const shardId = Math.floor(Math.random() * numShards);
  const shardRef = docRef.collection('topUserTracks').doc(shardId.toString());
  return shardRef.set({ count: FieldValue.increment(1) }, { merge: true });
}
