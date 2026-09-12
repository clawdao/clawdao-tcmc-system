import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, DatePicker, Select, AutoComplete, Button, Steps, Row, Col, Modal, List, message, Space, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, AppstoreOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../api/client';
import { FORM_STEPS, FIELD_GROUPS } from '../config/caseFields';

// 关键：必须透传 AntD Form.Item 通过 cloneElement 注入的 props（value/onChange 等），
// 否则 Form.Item 注入的 value 会被 React 当作给 FieldInput 自身的 props，
// 内部返回的 <Input/> 永远拿不到 value，导致表单回填失败。
function FieldInput({ field, dictOptions, ...rest }) {
  switch (field.type) {
    case 'textarea':
      return <Input.TextArea rows={3} placeholder={`请输入${field.label}`} {...rest} />;
    case 'number':
      return <InputNumber min={field.min} max={field.max} className="w-full" placeholder={`请输入${field.label}`} {...rest} />;
    case 'date':
      return <DatePicker className="w-full" format="YYYY-MM-DD" {...rest} />;
    case 'select':
      return <Select options={(field.options || []).map((o) => ({ value: o, label: o }))} placeholder={`请选择${field.label}`} allowClear {...rest} />;
    case 'dictSelect':
      return (
        <AutoComplete
          options={dictOptions[field.dictType] || []}
          placeholder={`请输入或选择${field.label}`}
          filterOption={(input, option) => option.value.includes(input)}
          allowClear
          {...rest}
        />
      );
    default:
      return <Input placeholder={`请输入${field.label}`} {...rest} />;
  }
}

// 把后端对象转成 Form 需要的格式（visit_date 转 dayjs、补默认值）
function toFormValues(raw) {
  const values = { ...(raw || {}) };
  if (values.visit_date) values.visit_date = dayjs(values.visit_date);
  for (const group of Object.values(FIELD_GROUPS)) {
    for (const f of group) {
      if (values[f.name] === undefined && f.initial !== undefined) values[f.name] = f.initial;
    }
  }
  return values;
}

