import React from 'react';
import './App.css';
import { Button, Table, notification } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import withUploader from './react-chunked-uploader/react-chunked-uploader';

/**
 * 上传组件的具体UI实现，利用了react-chunked-uploader高阶组件封装好的业务逻辑
 * @param {Function} triggerFile 触发上传的函数，由高阶组件提供；由于触发上传的按钮由本组件来实现，因此需要手动触发<input type="file">的点击事件
 * @param {Array} filesList 当前组件管理的上传列表，由高阶组件提供，本组件主要根据此参数进行界面渲染
 */
const Uploader = withUploader(({ triggerFile, filesList }) => {
  /* antd表格组件中对列的定义 */
  const columns = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
    },
    {
      title: '大小',
      dataIndex: 'sizeStr',
      key: 'sizeStr',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => {
        const DIST = {
          init: '初始化',
          uploading: '上传中',
          finish: '已完成',
        };

        return <span>{DIST[status]}</span>;
      },
    },
    {
      title: '操作',
      dataIndex: 'operation',
      render: (_, row) => {
        return (
          <>
            {row.status === 'finish' && (
              <a href={row.url} download={row.fileName}>
                下载
              </a>
            )}
          </>
        );
      },
    },
  ];

  return (
    <>
      <div className="btn-container">
        <Button type="primary" icon={<UploadOutlined />} onClick={triggerFile}>
          上传
        </Button>
      </div>

      <Table columns={columns} dataSource={filesList} rowKey="hash" />
    </>
  );
});
/* 上传的错误提示，可根据错误码来定制用户友好的文案 */
function errorCb({ errorCode, message }) {
  notification.open({
    message: '上传异常',
    description: `error code ${errorCode}: ${message}`,
  });
}

function App() {
  return (
    <div className="app">
      <Uploader perChunkSize={1024 * 10} errorCb={errorCb} />
    </div>
  );
}

export default App;
