// eslint-disable-next-line import/no-webpack-loader-syntax
import Worker from 'worker-loader!./worker.js'; // 启动 Web Worker

/**
 * 获取组件名称
 * @param {ReactComponent} component
 */
export function getComponentDisplayName(component) {
  return component.displayName || component.name || 'Component';
}

/**
 * 文件切分分片
 * @param {File} file 文件
 */
export function splitFileToChunks(file, perChunkSize) {
  const fileSize = file.size;
  const total = Math.ceil(fileSize / perChunkSize); // 计算总共要分多少片
  const chunksArr = [];
  for (let i = 1; i <= total; i++) {
    chunksArr.push(file.slice((i - 1) * perChunkSize, i * perChunkSize));
  }

  return chunksArr;
}

/**
 * 利用WebWorker计算文件内容的Hash
 * @param {File} file 文件
 */
export async function calFileContentHash(chunksArr) {
  const worker = new Worker();
  worker.postMessage({ chunksArr }); // 传递文件分片
  /* 接受计算好的hash */
  return new Promise(resolve => {
    worker.onmessage = event => {
      resolve(event.data.hash);
    };
  });
}
/**
 * 把字节数转化成更友好的显示（单位转化）
 * @param {String} bytes 字节数
 * @param {Number} precise 小数精度
 */
export function bytesToSize(bytes, precise = 1) {
  if (bytes === 0) return '0 B';
  let k = 1024,
    sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(precise) + ' ' + sizes[i];
}
/**
 * 生成guid
 */
export function guid() {
  function S4() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  }
  return `${S4()}${S4()}-${S4()}-${S4()}-${S4()}-${S4()}${S4()}${S4()}`;
}
