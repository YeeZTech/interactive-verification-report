const { parentPort } = require('node:worker_threads');


parentPort.on('message', async (task) => {
    console.log("worker recv message, ", task)
    parentPort.postMessage("done");
});