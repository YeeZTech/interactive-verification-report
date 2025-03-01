 class MetaProvider{
    async getDataProcessorCode(enclave_hash){
        throw new Error(`Invalid MetaProvider for enclave: ${enclave_hash}`);
    }

    async getInteractorCode(enclave_hash){
        throw new Error(`Invalid MetaProvider for enclave: ${enclave_hash}`);
    }
    async getShuPrivateKey(){
        throw new Error(`Invalid MetaProvider`);
    }
    async getEnclaveHash(request_hash){
        throw new Error(`Invalid MetaProvider for request: ${request_hash}`); 
    }
}

class MetaAPIProvider extends MetaProvider{
    async getDataProcessorCode(enclave_hash){
        return "xxx"
    }

    async getInteractorCode(enclave_hash){

    }
    async getShuPrivateKey(){}
}

export default MetaProvider