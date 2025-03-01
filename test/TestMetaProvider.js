import MetaProvider from "../src/MetaProvider";
import {key_pair} from "./helper";
import { readFile, readFileSync } from 'node:fs';

class TestMetaProvider extends MetaProvider{
    constructor(processor_code_file, interactor_code_file){
        super()
        this.processor_code = readFileSync(processor_code_file, "utf-8");
        this.interactor_code = readFileSync(interactor_code_file, "utf-8");
        this.enclave_hash = "abcd"
    }
    async getDataProcessorCode(enclave_hash){
        return this.processor_code;
    }

    async getInteractorCode(enclave_hash){
        return this.interactor_code;
    }
    async getShuPrivateKey(){
        return key_pair.private_key;
    }
    async getEnclaveHash(request_hash){
        return this.enclave_hash;
    }
}

export default TestMetaProvider