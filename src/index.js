const express = require('express');
const http = require('http');
const routes = require('./routes');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/', routes);

const server = http.createServer(app);
server.setTimeout(600000); // 10 minutes timeout

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