// 医案表单（新建/编辑/OCR 校对共用）
export default function CaseForm({ initialValues = {}, initialItems = [], onSubmit, submitting, imageIds = [] }) {
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  // 函数式 useState 初始化：避免父组件异步传值场景下，初值只计算一次的问题
  const [items, setItems] = useState(() => (initialItems && initialItems.length ? initialItems : [{ herb_name: '', dosage: '', note: '' }]));
  const [dictOptions, setDictOptions] = useState({ disease: [], herb: [], syndrome: [], formula: [] });
  const [templates, setTemplates] = useState([]);
  const [tplOpen, setTplOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // 用关键字段生成 initialKey，作为 effect 依赖，确保父组件异步加载完成后能正确触发 setFieldsValue
  const initialKey = React.useMemo(() => JSON.stringify({
    no: initialValues.case_no,
    patient: initialValues.patient_name,
    visit_date: initialValues.visit_date,
    diagnosis: initialValues.tcm_diagnosis,
    items: (initialItems || []).map((i) => `${i.herb_name}|${i.dosage}|${i.note}`).join(','),
  }), [initialValues, initialItems]);

  useEffect(() => { setReady(true); }, []);

  // 父组件数据 ready 且 initialKey 变化时，把数据写回表单
  useEffect(() => {
    if (!ready) return;
    const values = toFormValues(initialValues);
    // 用 setTimeout 把 setFieldsValue 推到下一个宏任务，等 React 把所有 Form.Item 完成首次渲染
    const t = setTimeout(() => {
      form.setFieldsValue(values);
      setItems(prev => (Array.isArray(initialItems) && initialItems.length ? initialItems.map((it) => ({ ...it })) : prev));
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, initialKey]);

  useEffect(() => {
    for (const type of ['disease', 'herb', 'syndrome', 'formula']) {
      client.get(`/dicts?type=${type}`).then((r) => {
        setDictOptions((prev) => ({ ...prev, [type]: r.data.map((d) => ({ value: d.name })) }));
      }).catch(() => {});
    }
    client.get('/templates').then((r) => setTemplates(r.data)).catch(() => {});
  }, []);

  const setItem = (idx, key, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  };

  const applyTemplate = (tpl) => {
    form.setFieldsValue({
      formula_name: tpl.formula_name || undefined,
      usage_text: tpl.usage_text || undefined,
      advice: tpl.advice || undefined,
    });
    if (tpl.items && tpl.items.length) setItems(tpl.items.map((it) => ({ ...it })));
    setTplOpen(false);
    message.success(`已套用模板「${tpl.name}」`);
  };

  const saveAsTemplate = async () => {
    const values = form.getFieldsValue();
    const validItems = items.filter((it) => it.herb_name);
    Modal.confirm({
      title: '保存为处方模板',
      content: <Input id="tpl-name-input" placeholder="请输入模板名称" />,
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        const name = document.getElementById('tpl-name-input').value.trim();
        if (!name) { message.warning('请输入模板名称'); return Promise.reject(); }
        await client.post('/templates', {
          name,
          formula_name: values.formula_name,
          usage_text: values.usage_text,
          advice: values.advice,
          items: validItems,
        });
        const r = await client.get('/templates');
        setTemplates(r.data);
        message.success('模板已保存');
      },
    });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = { ...values };
    if (payload.visit_date && dayjs.isDayjs(payload.visit_date)) {
      payload.visit_date = payload.visit_date.format('YYYY-MM-DD');
    }
    payload.items = items.filter((it) => it.herb_name && it.herb_name.trim());
    if (imageIds.length) payload.image_ids = imageIds;
    onSubmit(payload);
  };

  const currentGroup = FORM_STEPS[step].key;

  return (
    <div>
      <Steps
        current={step}
        items={FORM_STEPS.map((s) => ({ title: s.title }))}
        onChange={setStep}
        className="mb-6"
        size="small"
      />
      <Form form={form} layout="vertical">
        {Object.entries(FIELD_GROUPS).map(([key, fields]) => (
          <div key={key} style={{ display: key === currentGroup ? 'block' : 'none' }}>
            <Row gutter={16}>
              {fields.map((f) => (
                <Col xs={24} md={f.span === 2 ? 24 : 12} key={f.name}>
                  <Form.Item
                    name={f.name}
                    label={f.label}
                    rules={f.required ? [{ required: true, message: `请填写${f.label}` }] : []}
                  >
                    <FieldInput field={f} dictOptions={dictOptions} />
                  </Form.Item>
                </Col>
              ))}
            </Row>
            {key === 'prescription' && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">药物明细</span>
                  <Space>
                    <Button size="small" icon={<AppstoreOutlined />} onClick={() => setTplOpen(true)}>套用模板</Button>
                    <Button size="small" icon={<SaveOutlined />} onClick={saveAsTemplate}>存为模板</Button>
                    <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => setItems((p) => [...p, { herb_name: '', dosage: '', note: '' }])}>
                      添加药物
                    </Button>
                  </Space>
                </div>
                {items.map((it, idx) => (
                  <Row gutter={8} key={idx} className="mb-2">
                    <Col flex="1">
                      <AutoComplete
                        options={dictOptions.herb}
                        value={it.herb_name}
                        onChange={(v) => setItem(idx, 'herb_name', v)}
                        placeholder="药名"
                        filterOption={(input, option) => option.value.includes(input)}
                      />
                    </Col>
                    <Col flex="120px">
                      <Input value={it.dosage} onChange={(e) => setItem(idx, 'dosage', e.target.value)} placeholder="剂量，如 10g" />
                    </Col>
                    <Col flex="140px">
                      <Select
                        value={it.note || undefined}
                        onChange={(v) => setItem(idx, 'note', v)}
                        placeholder="脚注"
                        allowClear
                        options={['先煎', '后下', '烊化', '包煎', '冲服', '另煎'].map((o) => ({ value: o, label: o }))}
                      />
                    </Col>
                    <Col flex="32px">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={items.length === 1}
                        onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                      />
                    </Col>
                  </Row>
                ))}
              </div>
            )}
          </div>
        ))}
      </Form>
      <div className="flex justify-between mt-4">
        <Button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</Button>
        <Space>
          {step < FORM_STEPS.length - 1 && (
            <Button type="primary" onClick={() => setStep(step + 1)}>下一步</Button>
          )}
          {step === FORM_STEPS.length - 1 && (
            <Button type="primary" loading={submitting} onClick={handleSubmit}>提交保存</Button>
          )}
        </Space>
      </div>
      <Modal title="选择处方模板" open={tplOpen} footer={null} onCancel={() => setTplOpen(false)}>
        <List
          dataSource={templates}
          locale={{ emptyText: '暂无模板，可在处方步骤"存为模板"' }}
          renderItem={(tpl) => (
            <List.Item
              actions={[
                <Button type="link" key="use" onClick={() => applyTemplate(tpl)}>使用</Button>,
                <Popconfirm key="del" title="删除该模板？" onConfirm={async () => { await client.delete(`/templates/${tpl.id}`); setTemplates((p) => p.filter((t) => t.id !== tpl.id)); }}>
                  <Button type="link" danger>删除</Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta title={tpl.name} description={tpl.formula_name || '未命名方剂'} />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}
