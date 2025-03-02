# Interactive Verification Report

#### 介绍
用于在典枢上的交互式验证报告，参考[文档](./main.pdf)。


每一个验证报告由一个`request_hash`标识，不同的验证报告类型由生成验证报告的`enclave_hash`标识。
本项目允许开发者制定每种验证报告的数据处理方法(`VRDataProcessor`)以及当前端请求相应的验证报告时如何响应（`VRInteractor`）。

每个`VRDataProcessor`和`VRInteractor`都是一段JavaScript代码，并且动态加载到系统中。

该项目同时用于桌面端（Electron）及服务器端。

#### 安装教程

npm

```base
npm install @yeez-tech/interactive-verification-report --save
```

yarn

```base
yarn add @yeez-tech/interactive-verification-report
```

#### 构建及测试
```base
yarn install
yarn test
```

#### 使用方法

##### 自定义相应服务
首先，需要实现相应的`MetaProvider`，用于指定相应的数据如何获取，参考[这里](./src/MetaProvider.js)。

其次，需要指定相应的`StorageContext`，用于说明存储的上下文，其中包括`db`, `data_dir`以及`cdn`，参考[这里](./src/StorageContext.js)


##### 引用该项目
```
import {init_vrdaemon, process_verfication_report, close_vrdaemon} from "@yeez-tech/interactive-verification-report";

```
##### 初始化`VRDaemon`

```
init_vrdaemon(meta_provider, port, storage_context, meta_data_dir);
```
其中`meta_provider`继承自`MetaProvider`，`port`是网络服务的监听端口，`storage_context`为存储上下文，`meta_data_dir`为元数据存储目录。

初始化完成后，会启动一个http服务器，其中的API为一个get方法，`/api/report/`，该API至少包含一个参数`request_hash`，其余参数由每个enclave自行定义，并在自定义的`VRInteractor`中响应。

初始化过程还会启动与CPU并行度相同的工作线程池，用于执行后续的任务。

##### 关闭`VRDaemon`

```
close_vrdaemon();
```
该方法会关闭相应的http服务及工作线程池。

##### 处理验证报告
```
await process_verfication_report( request_hash, encrypted_report, callback)
```
其中，`request_hash`为验证报告对应的请求hash，`encrypted_report`为加密后的验证报告，`callback`为验证报告处理完成后的回调函数。

##### 自定义`VRDataProcessor`
参考[这里](./test//simple/VRDataProcessor.js)，该js文件最后需要export一个函数，该函数的原型如下（函数名不重要）
```
function (storage_context, enclave_hash, request_hash, report)
```
其中，`report`为明文的报告文件。开发者需要根据自己的需求将报告进行处理，并返回一个可以JSON化的对象，用于在响应请求时“回忆”起相关的上下文，该对象JSON化后存储在`meta_file_dir`中。


##### 自定义`VRInteractor`
参考[这里](./test/simple/VRInteractor.js)，该js文件最后需要export一个函数，该函数的原型如下（函数名不重要）
```
function(meta, storage, params)
```
其中，`meta`为`VRDataProcessor`中的处理结果（一个JSON对象），`storage`是存储上下文，`params`是http请求的参数。

##### 注意
`VRDataProcessor`和`VRInteractor`都同时用于服务端和桌面端，因此其中的`StorageContext`是不同的，需要判断其中的值是否为空，并进行相应的处理。



#### TODO
`VRDataProcessor`和`VRInteractor`动态加载后并没有卸载，这在处理海量不同的验证报告类型时可能会导致内存中加载的代码量过大，因此需要动态卸载。
