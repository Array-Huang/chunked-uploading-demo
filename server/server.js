// 0.导入需要的资源包
const Koa = require('koa');
const path = require('path');
const app = new Koa();
const fs = require('fs');
const shell = require('shelljs');
const { UPLOADED_CHUNKS_DIR, MERGED_FILES_DIR, DATABASE_FILE } = require('./config.js');

/* 初始化 */
if (fs.existsSync(DATABASE_FILE)) {
  fs.unlinkSync(DATABASE_FILE); // 重置本地文件数据库
}
if (fs.existsSync(UPLOADED_CHUNKS_DIR)) {
  shell.rm('-rf', UPLOADED_CHUNKS_DIR);
}
if (fs.existsSync(MERGED_FILES_DIR)) {
  shell.rm('-rf', MERGED_FILES_DIR);
}
fs.mkdirSync(UPLOADED_CHUNKS_DIR);
fs.mkdirSync(MERGED_FILES_DIR);

const koaStatic = require('koa-static');
app.use(koaStatic(path.join(__dirname, '../')));
const koaBody = require('koa-body')({
  multipart: true, // 支持文件上传
  formidable: {
    uploadDir: UPLOADED_CHUNKS_DIR, // 设置文件上传目录
    keepExtensions: true, // 保持文件的后缀
    maxFieldsSize: 2 * 1024 * 1024 // 文件上传大小
  }
});
app.use(koaBody);

const router = require('./router.js');
app.use(router.routes()); /*启动路由*/
app.use(router.allowedMethods());
app.listen(80);
