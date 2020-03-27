self.importScripts("/public/spark-md5.min.js"); // 导入第三方库 —— spark-md5

self.addEventListener(
  "message",
  e => {
    const { chunksArr } = e.data; // 收到主线程传递来的文件分片
    const spark = new self.SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(chunksArr.pop());
    fileReader.onload = e => {
      spark.append(e.target.result);
      if (chunksArr.length === 0) {
        self.postMessage({
          hash: spark.end()
        });
      } else {
        fileReader.readAsArrayBuffer(chunksArr.pop());
      }
    };
  },
  false
);
