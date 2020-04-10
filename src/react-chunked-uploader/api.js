import axios from 'axios';

/**
 * 查询文件上传情况
 * @param {String} fileHash 文件内容Hash
 * @param {String} fileName 文件名
 * @param {Number} chunksLength 分片数量
 */
export function queryFileInfo({
  fileHash,
  fileName,
  size,
  sizeStr,
  chunksLength,
}) {
  return axios
    .get('/getFileInfo', {
      params: {
        fileHash,
        fileName,
        size,
        sizeStr,
        chunksLength,
      },
    })
    .then(({ data }) => {
      return data;
    });
}

/**
 * 上传文件分片
 * @param {String} fileContentHash 文件的Hash
 * @param {Number} chunkIndex 分片序号
 * @param {Blob} chunk 文件分片
 */
export function uploadChunk(fileContentHash, chunkIndex, chunk) {
  const formData = new FormData();
  formData.append('fileContentHash', fileContentHash);
  formData.append('chunkIndex', chunkIndex);
  formData.append('chunk', chunk);
  return axios.post('/uploadChunk', formData).then(({ data: result }) => {
    return result;
  });
}

export function lockChunk(fileHash, chunkIndex) {
  return axios
    .post('/lockChunk', {
      fileHash,
      chunkIndex,
    })
    .then(async ({ data: result }) => result);
}
