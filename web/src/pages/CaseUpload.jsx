import React, { useState } from 'react';
import { Card, Upload, Button, message, Alert, Image, Row, Col, Tag } from 'antd';
import { InboxOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import CaseForm from '../components/CaseForm';

export default function CaseUpload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null); // { imageId, imagePath, ocrText, ocrStatus, draft }
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const doUpload = async (file) => {
    setUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await client.post('/cases/upload-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      if (res.data.ocrStatus === '识别失败') {
        message.warning('OCR 识别失败，请手工校对录入');
      } else {
        message.success('识别完成，请校对后提交');
      }
    } catch (e) {
      message.error(e.message);
    } finally {
      setUploading(false);
    }
    return false; // 阻止 antd 默认上传
  };

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      payload.source = '拍照上传';
      const res = await client.post('/cases', payload);
      message.success('医案已创建');
      navigate(`/cases/${res.data.id}`);
    } catch (e) {
      message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Card title="拍照识别建案" className="mb-4">
        <Upload.Dragger
          accept="image/jpeg,image/png,image/webp"
          showUploadList={false}
          beforeUpload={doUpload}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽纸质医案照片到此处上传</p>
          <p className="ant-upload-hint">支持 jpg / png / webp，不超过 10MB；上传后自动 OCR 识别并预填表单</p>
          <Button type="primary" icon={<ThunderboltOutlined />} loading={uploading} className="mt-3">
            {uploading ? '识别中…' : '选择图片识别'}
          </Button>
        </Upload.Dragger>
      </Card>

      {result && (
        <>
          <Alert
            className="mb-4"
            type={result.ocrStatus === '识别失败' ? 'warning' : 'success'}
            showIcon
            message={
              result.ocrStatus === '识别失败'
                ? 'OCR 识别失败，已为您保留图片附件，请手工录入'
                : '识别完成。请务必逐项校对识别结果后再提交，识别有误之处请直接修改。'
            }
          />
          <Row gutter={16}>
            <Col xs={24} lg={9}>
              <Card title="原始图片" size="small" className="mb-4">
                <Image src={`/uploads/${result.imagePath}`} className="w-full" alt="医案原图" />
              </Card>
              <Card
                title="OCR 识别原文"
                size="small"
                extra={<Tag color={result.ocrStatus === '识别失败' ? 'red' : 'green'}>{result.ocrStatus}</Tag>}
              >
                <pre className="whitespace-pre-wrap text-sm text-gray-600" style={{ maxHeight: 320, overflow: 'auto' }}>
                  {result.ocrText || '（无识别文本）'}
                </pre>
              </Card>
            </Col>
            <Col xs={24} lg={15}>
              <Card title="校对医案信息" size="small">
                <CaseForm
                  initialValues={result.draft || {}}
                  initialItems={result.draft?.items || []}
                  imageIds={[result.imageId]}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
