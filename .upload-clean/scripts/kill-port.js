// Kill the dev port before starting nodemon to avoid EADDRINUSE.
const kill = require('kill-port');

const port = Number(process.env.PORT || 3000);

kill(port, 'tcp')
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`[kill-port] Cleared port ${port}`);
    process.exit(0);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.warn(`[kill-port] Proceeding despite error: ${error.message || error}`);
    process.exit(0);
  });
