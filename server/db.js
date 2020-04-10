const path = require('path');
const { JsonDB } = require('node-json-db');
const { Config } = require('node-json-db/dist/lib/JsonDBConfig');
var db = new JsonDB(
  new Config(path.join(__dirname, 'database'), true, false, '/')
);

function buildFileKey(hash) {
  return `/${hash}`;
}

function buildChunkKey(hash, index) {
  return `/${hash}/chunks/${index}`;
}

module.exports = {
  /* 初始化文件信息 */
  initFileInfo: ({ fileHash: hash, fileName, chunksLength, size, sizeStr }) => {
    const data = {
      hash,
      fileName,
      size,
      sizeStr,
      status: 'uploading',
      path: '',
      publicPath: '',
      chunksLength,
      chunks: new Array(chunksLength).fill({
        status: 'wait',
        tempPath: '',
      }),
    };

    db.push(buildFileKey(hash), data);
  },
  setFileFinish(hash, path, publicPath) {
    db.push(`/${hash}/status`, 'finish');
    db.push(`/${hash}/path`, path);
    db.push(`/${hash}/publicPath`, publicPath);
  },
  getFileInfo: hash => {
    return db.getData(buildFileKey(hash));
  },
  getChunkInfo: (hash, index) => {
    return db.getData(buildChunkKey(hash, index));
  },
  isFileExisted: hash => {
    return db.exists(buildFileKey(hash));
  },
  isChunkExisted: (hash, index) => {
    return db.exists(buildChunkKey(hash, index));
  },
  updateChunk: (hash, index, { status, tempPath = '' }) => {
    const key = buildChunkKey(hash, index);
    db.push(key, { status, tempPath });
  },
};
