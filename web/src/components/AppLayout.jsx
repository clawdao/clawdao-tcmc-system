import React, { useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, Modal, Form, Input, message } from 'antd';
import {
  DashboardOutlined, FileTextOutlined, CameraOutlined, BarChartOutlined,
  BookOutlined, SettingOutlined, UserOutlined, LogoutOutlined, LockOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

const { Header, Sider, Content } = Layout;

const ROLE_LABEL = { admin: '管理员', doctor: '医师', readonly: '只读' };

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pwdOpen, setPwdOpen] = useState(false);
  const [form] = Form.useForm();

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/cases', icon: <FileTextOutlined />, label: '医案管理' },
    { key: '/upload', icon: <CameraOutlined />, label: '拍照建案' },
    { key: '/stats', icon: <BarChartOutlined />, label: '统计分析' },
    { key: '/dicts', icon: <BookOutlined />, label: '数据字典' },
    ...(isAdmin ? [{ key: '/system', icon: <SettingOutlined />, label: '系统管理' }] : []),
  ];

  const selectedKey = location.pathname === '/' ? '/' : '/' + location.pathname.split('/')[1];

  const handleChangePwd = async () => {
    const values = await form.validateFields();
    try {
      await client.post('/auth/change-password', values);
      message.success('密码修改成功');
      setPwdOpen(false);
      form.resetFields();
    } catch (e) {
      message.error(e.message);
    }
  };

  return (
    <Layout className="h-full">
      <Sider theme="light" width={208} className="border-r border-gray-200">
        <div className="px-5 py-4 text-base font-semibold" style={{ color: '#1a7a4a' }}>
          中医医案管理系统
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 'none' }}
        />
      </Sider>
      <Layout>
        <Header className="bg-white border-b border-gray-200 flex items-center justify-end px-6" style={{ height: 56, lineHeight: '56px' }}>
          <Dropdown
            menu={{
              items: [
                { key: 'pwd', icon: <LockOutlined />, label: '修改密码', onClick: () => setPwdOpen(true) },
                { type: 'divider' },
                {
                  key: 'logout', icon: <LogoutOutlined />, label: '退出登录',
                  onClick: () => { logout(); navigate('/login'); },
                },
              ],
            }}
          >
            <span className="cursor-pointer flex items-center gap-2">
              <Avatar size="small" style={{ background: '#1a7a4a' }} icon={<UserOutlined />} />
              <span>{user?.realName || user?.username}</span>
              <span className="text-xs text-gray-400">{ROLE_LABEL[user?.role] || ''}</span>
            </span>
          </Dropdown>
        </Header>
        <Content className="p-6 overflow-auto">
          <Outlet />
        </Content>
      </Layout>
      <Modal title="修改密码" open={pwdOpen} onOk={handleChangePwd} onCancel={() => setPwdOpen(false)} okText="确认" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6, message: '新密码至少 6 位' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
