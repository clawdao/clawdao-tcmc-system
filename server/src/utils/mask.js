// 敏感信息脱敏工具
function maskName(name) {
  if (!name) return name;
  return name[0] + '*'.repeat(Math.max(name.length - 1, 1));
}

function maskPhone(phone) {
  if (!phone) return phone;
  const s = String(phone);
  if (s.length < 7) return s.replace(/./g, '*');
  return s.slice(0, 3) + '****' + s.slice(-4);
}

// 对医案对象（或列表）做脱敏
function maskCase(row) {
  if (!row) return row;
  return { ...row, patient_name: maskName(row.patient_name), phone: maskPhone(row.phone) };
}

module.exports = { maskName, maskPhone, maskCase };
