//const { NTObjectStream } = require("../../src/NTObjectStream");

//const { enclave_hash, request_hash, report } = global;
const fs = require("fs")
const schema= {}

console.log("Data processor is loaded")
function process_report(storage_context, enclave_hash, request_hash, report){
//    ntstream = new NTObjectStream(report, schema)
    console.log("report is ", report)
    const data = fs.readFileSync(report, "utf-8")
    const meta={enclave_hash, enclave_hash, data: data}
    return meta
}

module.exports = process_report