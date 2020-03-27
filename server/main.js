const compression = require('compression');
const express = require('express');
const expressWS = require('express-ws');
const helmet = require('helmet');
const path = require('path');
const Game = require('./game');

const room = new Game({
  dimensions: { width: 10, height: 20 },
  players: 2,
});

const server = express();
server.use(compression());
server.use(helmet());
server.use(express.static(path.join(__dirname, '..', 'client')));
expressWS(server, null, { clientTracking: false, perMessageDeflate: true });
server.ws('/', room.onClient.bind(room));
server.use((req, res) => res.status(404).end());
server.listen(process.env.PORT || 8080);
