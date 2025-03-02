const { createRequire } = require('module');
const fs = require("fs")
const { randomUUID } =require( 'crypto');
const path = require('path');


const processorCodeKey = function(enclave_hash){
    return enclave_hash + "_p";
}
const interactorCodeKey = function(enclave_hash){
    return enclave_hash + "_i";
}

const code_dir = function(_storage_config){
    let dir;
    if(_storage_config === undefined){
      dir =  path.join(__dirname, "code");
    }else{
      dir = path.join(_storage_config.data_dir, "code")
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir
  }


// 动态加载指定的处理模块
const loadInteractiveHandler = async function (all_interactor_code, code_dir, meta_provider, enclaveHash) {
    try {
        
        //使用缓存，避免频繁读取文件
        var enclaveHandler = all_interactor_code.access(interactorCodeKey(enclaveHash))
        if(enclaveHandler === null){
          // 根据 enclave_hash 动态加载对应的模块
          
          var modulePath = path.join(code_dir, `${enclaveHash}_interactor.js`);
          if(true/*!fs.existsSync(modulePath)*/){
            fs.writeFileSync(modulePath, await meta_provider.getInteractorCode(enclaveHash));
          }
          enclaveHandler = require(modulePath);
          all_interactor_code.add(interactorCodeKey(enclaveHash), enclaveHandler);
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

const loadDataProcessorHandler = async function (all_interactor_code, code_dir, meta_provider, enclaveHash) {
    try {
        //使用缓存，避免频繁读取文件
        var enclaveHandler = all_interactor_code.access(processorCodeKey(enclaveHash))
        if(enclaveHandler === null){
          // 根据 enclave_hash 动态加载对应的模块
          
          var modulePath = path.join(code_dir, `${enclaveHash}_data_processor.js`);
          if(true/*!fs.existsSync(modulePath)*/){
            fs.writeFileSync(modulePath, await meta_provider.getInteractorCode(enclaveHash));
          }
          enclaveHandler = require(modulePath);
          all_interactor_code.add(processorCodeKey(enclaveHash), enclaveHandler);
        }
        
        // 校验并执行动态加载的模块，传递不同的参数
        if (typeof enclaveHandler !== 'function') {
            throw new Error(`Invalid data processor code for enclave hash: ${enclaveHash}`);
        }
  
        return enclaveHandler;
    } catch (error) {
        throw new Error(`Error loading data processor code: ${error.message}`);
    }
  }
  module.exports = { code_dir, loadDataProcessorHandler, loadInteractiveHandler };