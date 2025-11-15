const { parentPort } = require('node:worker_threads');
const { writeFile, unlink } = require('fs/promises');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Unsealer, SealedFileStream } = require("@yeez-tech/meta-encryptor");
const { code_dir, loadDataProcessorHandler } = require("./Util.js");
const { report } = require('node:process');
const ReportInteractorCode = require('./ReportInteractorCode.js');

var log = require("loglevel").getLogger("interactive-verification-report/TaskProcessor");

const all_processor_code = new ReportInteractorCode();

parentPort.on('message', (task) => {
    const storage = task.storage
    const meta_provider = task.meta

    const local_encrypted_report_url = task.report
    const meta_file_dir = task.meta_file_dir
    const request_hash = task.request_hash

    const temp_report = `./temp-report-${randomUUID()}.data`; // 生成临时文件

    (async()=>{
        
        const private_key = meta_provider.shu_private_key;
        const enclave_hash = meta_provider.enclave_hash;
        
        let unsealer = new Unsealer({keyPair:{private_key:private_key}});
        let rrs = new SealedFileStream(local_encrypted_report_url);
        let wws = fs.createWriteStream(temp_report)

        rrs.pipe(unsealer).pipe(wws);
        await new Promise(resolve=>{
            wws.on('finish', ()=>resolve());
        })
        const dataProcessor = await loadDataProcessorHandler(all_processor_code, code_dir(storage), meta_provider.processor_code, enclave_hash);

        let result = await dataProcessor(storage, enclave_hash, request_hash, temp_report);
        if (result && result.success === undefined && result.result === undefined) {
            // 兼容直接返回 meta 的处理器
            result = { success: true, result };
        }
        //const result = await executeMixedCode(vrprocessor, storage, {enclave_hash:enclave_hash, request_hash:request_hash, report:temp_report})
        await unlink(temp_report)
        if(result.success){
            console.log("to write meta file, ", meta_file_dir)
            fs.writeFileSync(path.join(meta_file_dir, request_hash + ".meta"), JSON.stringify(result.result, null, 2));
            console.log("write meta file done")
            parentPort.postMessage(result.result)
        }else{
            throw new Error(result.error)
        }
    })().catch((err)=>{ console.error(err); })//TODO, handle the error
    
});