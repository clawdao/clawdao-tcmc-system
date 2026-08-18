import React, { useEffect, useState } from 'react';
import { Card, Tabs, Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, CloudUploadOutlined, DownloadOutlined, RollbackOutlined } from '@ant-design/icons';
import client, { downloadFile } from '../api/client';

const ROLE_LABEL = { admin: '管理员', doctor: '医师', readonly: '只读' };
const ACTION_LABEL = { create: '新增', update: '修改', delete: '删除', export: '导出', backup: '备份', restore: '恢复', login: '登录', import: '导入' };

function UsersTab() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = () => client.get('/users').then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await client.put(`/users/${editing.id}`, values);
        message.success('用户已更新');
      } else {
        await client.post('/users', values);
        message.success('用户已创建');
      }
      setOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e.message);
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'real_name', render: (v) => v || '—' },
    {
      title: '角色', dataIndex: 'role',
      render: (v) => <Tag color={{ admin: 'red', doctor: 'green', readonly: 'default' }[v]}>{ROLE_LABEL[v]}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at' },
    {
      title: '操作', width: 140,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => { setEditing(record); form.setFieldsValue({ real_name: record.real_name, role: record.role }); setOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除该用户？" onConfirm={async () => { try { await client.delete(`/users/${record.id}`); load(); } catch (e) { message.error(e.message); } }}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>新增用户</Button>
      </div>
      <Table rowKey="id" size="middle" columns={columns} dataSource={list} pagination={false} />
      <Modal title={editing ? `编辑用户 ${editing.username}` : '新增用户'} open={open} onOk={handleSave} onCancel={() => { setOpen(false); setEditing(null); }} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          {!editing && (
            <Form.Item name="username" label="用户名" rules={[{ required: true, min: 2, message: '至少 2 个字符' }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="real_name" label="姓名">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="doctor" rules={[{ required: true }]}>
            <Select options={[{ value: 'admin', label: '管理员' }, { value: 'doctor', label: '医师' }, { value: 'readonly', label: '只读' }]} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? '重置密码（留空则不修改）' : '密码'}
            rules={editing ? [] : [{ required: true, min: 6, message: '至少 6 位' }]}
          >
            <Input.Password placeholder={editing ? '留空则不修改' : ''} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function BackupTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = () => client.get('/backup/list').then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const createBackup = async () => {
    setLoading(true);
    try {
      const res = await client.post('/backup');
      message.success(`备份完成：${res.data.name}`);
      load();
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: '备份文件', dataIndex: 'name' },
    { title: '大小', dataIndex: 'size', width: 110, render: (v) => `${(v / 1024).toFixed(1)} KB` },
    { title: '创建时间', dataIndex: 'createdAt', width: 200, render: (v) => new Date(v).toLocaleString('zh-CN') },
    {
      title: '操作', width: 170,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => downloadFile(`/backup/download/${record.name}`, record.name)}>下载</Button>
          <Popconfirm
            title="恢复备份将覆盖当前全部数据"
            description="恢复前系统会自动为当前状态做快照。确认恢复？"
            onConfirm={async () => {
              try {
                await client.post('/backup/restore', { name: record.name });
                message.success('恢复完成');
                load();
              } catch (e) {
                message.error(e.message);
              }
            }}
            okText="确认恢复"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<RollbackOutlined />}>恢复</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-between items-center">
        <span className="text-gray-500 text-sm">系统每日 02:00 自动备份，保留最近 30 份</span>
        <Button type="primary" icon={<CloudUploadOutlined />} loading={loading} onClick={createBackup}>立即备份</Button>
      </div>
      <Table rowKey="name" size="middle" columns={columns} dataSource={list} pagination={{ pageSize: 10 }} />
    </>
  );
}

function LogsTab() {
  const [data, setData] = useState({ list: [], total: 0 });
  const [page, setPage] = useState(1);

  const load = (p = 1) => client.get('/logs', { params: { page: p, pageSize: 20 } }).then((r) => setData(r.data));
  useEffect(() => { load(page); }, [page]);

  const columns = [
    { title: '时间', dataIndex: 'created_at', width: 180 },
    { title: '用户', dataIndex: 'username', width: 110, render: (v) => v || '系统' },
    { title: '操作', dataIndex: 'action', width: 90, render: (v) => <Tag>{ACTION_LABEL[v] || v}</Tag> },
    { title: '对象', dataIndex: 'target_type', width: 130, render: (v, r) => (v ? `${v}${r.target_id ? ' #' + r.target_id : ''}` : '—') },
    { title: '详情', dataIndex: 'detail', ellipsis: true, render: (v) => v || '—' },
  ];

  return (
    <Table
      rowKey="id"
      size="middle"
      columns={columns}
      dataSource={data.list}
      pagination={{ current: page, pageSize: 20, total: data.total, onChange: setPage, showTotal: (t) => `共 ${t} 条` }}
    />
  );
}

export default function System() {
  return (
    <Card title="系统管理">
      <Tabs
        items={[
          { key: 'backup', label: '数据备份', children: <BackupTab /> },
          { key: 'users', label: '用户管理', children: <UsersTab /> },
          { key: 'logs', label: '操作日志', children: <LogsTab /> },
        ]}
      />
    </Card>
  );
}
