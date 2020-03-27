const path = require('path');

module.exports = {
  MERGED_FILES_DIR: path.join(__dirname, '../merged_files'),
  PUBLIC_MERGED_FILES_DIR: '/merged_files',
  UPLOADED_CHUNKS_DIR: path.join(__dirname, './uploaded_chunks'),
  DATABASE_FILE: path.join(__dirname, './database.json'),
};
