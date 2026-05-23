const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const express = require('express');
const cors = require('cors');
const catalogHandler = require('./handlers/catalog');
const metaHandler = require('./handlers/meta');
const streamHandler = require('./handlers/stream');
const { MANIFEST } = require('./manifest');

const app = express();
app.use(cors());
app.use(express.json());

const builder = new addonBuilder(MANIFEST);

builder.defineCatalogHandler(catalogHandler);
builder.defineMetaHandler(metaHandler);
builder.defineStreamHandler(streamHandler);

const addonInterface = builder.getInterface();

// Serve addon
serveHTTP(addonInterface, { port: 7000, static: '/public' });

console.log('🎬 Nuvio Addon çalışıyor: http://localhost:7000/manifest.json');
