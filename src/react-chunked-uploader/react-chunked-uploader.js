/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  getComponentDisplayName,
  splitFileToChunks,
  calFileContentHash,
  bytesToSize,
  guid,
} from './lib';
import { queryFileInfo } from './api';
import UploadQueue from './upload-queue.class';

import './style.css';

/**
 * 初始化组件
 * @param {ReactComponent} component 本高阶组件
 * @param {ReactComponent} WrappedComponent 被包装的具体实现组件
 */
function useComponentInit(component, WrappedComponent) {
  const intervalIDArr = [];
  const [filesList, setFilesList] = useState([]); // 定义管理上传的列表
  /* 定义上传队列，初始化就创建一个UploadQueue类实例 */
  const [uploadQueue] = useState(
    new UploadQueue({
      /* 设立一个定时器，定时（根据hash）查询文件是否上传完成（因为后端需要把所有分片合并起来，因此需要一定的时间） */
      fileFinishCb: fileHash => {
        /* 查询文件是否上传完成；是的话则更新状态，渲染上传结果 */
        async function checkIfFinish() {
          const remoteFileInfo = await queryFileInfo({ fileHash });
          if (remoteFileInfo.status === 'finish') {
            updateFileInfo.call({ filesList, setFilesList }, fileHash, {
              status: remoteFileInfo.status,
              url: remoteFileInfo.publicPath,
            });
            return true;
          }
          return false;
        }
        /* 
          第一次定时器会很快触发，这是针对小文件，争取尽快渲染上传结果
          之后的定时器则是针对较大的文件，以较大的时间间隔来触发查询
        */
        setTimeout(async () => {
          if ((await checkIfFinish()) === false) {
            const intervalID = setInterval(async () => {
              if ((await checkIfFinish()) === true) {
                clearInterval(intervalID);
                intervalIDArr.splice(intervalIDArr.indexOf(intervalIDArr), 1);
              }
            }, 5000);
            intervalIDArr.push(intervalID);
          }
        }, 500);
      },
    })
  );

  useEffect(() => {
    /* 定义displayName是为了在浏览器开发者工具里更好地显示高阶组件名称 */
    component.displayName = `withUploader(${getComponentDisplayName(
      WrappedComponent
    )})`;
    component.defaultProps = {
      perChunkSize: 1024 * 512,
      errorCb: () => {},
      finishCb: () => {},
    };
    component.propTypes = {
      perChunkSize: PropTypes.number,
      errorCb: PropTypes.func,
      finishCb: PropTypes.func,
    };
  }, [component, WrappedComponent]);

  /* 清理所有定时器 */
  useEffect(
    () => () => {
      intervalIDArr.forEach(intervalID => clearInterval(intervalID));
    },
    [intervalIDArr]
  );

  return { filesList, setFilesList, uploadQueue };
}
/**
 * 根据用户选择上传的文件来初始化文件信息，并添加到state里
 * @param {File} file 用户选择上传的文件
 */
function initFilesListState(file) {
  const fileInfo = {
    hash: guid(), // 用uuid来假装hash
    fileName: file.name,
    status: 'init',
    publicPath: '',
    size: file.size,
    sizeStr: bytesToSize(file.size),
  };
  this.setFilesList([...this.filesList, fileInfo]);
  return fileInfo;
}
/**
 * 根据文件hash查询当前组件管理的文件列表里是否已存在目标文件
 * @param {String} hash 文件hash
 */
function checkDuplicateByHash(hash) {
  return this.filesList.some(file => file.hash === hash);
}
/**
 * 根据文件hash，从当前组件管理的文件列表中删除目标文件信息
 * @param {Object} currentFileInfo 用户当前选择上传的文件的信息
 */
function removeFile(currentFileInfo) {
  this.setFilesList(filesList =>
    filesList.filter(file => currentFileInfo.hash !== file.hash)
  );
}
/**
 * 更新state中的文件信息
 * @param {String} hash 文件hash
 * @param {Object} newFileAttrs 需要更新的文件信息字段；不需要更新的字段就不需要传进来
 */
function updateFileInfo(hash, newFileAttrs) {
  this.setFilesList(filesList =>
    filesList.map(file =>
      file.hash === hash ? { ...file, ...newFileAttrs } : file
    )
  );
}
/**
 * <input type="file">的change事件回调函数
 * @param {Number} perChunkSize 每个分片的大小
 * @param {Function} errorCb 错误异常的处理函数
 */
function returnFileInputChangeCb({ perChunkSize, errorCb }) {
  return async event => {
    const file = event.target.files[0];
    const currentFileInfo = initFilesListState.call(this, file);
    const chunksArr = splitFileToChunks(file, perChunkSize); // 文件分片
    const fileContentHash = await calFileContentHash(chunksArr); // 计算文件内容的hash
    if (checkDuplicateByHash.call(this, fileContentHash)) {
      removeFile.call(this, currentFileInfo);
      errorCb({ errorCode: 1, message: 'duplicate file found by hash' });
    }
    updateFileInfo.call(this, currentFileInfo.hash, { hash: fileContentHash });
    /* 查询该文件上传情况 */
    const remoteFileInfo = await queryFileInfo({
      ...currentFileInfo,
      fileHash: fileContentHash,
      chunksLength: chunksArr.length,
    });
    updateFileInfo.call(this, fileContentHash, {
      status: remoteFileInfo.status,
      url: remoteFileInfo.publicPath,
      chunks: remoteFileInfo.chunks,
      chunksLength: remoteFileInfo.chunksLength,
    });
    /* 秒传 */
    if (remoteFileInfo.status === 'finish') {
      return;
    }

    this.uploadQueue.addChunksToQueue(remoteFileInfo, chunksArr); // 建立上传队列
    this.uploadQueue.run(); // 触发上传
  };
}
/**
 * 高阶组件的主函数
 * @param {ReactComponent} WrappedComponent 被封装的具体实现的组件
 */
export default function withUploader(WrappedComponent) {
  return function UploaderHoc(props) {
    const { perChunkSize, errorCb, ...restProps } = props;
    const fileInputRef = useRef(null);

    const state = useComponentInit(UploaderHoc, WrappedComponent);
    /* 组装传给具体实现组件的props */
    const spreadProps = {
      ...restProps, // 透传
      triggerFile: () => fileInputRef.current.click(),
      filesList: state.filesList,
    };

    return (
      <div className="upload-hoc">
        <input
          ref={fileInputRef}
          type="file"
          className="upload-hoc_file-input"
          onChange={returnFileInputChangeCb.call(state, {
            perChunkSize,
            errorCb,
          })}
        />
        <WrappedComponent {...spreadProps} />
      </div>
    );
  };
}
