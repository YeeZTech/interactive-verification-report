const WorkerPool = require('./WorkerPool.js');
const os = require('node:os');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { createRequire } = require('module');
const fs = require("fs")
const { ReportInteractorCode } = require('./ReportInteractorCode.js');


var log = require("loglevel").getLogger("interactive-verification-report/VRDaemon");

let pool = undefined;
let app = undefined;
let all_interactor_code = undefined
let api_server = undefined
let meta_file_dir=undefined

// 动态加载指定的处理模块
async function loadEnclaveHandler(meta_provider, enclaveHash, params) {
  try {
      console.log("a0");
      if(all_interactor_code === undefined){
        all_interactor_code = new ReportInteractorCode()
      }
      //使用缓存，避免频繁读取文件
      var enclaveHandler = all_interactor_code.access(enclaveHash)
      console.log("a1");
      if(enclaveHandler === null){
        // 根据 enclave_hash 动态加载对应的模块
        
        var modulePath = path.join(__dirname, `handlers_${enclaveHash}.js`);
        console.log("a2");
        if(true/*!fs.existsSync(modulePath)*/){
          console.log("a3");
          fs.writeFileSync(modulePath, await meta_provider.getInteractorCode(enclaveHash));
        }
        console.log("a4");
        enclaveHandler = require(modulePath);
        console.log("a5");
        all_interactor_code.add(enclaveHash, enclaveHandler);
      }
      

      // 校验并执行动态加载的模块，传递不同的参数
      if (typeof enclaveHandler !== 'function') {
          throw new Error(`Invalid handler for enclave hash: ${enclaveHash}`);
      }

      return enclaveHandler;


  } catch (error) {
      throw new Error(`Error loading enclave handler: ${error.message}`);
  }
}

export const get_express_instance = function(){
  return app;
}

export const init_vrdaemon =  function(meta_provider, port, all_meta_file_dir = "./"){
  pool = new WorkerPool(path.resolve(__dirname, 'TaskProcessor.js'), os.availableParallelism());
  app = express()
  app.use(bodyParser.json()); // 支持 JSON 格式的请求体

  meta_file_dir = all_meta_file_dir
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
        const enclaveHandler = await loadEnclaveHandler(meta_provider, enclave_hash, params);

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
}

export const  process_verfication_report = async function(meta_provider, 
  request_hash,
  storage_config,
  local_encrypted_report_url, callback){

    const enclave_hash = await meta_provider.getEnclaveHash(request_hash);
    const processor_code = await meta_provider.getDataProcessorCode(enclave_hash)
    const private_key = await meta_provider.getShuPrivateKey()
    const interactor_code = await meta_provider.getInteractorCode(enclave_hash)

    pool.runTask({storage_config:storage_config,
      report:local_encrypted_report_url,
      private_key: private_key,
      vrprocessor:processor_code,
      enclave_hash:enclave_hash,
      meta_file_dir: meta_file_dir,
      request_hash: request_hash
    }, callback)
}

