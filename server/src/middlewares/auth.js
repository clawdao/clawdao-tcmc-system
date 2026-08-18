const jwt = require('jsonwebtoken');
const config = require('../config');
const { fail } = require('./error');

// JWT 鉴权：解析成功后将用户信息挂到 ctx.state.user
function auth() {
  return async (ctx, next) => {
    const header = ctx.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return fail(ctx, 401, '未登录或登录已过期');
    try {
      ctx.state.user = jwt.verify(token, config.jwtSecret);
    } catch {
      return fail(ctx, 401, '未登录或登录已过期');
    }
    await next();
  };
}

// 角色鉴权：requireRole('admin') / requireRole('admin', 'doctor')
function requireRole(...roles) {
  return async (ctx, next) => {
    const user = ctx.state.user;
    if (!user) return fail(ctx, 401, '未登录或登录已过期');
    if (!roles.includes(user.role)) return fail(ctx, 403, '没有操作权限');
    await next();
  };
}

module.exports = { auth, requireRole };
