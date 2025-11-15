// Example server to demonstrate web loading of a verification report (CommonJS)
// Example server that boots VRDaemon and exposes helper endpoints for listing assets
const path = require('path');
const fs = require('fs');
const express = require('express');

const { init_vrdaemon, close_vrdaemon, get_express_instance, process_verfication_report } = require('../src/VRDaemon.js');

// Local CommonJS MetaProvider to avoid ESM import issues
class LocalMetaProvider {
  constructor(opts) {
    this.processorPath = opts.processorPath;
    this.interactorPath = opts.interactorPath;
    this.enclaveHash = opts.enclaveHash || 'abcd';
    this.privateKey = opts.privateKey; // hex string
  }
  async getDataProcessorCode(enclave_hash) {
    return fs.readFileSync(this.processorPath, 'utf-8');
  }
  async getInteractorCode(enclave_hash) {
    return fs.readFileSync(this.interactorPath, 'utf-8');
  }
  async getShuPrivateKey() {
    return this.privateKey;
  }
  async getEnclaveHash(request_hash) {
    return this.enclaveHash;
  }
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 5050;
const META_DIR = __dirname; // store req_*.meta here

// MetaProvider + StorageContext
const storage_config = {
  db: { name: 'sqlite3', filename: path.join(__dirname, 'example.db') },
  cdn: {},
  data_dir: __dirname,
};

const meta_provider = new LocalMetaProvider({
  processorPath: path.resolve(__dirname, '../test/simple/VRDataProcessor.js'),
  interactorPath: path.resolve(__dirname, './code/abcd_interactor.js'),
  enclaveHash: 'abcd',
  // reuse the demo private key from test/helper.js directly (CJS-safe)
  privateKey: '60d61a1d92b26608016dba8cb8e8e96fd44d5dee0a0415a024657e47febcced8',
});

// 启动 VRDaemon，提供 /api/report
init_vrdaemon(meta_provider, PORT, storage_config, META_DIR);

// 列出可用 request_hash 及其相关文件
const app = get_express_instance();
app.use('/', express.static(__dirname));

app.get('/api/list', async (req, res) => {
  try {
    // request_hash 以 req_*.meta 识别
    const files = fs.readdirSync(META_DIR);
    const items = files
      .filter((f) => f.startsWith('req_') && f.endsWith('.meta'))
      .map((f) => path.basename(f, '.meta'));

    const result = items.map((request_hash) => {
      let meta = {};
      try { meta = JSON.parse(fs.readFileSync(path.join(META_DIR, `${request_hash}.meta`), 'utf8')); } catch (e) {}
      const enclave_hash = meta.enclave_hash || 'abcd';
      const dataFile = path.join(META_DIR, `${request_hash}.data`);
      const processorFile = path.join(storage_config.data_dir, 'code', `${enclave_hash}_data_processor.js`);
      const interactorFile = path.join(storage_config.data_dir, 'code', `${enclave_hash}_interactor.js`);
      return {
        request_hash,
        enclave_hash,
        files: {
          meta: path.join(META_DIR, `${request_hash}.meta`),
          data: fs.existsSync(dataFile) ? dataFile : null,
          dataProcessor: fs.existsSync(processorFile) ? processorFile : null,
          interactor: fs.existsSync(interactorFile) ? interactorFile : null,
        },
      };
    });

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 返回指定 request_hash 的 meta JSON（便于前端按钮演示）
app.get('/api/meta', async (req, res) => {
  try {
    const request_hash = String(req.query.request_hash || '').trim();
    if (!request_hash) return res.status(400).json({ success: false, message: 'request_hash is required' });
    const metaPath = path.join(META_DIR, `${request_hash}.meta`);
    if (!fs.existsSync(metaPath)) return res.status(404).json({ success: false, message: 'meta not found' });
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    res.json({ success: true, meta });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 触发一次报告处理（生成 .meta）
app.post('/api/process', express.json(), async (req, res) => {
  const { request_hash, encrypted_report_path } = req.body || {};
  if (!request_hash || !encrypted_report_path) return res.status(400).json({ success: false, message: 'request_hash and encrypted_report_path are required' });
  try {
    await new Promise((resolve) => process_verfication_report(request_hash, encrypted_report_path, resolve));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

process.on('SIGINT', () => { close_vrdaemon(); process.exit(0); });
process.on('SIGTERM', () => { close_vrdaemon(); process.exit(0); });

console.log(`Example server (VRDaemon) is running at http://localhost:${PORT}`);
console.log(`Open http://localhost:${PORT}/index.html`);
