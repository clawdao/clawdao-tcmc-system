import React, { useEffect, useState } from 'react';
import { Card, message, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import CaseForm from '../components/CaseForm';

export default function CaseEdit() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  // 单个 state 同时承载 initialValues 和 items，避免两次 setState 的渲染空窗期
  const [data, setData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isEdit) {
      setData({ initialValues: {}, items: [] });
      return;
    }
    let cancelled = false;
    setData(null);
    client.get(`/cases/${id}`).then((r) => {
      // r 已经是后端响应体的 data 字段（即 row 对象）；axios 拦截器已剥外层
      const row = r && r.data !== undefined ? r.data : r;
      if (cancelled) return;
      setData({ initialValues: row || {}, items: row?.items || [] });
    }).catch((e) => {
      if (cancelled) return;
      message.error(e.message || '医案加载失败');
    });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      const res = isEdit
        ? await client.put(`/cases/${id}`, payload)
        : await client.post('/cases', payload);
      message.success(isEdit ? '医案已更新' : '医案已创建');
      navigate(`/cases/${res.data.id}`);
    } catch (e) {
      message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!data) return <div className="flex justify-center py-20"><Spin size="large" /></div>;

  const title = isEdit ? `编辑医案 ${data.initialValues.case_no || ''}` : '新建医案';

  return (
    <Card title={title}>
      <CaseForm
        initialValues={data.initialValues}
        initialItems={data.items}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </Card>
  );
}
