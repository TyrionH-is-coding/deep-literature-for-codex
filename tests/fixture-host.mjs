import http from 'node:http';
const identity = JSON.parse(process.env.CSR_IDENTITY);
const server = http.createServer((_request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ ...identity, pid: process.pid }));
});
server.listen(0, '127.0.0.1', () => {
  process.send({ type: 'workbench-ready', ...identity, pid: process.pid,
    url: `http://127.0.0.1:${server.address().port}` });
});
process.on('message', message => {
  if (message?.type === 'workbench-stop') server.close(() => process.exit(0));
});
