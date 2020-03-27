const db = require('./db.js');
const router = require('koa-router')();
const util = require('util');
const path = require('path');
const fs = require('fs');
const { finished } = require('stream');
const streamFinished = util.promisify(finished);
const { MERGED_FILES_DIR, PUBLIC_MERGED_FILES_DIR } = require('./config.js');

router
  /* 获取文件信息 */
  .get('/getFileInfo', async ctx => {
    const { fileHash, fileName, chunksLength } = ctx.query;
    /* 如果是没有上传过的文件，则需要初始化文件信息 */
    if (!db.isFileExisted(fileHash)) {
      db.initFileInfo(fileHash, fileName, parseInt(chunksLength));
    }

    ctx.response.body = db.getFileInfo(fileHash);
  })
  /* 给文件分片加锁 */
  .post('/lockChunk', async ctx => {
    const { fileHash, chunkIndex } = ctx.request.body;
    const { status } = db.getChunkInfo(fileHash, chunkIndex); // 获取分片信息
    if (status !== 'wait') {
      /* 文件分片加锁失败 */
      ctx.response.body = false;
    } else {
      db.updateChunk(fileHash, chunkIndex, { status: 'uploading' }); // 加锁，具体操作就是把状态设置为'uploading'
      ctx.response.body = true;
    }
  })
  /* 上传文件分片 */
  .post('/uploadChunk', async ctx => {
    const tempPath = ctx.request.files.chunk.path; // body-parser 会把上传好的文件放到指定的临时目录里
    const { fileContentHash, chunkIndex } = ctx.request.body;

    /**
     * 合并文件
     *
     * @param {String} fileContentHash 文件hash
     */
    async function mergeFile(fileContentHash) {
      const mergedFilePath = path.join(MERGED_FILES_DIR, fileInfo.fileName);

      const writeStream = fs.createWriteStream(mergedFilePath); // 新建文件可写流
      /* 按顺序逐个创建文件分片的可读流，通过管道传递给文件的可写流 */
      let index = 0;
      while (index < fileInfo.chunksLength) {
        const readStream = fs.createReadStream(fileInfo.chunks[index].tempPath);
        readStream.pipe(writeStream, { end: false }); // end为false 表示当前可读流传输完毕后，不会自动关闭可写流
        await streamFinished(readStream); // 这是经过 promise 化的stream.finished；实现串行的可读流/可写流管道
        index++;
      }

      writeStream.end(); // 手动关闭可写流
      /* 更新文件信息，包括状态、文件物理路径、文件的URL */
      db.setFileFinish(fileContentHash, mergedFilePath, path.join(PUBLIC_MERGED_FILES_DIR, fileInfo.fileName));
    }

    db.updateChunk(fileContentHash, chunkIndex, { status: 'finish', tempPath }); // 修改分片的上传状态为'finish'
    /* 检查当前文件，是否所有文件分片都上传完成，是的话则启动合并文件 */
    const fileInfo = db.getFileInfo(fileContentHash);
    if (fileInfo.chunks.every(chunk => chunk.status === 'finish')) {
      await mergeFile(fileContentHash); // 合并文件分片
    }

    ctx.response.body = true;
  });

module.exports = router;
