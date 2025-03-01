import WorkerPool from "../src/WorkerPool";
const path = require('node:path');
const os = require('node:os');

test("test WorkerPool", async()=>{
    const pool = new WorkerPool(path.resolve(__dirname, "test_task.js"), os.availableParallelism());
    pool.addNewWorker();

    pool.runTask({key:"message"}, ()=>{pool.close()})
})