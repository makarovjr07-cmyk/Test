const cluster = require('cluster');
const os = require('os');

const configuredWorkerCount = Number.parseInt(String(process.env.WEB_CONCURRENCY || '').trim(), 10);
const workerCount = Number.isFinite(configuredWorkerCount) && configuredWorkerCount > 0
  ? configuredWorkerCount
  : 1;

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} starting ${workerCount} workers...`);
  for (let index = 0; index < workerCount; index += 1) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.warn(
      `Worker ${worker.process.pid} exited (code=${code || 0}, signal=${signal || 'none'}). Restarting...`
    );
    cluster.fork();
  });
} else {
  require('./app');
}
