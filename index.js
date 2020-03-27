const fileElement = document.getElementById('file'); // 上传框的DOM元素
const PER_CHUNK_SIZE = 1024 * 512; // 每个分片的大小为512k
let chunksArr = [];
/**
 * 利用WebWorker计算文件内容的Hash
 * @param {File} file 文件
 */
function calFileContentHash(chunksArr) {
  const worker = new Worker('./worker.js'); // 启动 Web Worker
  worker.postMessage({ chunksArr }); // 传递文件分片
  /* 接受计算好的hash */
  return new Promise(resolve => {
    worker.onmessage = event => {
      resolve(event.data.hash);
    };
  });
}
/**
 * 文件分片
 * @param {File} file 文件
 */
function splitFileToChunks(file) {
  const fileSize = file.size;
  const total = Math.ceil(fileSize / PER_CHUNK_SIZE); // 计算总共要分多少片
  const chunksArr = [];
  for (let i = 1; i <= total; i++) {
    chunksArr.push(file.slice((i - 1) * PER_CHUNK_SIZE, i * PER_CHUNK_SIZE));
  }

  return chunksArr;
}

/**
 * 查询文件上传情况
 * @param {String} fileHash 文件内容Hash
 * @param {String} fileName 文件名
 * @param {Number} chunksLength 分片数量
 */
async function queryFileInfo(fileHash, fileName, chunksLength) {
  return axios
    .get('/getFileInfo', {
      params: {
        fileHash,
        fileName,
        chunksLength
      }
    })
    .then(({ data }) => {
      return data;
    });
}

/**
 * 建立上传队列，规则：
 * 找出服务端记录里当前该文件所有状态为'wait'的文件分片
 * @param {Object} fileInfo 文件上传情况
 * @param {Array} chunksArr 分片数组
 */
function buildUploadQueue(fileInfo, chunksArr) {
  return chunksArr
    .map((chunk, index) => {
      return fileInfo.chunks[index].status === 'wait'
        ? {
            hash: fileInfo.hash,
            index,
            chunk
          }
        : false;
    })
    .filter(item => !!item);
}

/**
 * 上传文件分片
 * @param {String} fileContentHash 文件的Hash
 * @param {Number} chunkIndex 分片序号
 * @param {Blob} chunk 文件分片
 */
function uploadChunk(fileContentHash, chunkIndex, chunk) {
  const formData = new FormData();
  formData.append('fileContentHash', fileContentHash);
  formData.append('chunkIndex', chunkIndex);
  formData.append('chunk', chunk);
  return axios.post('/uploadChunk', formData).then(({ data: result }) => {
    return result;
  });
}
/**
 * 展示已上传的文件：构造一个<a>标签
 * @param {Object} fileInfo 文件信息
 */
function showUploadedFile(fileInfo) {
  const el = document.createElement('a');
  el.href = fileInfo.publicPath;
  el.textContent = fileInfo.fileName;
  el.download = fileInfo.fileName;
  document.getElementById('uploaded-file').append(el);
}
/**
 * 设立一个定时器，定时查询文件是否上传完成（因为后端需要把所有分片合并起来，因此需要一定的时间）
 * @param {String} fileHash 文件Hash
 */
function setTimerCheckFile(fileHash) {
  const intervalID = setInterval(async () => {
    const fileInfo = await queryFileInfo(fileHash);
    if (fileInfo.status === 'finish') {
      showUploadedFile(fileInfo);
      clearInterval(intervalID);
    }
  }, 500);
}

/**
 * 上传下一个分片
 * @param {Array} uploadQueue 上传队列
 */
function uploadNext(uploadQueue, fileHash) {
  /*
    上传完毕，轮询文件上传情况：
    1. 当前文件还有其它客户端正在上传某些分片
    2. 当前文件的所有分片都已经上传完毕，但服务端正在合并
    3. 服务端合并完成
  */
  if (uploadQueue.length === 0) {
    setTimerCheckFile(fileHash);
    return;
  }
  const { index: chunkIndex, chunk } = uploadQueue.shift(); // 从上传队列里取出一个上传任务

  axios
    .post('/lockChunk', {
      fileHash,
      chunkIndex
    })
    .then(async ({ data: result }) => {
      if (result) {
        const uploadResult = await uploadChunk(fileHash, chunkIndex, chunk); // 给分片加锁，避免多个客户端上传同一个分片
        if (uploadResult) {
          uploadNext(uploadQueue, fileHash);
        } else {
          alert('上传出错！');
        }
      } else { // 加锁失败，表示已有另一个客户端上传此分片，因此丢弃当前上传任务
        uploadNext(uploadQueue, fileHash);
      }
    });
}

/* 
  注意！这是上传功能的入口！！
  监听上传框的 change 事件，拿到用户选择的文件 
*/
fileElement.addEventListener('change', async () => {
  const file = fileElement.files[0];
  chunksArr = splitFileToChunks(file); // 文件分片
  const fileContentHash = await calFileContentHash(chunksArr); // 计算文件内容的hash
  /* 查询该文件上传情况 */
  const fileInfo = await queryFileInfo(fileContentHash, file.name, chunksArr.length);
  /* 秒传 */
  if (fileInfo.status === 'finish') {
    showUploadedFile(fileInfo);
    return;
  }

  const uploadQueue = buildUploadQueue(fileInfo, chunksArr); // 建立上传队列
  uploadNext(uploadQueue, fileContentHash); // 开始上传
});
