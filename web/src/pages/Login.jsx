import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await client.post('/auth/login', values);
      login(res.data.token, res.data.user);
      message.success('登录成功');
      navigate('/');
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #eef5f0 0%, #f5f7f5 60%)' }}>
      <Card className="w-full" style={{ maxWidth: 380, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
        <div className="text-center mb-6">
          <div className="text-xl font-semibold" style={{ color: '#1a7a4a' }}>中医医案管理系统</div>
          <div className="text-gray-400 text-sm mt-1">传承岐黄 · 医案数字化</div>
        </div>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登 录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
