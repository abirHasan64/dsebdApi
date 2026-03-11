/**
 * Main Express server setup for DSE API
 * Initializes routes, middleware, and background scraping
 */

const express = require('express');
const http = require('http');
const routes = require('./routes');
const path = require('path');

// Start background scraper (collects stock data, indices, news, archives)
require('../autoScraper');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use('/', routes);
app.use(express.static(path.join(__dirname)));

// Create HTTP server with extended timeout (10 minutes)
// Needed for scraping operations that take time
const server = http.createServer(app);
server.setTimeout(600000);

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
