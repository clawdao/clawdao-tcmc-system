import React, { useEffect, useState } from 'react';
import { Card, DatePicker, Row, Col, Empty, Spin } from 'antd';
import { Column, Pie, Line } from '@ant-design/plots';
import dayjs from 'dayjs';
import client from '../api/client';

const PALETTE = ['#1a7a4a', '#c08a1e', '#3a6ea5', '#b3402a', '#6b4fa0', '#2a8a8a'];

const emptyNode = <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} className="py-10" />;

export default function Stats() {
  const [range, setRange] = useState([null, null]);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchAll = async (r) => {
    setLoading(true);
    const params = {};
    if (r && r[0]) params.dateFrom = r[0].format('YYYY-MM-DD');
    if (r && r[1]) params.dateTo = r[1].format('YYYY-MM-DD');
    try {
      const [diseases, herbs, syndromes, outcomes, trend, doctors] = await Promise.all([
        client.get('/stats/diseases', { params }),
        client.get('/stats/herbs', { params: { ...params, top: 15 } }),
        client.get('/stats/syndromes', { params }),
        client.get('/stats/outcomes', { params }),
        client.get('/stats/trend', { params }),
        client.get('/stats/doctors', { params }),
      ]);
      setData({
        diseases: diseases.data,
        topHerbs: herbs.data.topHerbs,
        pairs: herbs.data.pairs,
        syndromes: syndromes.data,
        outcomes: outcomes.data,
        trend: trend.data,
        doctors: doctors.data,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(range); }, [range]);

  const stacked = (data.outcomes || []).map((o) => ({ disease: o.disease, outcome: o.outcome, value: o.value }));

  if (loading && !data.diseases) return <div className="flex justify-center py-20"><Spin size="large" /></div>;

  return (
    <div>
      <Card className="mb-4">
        <span className="mr-3">统计时间范围：</span>
        <DatePicker.RangePicker
          value={range[0] ? range : null}
          onChange={(v) => setRange(v || [null, null])}
          presets={[
            { label: '本月', value: [dayjs().startOf('month'), dayjs()] },
            { label: '近三月', value: [dayjs().subtract(3, 'month'), dayjs()] },
            { label: '近一年', value: [dayjs().subtract(1, 'year'), dayjs()] },
          ]}
        />
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="疾病谱分布（Top 20）" size="small">
            {data.diseases?.length ? (
              <Column data={data.diseases} xField="name" yField="value" height={280}
                color={PALETTE[0]} axis={{ x: { labelAutoRotate: true } }} />
            ) : emptyNode}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="高频药物（Top 15）" size="small">
            {data.topHerbs?.length ? (
              <Column data={data.topHerbs} xField="name" yField="value" height={280}
                color={PALETTE[1]} axis={{ x: { labelAutoRotate: true } }} />
            ) : emptyNode}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="证型分布" size="small">
            {data.syndromes?.length ? (
              <Pie data={data.syndromes} angleField="value" colorField="name" height={280}
                innerRadius={0.5} legend={{ color: { position: 'right' } }} />
            ) : emptyNode}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="常用药对（两药共现 Top 15）" size="small">
            {data.pairs?.length ? (
              <Column data={data.pairs} xField="name" yField="value" height={280}
                color={PALETTE[2]} axis={{ x: { labelAutoRotate: true } }} />
            ) : emptyNode}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="分疾病疗效构成" size="small">
            {stacked.length ? (
              <Column data={stacked} xField="disease" yField="value" colorField="outcome" height={280}
                stack axis={{ x: { labelAutoRotate: true } }} />
            ) : emptyNode}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="医案量月度趋势" size="small">
            {data.trend?.length ? (
              <Line data={data.trend} xField="period" yField="value" height={280} color={PALETTE[0]} point={{ size: 4 }} />
            ) : emptyNode}
          </Card>
        </Col>
        <Col xs={24} lg={24}>
          <Card title="医师工作量" size="small">
            {data.doctors?.length ? (
              <Column data={data.doctors} xField="name" yField="value" height={260} color={PALETTE[4]} />
            ) : emptyNode}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
