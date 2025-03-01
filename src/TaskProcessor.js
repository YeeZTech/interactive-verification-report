const { parentPort } = require('node:worker_threads');
const { writeFile, unlink } =require( 'fs/promises');
const { pathToFileURL } =require( 'url');
const { randomUUID } =require( 'crypto');
const fs = require("fs")
const path = require('node:path');
const {Unsealer, SealedFileStream} =require("@yeez-tech/meta-encryptor");
var log = require("loglevel").getLogger("interactive-verification-report/TaskProcessor");


async function executeMixedCode(code, storage_config, params = {}) {
    const filename = `./temp-${randomUUID()}.mjs`; // 生成临时文件

    let db_import;
    let db_create_stmt;
    let db_close_stmt;
    if(storage_config.db.name === "sqlite3"){
        db_import = "const sqlite3 = require('sqlite3')"
        db_create_stmt = "let db = new sqlite3.Database('" + storage_config.db.filename + "', (err)=>{})" //TODO: handle err
        db_close_stmt = "db.close((err)=>{})"
    }else if(storage_config.db.name === "mysql"){
        db_import = "const mysql = require('mysql2'); "
        db_create_stmt = `const db = mysql.createPool({
        host: '${storage_config.db.host}',
        user: '${storage_config.db.user}',
        password: '${storage_config.db.password}',
        database: '${storage_config.db.database}'});
        ` 
        db_close_stmt = "db.end()"
    }
    let cdn_stmt;
    if(storage_config.cdn.name === "tencent"){
        //TODO, initialize tencent cdn
    }else{
        cdn_stmt= "let cdn=undefined;"
    }
    const wrappedCode = `
        import { createRequire } from 'module';
        const require = createRequire(import.meta.url);
        ${db_import}
        try {
            // 将传入的参数挂载到 global 变量上
            for (const [key, value] of Object.entries(${JSON.stringify(params)})) {
                global[key] = value;
            }
            
        } catch (error) {
            console.error("Execution Error:", error);
            throw error;
        }
        class StorageContext{
            constructor(db, cdn, data_dir){
                this.db = db;
                this.cdn = cdn;
                this.data_dir = data_dir;
            }
        }

        ${code}

        function handle_report(enclave_hash, request_hash, report){
            ${db_create_stmt}
            ${cdn_stmt}
            const storage = new StorageContext(db, cdn, '${storage_config.data_dir}')
            const result = process_report(storage, enclave_hash, request_hash, report);
            ${db_close_stmt}
            return result;
        }
        //export default handle_report(enclave_hash, request_hash, report)
        export default process_report(null, enclave_hash, request_hash, report)
    `;

    await writeFile(filename, wrappedCode, 'utf-8');
    
    try {
        const module = await import(pathToFileURL(filename).href);
        return { success: true, result: module.default };
    } catch (error) {
        return { success: false, error: error.message };
    } finally {
        await unlink(filename); // 运行完后删除文件
    }
}

parentPort.on('message', (task) => {
    const storage = task.storage_config
    const private_key = task.private_key
    const vrprocessor = task.vrprocessor
    const enclave_hash = task.enclave_hash
    const local_encrypted_report_url = task.report
    const meta_file_dir = task.meta_file_dir
    const request_hash = task.request_hash

    const temp_report = `./temp-report-${randomUUID()}.data`; // 生成临时文件

    (async()=>{
        let unsealer = new Unsealer({keyPair:{private_key:private_key}});
        let rrs = new SealedFileStream(local_encrypted_report_url);
        let wws = fs.createWriteStream(temp_report)

        rrs.pipe(unsealer).pipe(wws);
        await new Promise(resolve=>{
            wws.on('finish', ()=>resolve());
        })
        const result = await executeMixedCode(vrprocessor, storage, {enclave_hash:enclave_hash, request_hash:request_hash, report:temp_report})
        await unlink(temp_report)
        if(result.success){
            console.log("to write meta file, ", meta_file_dir)
            fs.writeFileSync(path.join(meta_file_dir, request_hash + ".meta"), JSON.stringify(result.result, null, 2));
            console.log("write meta file done")
            parentPort.postMessage(result.result)
        }else{
            throw new Error(result.error)
        }
    })().catch(console.error)//TODO, handle the error
    
});