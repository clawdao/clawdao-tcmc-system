// 统一错误处理 + 统一响应格式 { code, message, data }
module.exports = function errorHandler() {
  return async (ctx, next) => {
    try {
      await next();
      if (ctx.body === undefined && ctx.status === 404) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '接口不存在', data: null };
      }
    } catch (err) {
      const status = err.status || 500;
      ctx.status = status;
      ctx.body = {
        code: err.code || status,
        message: err.expose ? err.message : (status === 500 ? '服务器内部错误' : err.message),
        data: err.detail || null,
      };
      if (status === 500) console.error('[服务器错误]', err);
    }
  };
};

module.exports.ok = (ctx, data = null, message = 'ok') => {
  ctx.body = { code: 0, message, data };
};

module.exports.fail = (ctx, status, message, detail) => {
  ctx.status = status;
  ctx.body = { code: status, message, data: detail || null };
};
