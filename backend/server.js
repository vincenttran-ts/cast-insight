/**
 * Local dev entry — starts the Express gateway on PORT (default 3001).
 * On Vercel, api/index.js imports backend/app.js instead.
 */

const app = require('./app');
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`CastInsight backend listening on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT to a free port.`);
  } else {
    console.error('[server]', err.message || err);
  }
  process.exit(1);
});
