const WorkerPool = require('./WorkerPool.js');
const os = require('node:os');
const fs = require("fs")
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const {code_dir, loadInteractiveHandler} = require("./Util.js")
const { ReportInteractorCode } = require('./ReportInteractorCode.js');
var log = require("loglevel").getLogger("interactive-verification-report/VRDaemon");

let pool = undefined;
let app = undefined;
let all_handler = undefined
let api_server = undefined
let meta_file_dir=undefined
let _storage_context = undefined
let _meta_provider = undefined

export const get_express_instance = function(){
  return app;
}


export const init_vrdaemon =  function(meta_provider, port, storage_context, all_meta_file_dir = "./"){
  pool = new WorkerPool(path.resolve(__dirname, 'TaskProcessor.js'), os.availableParallelism());
  app = express()
  app.use(bodyParser.json()); // 支持 JSON 格式的请求体

  if(all_handler === undefined){
    all_handler = new ReportInteractorCode()
  }

  meta_file_dir = all_meta_file_dir
  _storage_context = storage_context
  _meta_provider = meta_provider
  // 定义一个 API 接口，接受 request_hash 和参数
  app.get('/api/report', (req, res) => {
    const { request_hash, params } = req.query; // 获取 request_hash 和参数
    //console.log("reqbody: ", req)
    (async()=>{
      const enclave_hash = await meta_provider.getEnclaveHash(request_hash);
      if (!request_hash) {
        return res.status(400).json({ success: false, message: 'request_hash is required' });
      }

      try {
        // 根据 enclave_hash 动态加载并执行处理
        const enclaveHandler = await loadInteractiveHandler(all_handler, code_dir(_storage_context), meta_provider, enclave_hash);

        const meta_file = path.join(meta_file_dir, request_hash + ".meta")

        const meta = JSON.parse(fs.readFileSync(meta_file, 'utf8'));

        // 传递 params 给处理函数
        const result = enclaveHandler(meta, params);
        res.json({success:true, result});
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    })();
    
  });

  // 启动服务器
  api_server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

export const close_vrdaemon = function (){
  if(pool !== undefined){
    pool.close();
  }
  if(api_server !== undefined){
    api_server.close();
  }
  if(all_handler !== undefined){
    all_handler.stop();
  }
}

export const  process_verfication_report = async function( 
  request_hash,
  local_encrypted_report_url, callback){

    pool.runTask({storage:_storage_context,
      report:local_encrypted_report_url,
      meta: _meta_provider,
      handler:all_handler,
      meta_file_dir: meta_file_dir,
      request_hash: request_hash
    }, callback)
}

