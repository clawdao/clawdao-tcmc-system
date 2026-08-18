import React, { useEffect, useState } from 'react';
import { Card, Table, Form, Input, Select, DatePicker, Button, Space, Tag, message, AutoComplete } from 'antd';
import { SearchOutlined, ReloadOutlined, PlusOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import client, { downloadFile } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function CaseList() {
  const [form] = Form.useForm();
  const [data, setData] = useState({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dictOptions, setDictOptions] = useState({ disease: [], herb: [], syndrome: [] });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { canWrite } = useAuth();

  const fetchData = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      const params = { page: p, pageSize: ps };
      for (const [k, v] of Object.entries(values)) {
        if (v === undefined || v === null || v === '') continue;
        if (k === 'range' && Array.isArray(v) && v[0]) {
          params.dateFrom = v[0].format('YYYY-MM-DD');
          params.dateTo = v[1].format('YYYY-MM-DD');
        } else if (k !== 'range') {
          params[k] = v;
        }
      }
      const res = await client.get('/cases', { params });
      setData(res.data);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const outcome = searchParams.get('outcome');
    if (outcome) form.setFieldsValue({ outcome });
    fetchData(1, pageSize);
    for (const type of ['disease', 'herb', 'syndrome']) {
      client.get(`/dicts?type=${type}`).then((r) => {
        setDictOptions((prev) => ({ ...prev, [type]: r.data.map((d) => ({ value: d.name })) }));
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async () => {
    const values = form.getFieldsValue();
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined || v === null || v === '') continue;
      if (k === 'range' && Array.isArray(v) && v[0]) {
        params.set('dateFrom', v[0].format('YYYY-MM-DD'));
        params.set('dateTo', v[1].format('YYYY-MM-DD'));
      } else if (k !== 'range') {
        params.set(k, v);
      }
    }
    try {
      await downloadFile(`/cases/export?${params.toString()}`, `医案导出-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const columns = [
    { title: '医案编号', dataIndex: 'case_no', width: 150 },
    { title: '就诊日期', dataIndex: 'visit_date', width: 110 },
    { title: '患者', dataIndex: 'patient_name', width: 90 },
    { title: '性别', dataIndex: 'gender', width: 60 },
    { title: '年龄', dataIndex: 'age', width: 60 },
    { title: '中医诊断', dataIndex: 'tcm_diagnosis', width: 110, render: (v) => v && <Tag color="green">{v}</Tag> },
    { title: '证型', dataIndex: 'syndrome', width: 130, ellipsis: true },
    { title: '方剂', dataIndex: 'formula_name', width: 140, ellipsis: true },
    {
      title: '疗效', dataIndex: 'outcome', width: 80,
      render: (v) => <Tag color={{ 痊愈: 'green', 显效: 'cyan', 有效: 'blue', 无效: 'red', 未随访: 'orange' }[v]}>{v}</Tag>,
    },
    { title: '医师', dataIndex: 'doctor_name', width: 90 },
    {
      title: '操作', key: 'op', width: 110, fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => navigate(`/cases/${record.id}`)}>详情</Button>
          {canWrite && <Button type="link" size="small" onClick={() => navigate(`/cases/${record.id}/edit`)}>编辑</Button>}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="医案管理"
      extra={
        <Space>
          {canWrite && <Button icon={<DownloadOutlined />} onClick={handleExport}>导出 Excel</Button>}
          {canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/cases/new')}>新建医案</Button>}
        </Space>
      }
    >
      <Form form={form} layout="inline" className="mb-4 gap-y-3" onFinish={() => { setPage(1); fetchData(1, pageSize); }}>
        <Form.Item name="disease">
          <AutoComplete options={dictOptions.disease} placeholder="疾病名称" style={{ width: 140 }} filterOption={(i, o) => o.value.includes(i)} allowClear />
        </Form.Item>
        <Form.Item name="herb">
          <AutoComplete options={dictOptions.herb} placeholder="药物名称" style={{ width: 130 }} filterOption={(i, o) => o.value.includes(i)} allowClear />
        </Form.Item>
        <Form.Item name="patient">
          <Input placeholder="病人姓名" style={{ width: 110 }} allowClear />
        </Form.Item>
        <Form.Item name="range">
          <DatePicker.RangePicker />
        </Form.Item>
        <Form.Item name="syndrome">
          <AutoComplete options={dictOptions.syndrome} placeholder="证型" style={{ width: 150 }} filterOption={(i, o) => o.value.includes(i)} allowClear />
        </Form.Item>
        <Form.Item name="outcome">
          <Select placeholder="疗效" style={{ width: 100 }} allowClear options={['痊愈', '显效', '有效', '无效', '未随访'].map((o) => ({ value: o, label: o }))} />
        </Form.Item>
        <Form.Item name="doctor">
          <Input placeholder="医师" style={{ width: 90 }} allowClear />
        </Form.Item>
        <Form.Item name="keyword">
          <Input placeholder="关键字" style={{ width: 120 }} allowClear />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { form.resetFields(); setPage(1); fetchData(1, pageSize); }}>重置</Button>
          </Space>
        </Form.Item>
      </Form>
      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={data.list}
        scroll={{ x: 1200 }}
        pagination={{
          current: page,
          pageSize,
          total: data.total,
          showTotal: (t) => `共 ${t} 条`,
          showSizeChanger: true,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps); },
        }}
      />
    </Card>
  );
}
