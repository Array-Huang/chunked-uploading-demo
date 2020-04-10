import { lockChunk, uploadChunk } from './api';

export default class UploadQueue {
  uploadQueue = []; // 上传任务队列存储
  isUploading = false; // 是否正在上传
  tasksSizePerFile = {}; // 记录每个文件还剩下多少上传任务，作为判断文件是否完成上传的依据
  fileFinishCb = () => {}; // 文件完成上传的回调函数

  constructor({ fileFinishCb }) {
    if (!!fileFinishCb && typeof fileFinishCb === 'function') {
      this.fileFinishCb = fileFinishCb;
    }
  }

  /**
   * 建立上传队列，规则：
   * 找出服务端记录里当前该文件所有状态为'wait'的文件分片
   * @param {Object} fileInfo 文件上传情况
   * @param {Array} chunksArr 分片数组
   */
  addChunksToQueue(fileInfo, chunksArr) {
    const newTasks = fileInfo.chunks
      .filter(chunk => chunk.status === 'wait')
      .map((_, index) => ({
        hash: fileInfo.hash,
        index,
        chunk: chunksArr[index],
      }));
    /* 添加上传任务到队列中 */
    if (newTasks.length > 0) {
      this.uploadQueue = [...this.uploadQueue, ...newTasks];
      this.tasksSizePerFile[newTasks[0].hash] = newTasks.length; // 记录当前文件有多少个上传任务
    }
  }
  /**
   * 触发上传
   */
  run() {
    if (!this.isUploading) {
      this.isUploading = true;
      this.uploadNext(); // 开始上传
    }
  }

  /**
   * 上传下一个分片
   */
  async uploadNext() {
    /*
    上传完毕，轮询文件上传情况：
    1. 当前文件还有其它客户端正在上传某些分片
    2. 当前文件的所有分片都已经上传完毕，但服务端正在合并
    3. 服务端合并完成
  */
    if (this.uploadQueue.length === 0) {
      this.isUploading = false;
      return;
    }
    const {
      index: chunkIndex,
      chunk,
      hash: fileHash,
    } = this.uploadQueue.shift(); // 从上传队列里取出一个上传任务

    /* 给分片加锁，避免多个客户端上传同一个分片 */
    const lockResult = await lockChunk(fileHash, chunkIndex);
    if (lockResult) {
      await uploadChunk(fileHash, chunkIndex, chunk);
      /* 判断该文件的所有分片是否都上传完 */
      if (--this.tasksSizePerFile[fileHash] === 0) {
        this.fileFinishCb(fileHash);
      }
      this.uploadNext();
    } else {
      // 加锁失败，表示已有另一个客户端上传此分片，因此丢弃当前上传任务
      this.uploadNext();
    }
  }
}
