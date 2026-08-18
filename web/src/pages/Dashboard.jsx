import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, List, Tag, Button, Empty } from 'antd';
import { FileTextOutlined, PlusCircleOutlined, ClockCircleOutlined, TeamOutlined, CameraOutlined, BarChartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [pending, setPending] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    client.get('/stats/overview').then((r) => setOverview(r.data)).catch(() => {});
    client.get('/followups/pending').then((r) => setPending(r.data)).catch(() => {});
  }, []);

  const cards = [
    { title: '医案总数', value: overview?.total, icon: <FileTextOutlined style={{ color: '#1a7a4a' }} /> },
    { title: '本月新增', value: overview?.monthNew, icon: <PlusCircleOutlined style={{ color: '#c08a1e' }} /> },
    { title: '待随访', value: overview?.pendingFollow, icon: <ClockCircleOutlined style={{ color: '#b3402a' }} /> },
    { title: '患者人数', value: overview?.patients, icon: <TeamOutlined style={{ color: '#3a6ea5' }} /> },
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={12} md={6} key={c.title}>
            <Card>
              <Statistic title={<span className="flex items-center gap-2">{c.icon}{c.title}</span>} value={c.value ?? '-'} />
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={14}>
          <Card
            title="待随访医案"
            extra={<Button type="link" onClick={() => navigate('/cases?outcome=未随访')}>查看全部</Button>}
          >
            {pending.length === 0 ? (
              <Empty description="暂无待随访医案" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                dataSource={pending.slice(0, 6)}
                renderItem={(item) => (
                  <List.Item
                    className="cursor-pointer hover:bg-gray-50 px-2"
                    onClick={() => navigate(`/cases/${item.id}`)}
                  >
                    <List.Item.Meta
                      title={<span>{item.patient_name} <Tag color="green">{item.tcm_diagnosis || '未诊断'}</Tag></span>}
                      description={`${item.visit_date} · ${item.doctor_name || '未填写医师'} · ${item.case_no}`}
                    />
                    <Tag color="orange">未随访</Tag>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="快捷操作">
            <div className="flex flex-col gap-3">
              <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => navigate('/cases/new')}>
                手工录入医案
              </Button>
              <Button icon={<CameraOutlined />} onClick={() => navigate('/upload')}>
                拍照识别建案
              </Button>
              <Button icon={<BarChartOutlined />} onClick={() => navigate('/stats')}>
                查看统计分析
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
