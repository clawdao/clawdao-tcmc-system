import React, { useEffect, useState } from 'react';
import { Card, message, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import CaseForm from '../components/CaseForm';

export default function CaseEdit() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [initial, setInitial] = useState(null);
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isEdit) {
      client.get(`/cases/${id}`).then((r) => {
        setInitial(r.data);
        setItems(r.data.items || []);
      }).catch((e) => message.error(e.message));
    } else {
      setInitial({});
    }
  }, [id]);

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

  if (!initial) return <div className="flex justify-center py-20"><Spin size="large" /></div>;

  return (
    <Card title={isEdit ? `编辑医案 ${initial.case_no || ''}` : '新建医案'}>
      <CaseForm initialValues={initial} initialItems={items} onSubmit={handleSubmit} submitting={submitting} />
    </Card>
  );
}
