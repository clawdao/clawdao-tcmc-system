import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Table, Tag, Button, Space, Popconfirm, message, Spin, Image, Timeline, Empty, Modal, Form, DatePicker, Input, Select } from 'antd';
import { EditOutlined, DeleteOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import client, { downloadFile } from '../api/client';
import { DETAIL_GROUPS } from '../config/caseFields';
import { useAuth } from '../context/AuthContext';

export default function CaseDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [followOpen, setFollowOpen] = useState(false);
  const [followForm] = Form.useForm();
  const navigate = useNavigate();
  const { canWrite, isAdmin } = useAuth();

  const load = () => client.get(`/cases/${id}`).then((r) => setData(r.data)).catch((e) => message.error(e.message));
  useEffect(() => { load(); }, [id]);

  const handleDelete = async (hard) => {
    try {
      await client.delete(`/cases/${id}${hard ? '?hard=true' : ''}`);
      message.success('医案已删除');
      navigate('/cases');
    } catch (e) {
      message.error(e.message);
    }
  };

  const handleAddFollowUp = async () => {
    const values = await followForm.validateFields();
    const followUps = [
      ...(data.follow_ups || []).map((f) => ({ follow_date: f.follow_date, content: f.content, outcome: f.outcome })),
      { follow_date: values.follow_date.format('YYYY-MM-DD'), content: values.content, outcome: values.outcome },
    ];
    try {
      await client.put(`/cases/${id}`, { follow_ups: followUps, outcome: values.outcome || data.outcome });
      message.success('随访记录已添加');
      setFollowOpen(false);
      followForm.resetFields();
      load();
    } catch (e) {
      message.error(e.message);
    }
  };

  if (!data) return <div className="flex justify-center py-20"><Spin size="large" /></div>;

  const itemColumns = [
    { title: '序号', width: 60, render: (_, __, i) => i + 1 },
    { title: '药名', dataIndex: 'herb_name' },
    { title: '剂量', dataIndex: 'dosage' },
    { title: '脚注', dataIndex: 'note', render: (v) => v && <Tag>{v}</Tag> },
  ];

  const OUTCOME_COLORS = { 痊愈: 'green', 显效: 'cyan', 有效: 'blue', 无效: 'red', 未随访: 'orange' };
  const LONG_TEXT = ['past_history', 'chief_complaint', 'present_illness', 'inspection', 'auscultation', 'inquiry', 'palpation', 'commentary', 'remark', 'advice'];

  return (
    <div>
      <Card
        title={`医案详情 ${data.case_no}`}
        extra={
          <Space>
            {canWrite && <Button icon={<EditOutlined />} onClick={() => navigate(`/cases/${id}/edit`)}>编辑</Button>}
            {canWrite && (
              <Button icon={<DownloadOutlined />} onClick={() => downloadFile(`/cases/${id}/export-json`, `${data.case_no}.json`)}>
                导出 JSON
              </Button>
            )}
            {canWrite && (
              <Popconfirm title="确认删除该医案？（归档处理）" onConfirm={() => handleDelete(false)} okText="删除" cancelText="取消">
                <Button danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            )}
            {isAdmin && (
              <Popconfirm title="物理删除后不可恢复，确认？" onConfirm={() => handleDelete(true)} okText="彻底删除" cancelText="取消">
                <Button danger type="text">彻底删除</Button>
              </Popconfirm>
            )}
          </Space>
        }
      >
        {DETAIL_GROUPS.map((group) => (
          <div key={group.title} className="mb-6">
            <div className="font-semibold mb-2" style={{ color: '#1a7a4a' }}>{group.title}</div>
            <Descriptions bordered size="small" column={2}>
              {group.fields.map(([key, label]) => (
                <Descriptions.Item label={label} key={key} span={LONG_TEXT.includes(key) ? 2 : 1}>
                  {key === 'outcome'
                    ? <Tag color={OUTCOME_COLORS[data[key]]}>{data[key]}</Tag>
                    : (data[key] ?? '—')}
                </Descriptions.Item>
              ))}
            </Descriptions>
            {group.title === '处方信息' && (
              <Table
                className="mt-3"
                rowKey={(r) => r.id ?? r.herb_name}
                size="small"
                columns={itemColumns}
                dataSource={data.items}
                pagination={false}
                locale={{ emptyText: '未记录药物明细' }}
              />
            )}
          </div>
        ))}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card
          title="随访记录"
          extra={canWrite && (
            <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => setFollowOpen(true)}>添加随访</Button>
          )}
        >
          {(!data.follow_ups || data.follow_ups.length === 0) ? (
            <Empty description="暂无随访记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Timeline
              items={data.follow_ups.map((f) => ({
                children: (
                  <div>
                    <div className="text-sm text-gray-500">{f.follow_date} {f.outcome && <Tag color="blue">{f.outcome}</Tag>}</div>
                    <div>{f.content}</div>
                  </div>
                ),
              }))}
            />
          )}
        </Card>
        <Card title="图片附件与历史就诊">
          {(!data.images || data.images.length === 0) ? (
            <Empty description="暂无图片附件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Image.PreviewGroup>
              <Space wrap>
                {data.images.map((img) => (
                  <Image key={img.id} width={140} src={`/uploads/${img.image_path}`} alt="医案图片" />
                ))}
              </Space>
            </Image.PreviewGroup>
          )}
          <div className="font-semibold mt-4 mb-2">同患者历史就诊</div>
          {(!data.related || data.related.length === 0) ? (
            <Empty description="暂无历史就诊记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Timeline
              items={data.related.map((r) => ({
                children: (
                  <a onClick={() => navigate(`/cases/${r.id}`)}>
                    {r.visit_date} · {r.case_type} · {r.tcm_diagnosis || '未诊断'} <Tag>{r.outcome}</Tag>
                  </a>
                ),
              }))}
            />
          )}
        </Card>
      </div>

      <Modal title="添加随访记录" open={followOpen} onOk={handleAddFollowUp} onCancel={() => setFollowOpen(false)} okText="保存" cancelText="取消">
        <Form form={followForm} layout="vertical" initialValues={{ follow_date: dayjs() }}>
          <Form.Item name="follow_date" label="随访日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="outcome" label="疗效转归">
            <Select allowClear options={['痊愈', '显效', '有效', '无效'].map((o) => ({ value: o, label: o }))} />
          </Form.Item>
          <Form.Item name="content" label="随访内容" rules={[{ required: true, message: '请填写随访内容' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
