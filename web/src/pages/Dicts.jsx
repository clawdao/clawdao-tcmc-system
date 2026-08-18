import React, { useEffect, useState } from 'react';
import { Card, Tabs, Table, Button, Input, Space, Modal, Form, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const TYPES = [
  { key: 'disease', label: '疾病' },
  { key: 'herb', label: '中药' },
  { key: 'syndrome', label: '证型' },
  { key: 'formula', label: '方剂' },
];

export default function Dicts() {
  const [type, setType] = useState('disease');
  const [list, setList] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const { isAdmin } = useAuth();

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/dicts', { params: { type, keyword: keyword || undefined } });
      setList(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [type]);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await client.put(`/dicts/${editing.id}`, values);
        message.success('已更新');
      } else {
        await client.post('/dicts', { ...values, dict_type: type });
        message.success('已添加');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e.message);
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name' },
    { title: '别名', dataIndex: 'alias', render: (v) => v || '—' },
    { title: '分类', dataIndex: 'category', render: (v) => (v ? <Tag>{v}</Tag> : '—') },
    ...(isAdmin ? [{
      title: '操作', width: 130,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={async () => { await client.delete(`/dicts/${record.id}`); load(); }}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <Card
      title="数据字典"
      extra={
        <Space>
          <Input
            placeholder="搜索名称/别名"
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 200 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={load}
          />
          <Button onClick={load}>搜索</Button>
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
              新增
            </Button>
          )}
        </Space>
      }
    >
      <Tabs activeKey={type} onChange={setType} items={TYPES.map((t) => ({ key: t.key, label: t.label }))} />
      <Table rowKey="id" size="middle" loading={loading} columns={columns} dataSource={list} pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }} />
      <Modal
        title={editing ? '编辑字典项' : '新增字典项'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="alias" label="别名（多个用逗号分隔）">
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
