/**
 * 演示数据：生成一批模拟医案，便于界面与统计功能演示。
 * 用法：node db/seed-demo.js [数量]
 */
const migrate = require('./migrate');
const seed = require('./seed');

migrate();
seed();

const db = require('../src/models/db');
const caseService = require('../src/services/caseService');

const PATIENTS = ['王建国', '李秀兰', '张伟民', '刘桂芳', '陈志远', '杨晓燕', '赵德柱', '孙丽华', '周文斌', '吴桂英', '郑国强', '冯雪梅', '褚立冬', '卫春花', '蒋海涛', '沈秀英'];
const DOCTORS = ['李医师', '王医师', '陈医师'];
const SURNAMES_GENDER = ['男', '女'];

const PRESCRIPTIONS = {
  胃脘痛: { formula: '柴胡疏肝散加减', syndrome: '肝郁脾虚证', principle: '疏肝健脾，和胃止痛', items: [['柴胡', '10g'], ['白芍', '15g'], ['枳壳', '10g'], ['香附', '10g'], ['陈皮', '6g'], ['川芎', '10g'], ['甘草', '6g']] },
  咳嗽: { formula: '桑菊饮加减', syndrome: '风热犯肺证', principle: '疏风清热，宣肺止咳', items: [['桑叶', '10g'], ['菊花', '10g'], ['杏仁', '10g'], ['桔梗', '6g'], ['连翘', '10g'], ['薄荷', '6g后下'], ['甘草', '6g']] },
  不寐: { formula: '酸枣仁汤加减', syndrome: '心肾不交证', principle: '滋阴降火，交通心肾', items: [['酸枣仁', '30g'], ['知母', '10g'], ['茯苓', '15g'], ['川芎', '6g'], ['甘草', '6g'], ['夜交藤', '20g']] },
  眩晕: { formula: '天麻钩藤饮加减', syndrome: '肝阳上亢证', principle: '平肝潜阳，滋养肝肾', items: [['天麻', '10g'], ['钩藤', '15g后下'], ['石决明', '30g先煎'], ['杜仲', '12g'], ['牛膝', '12g'], ['桑寄生', '15g']] },
  泄泻: { formula: '参苓白术散加减', syndrome: '脾胃虚弱证', principle: '健脾益气，渗湿止泻', items: [['党参', '15g'], ['白术', '12g'], ['茯苓', '15g'], ['山药', '20g'], ['薏苡仁', '20g'], ['陈皮', '6g'], ['甘草', '6g']] },
  头痛: { formula: '川芎茶调散加减', syndrome: '风寒束表证', principle: '疏风散寒止痛', items: [['川芎', '10g'], ['白芷', '10g'], ['羌活', '10g'], ['防风', '10g'], ['细辛', '3g'], ['薄荷', '6g后下'], ['甘草', '6g']] },
  腰痛: { formula: '独活寄生汤加减', syndrome: '肝肾亏虚证', principle: '补肝肾，强筋骨，祛风湿', items: [['独活', '10g'], ['桑寄生', '15g'], ['杜仲', '12g'], ['牛膝', '12g'], ['当归', '12g'], ['白芍', '15g'], ['甘草', '6g']] },
  消渴: { formula: '玉女煎加减', syndrome: '阴虚火旺证', principle: '滋阴清热，生津止渴', items: [['石膏', '30g先煎'], ['知母', '10g'], ['麦冬', '15g'], ['生地黄', '20g'], ['牛膝', '10g'], ['天花粉', '15g']] },
  胸痹: { formula: '血府逐瘀汤加减', syndrome: '气滞血瘀证', principle: '活血化瘀，行气止痛', items: [['丹参', '20g'], ['桃仁', '10g'], ['红花', '6g'], ['当归', '12g'], ['川芎', '10g'], ['赤芍', '12g'], ['柴胡', '10g'], ['甘草', '6g']] },
  月经不调: { formula: '逍遥散加减', syndrome: '肝气郁结证', principle: '疏肝解郁，养血调经', items: [['柴胡', '10g'], ['当归', '12g'], ['白芍', '15g'], ['白术', '12g'], ['茯苓', '15g'], ['薄荷', '6g后下'], ['甘草', '6g']] },
};

const COMPLAINTS = {
  胃脘痛: '胃脘胀痛反复发作，嗳气频作，情绪波动时加重。',
  咳嗽: '咳嗽咯痰，咽痛，伴轻微发热。',
  不寐: '入睡困难，多梦易醒，心悸健忘。',
  眩晕: '头晕目眩，耳鸣，烦躁易怒。',
  泄泻: '大便溏薄，日行数次，食后腹胀。',
  头痛: '头痛连及项背，恶风畏寒。',
  腰痛: '腰部酸痛，劳累后加重，膝软乏力。',
  消渴: '口干多饮，多食易饥，小便频数。',
  胸痹: '胸闷胸痛，痛有定处，入夜尤甚。',
  月经不调: '月经周期紊乱，经前乳房胀痛，经量时多时少。',
};

const OUTCOMES = ['痊愈', '显效', '有效', '有效', '显效', '无效', '未随访'];

function pad(n) { return String(n).padStart(2, '0'); }
function randomOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function main() {
  const count = Number(process.argv[2] || 40);
  const diseases = Object.keys(PRESCRIPTIONS);
  let created = 0;
  for (let i = 0; i < count; i++) {
    const disease = randomOf(diseases);
    const rx = PRESCRIPTIONS[disease];
    const month = 1 + Math.floor(Math.random() * 8); // 2026-01 ~ 2026-08
    const day = 1 + Math.floor(Math.random() * 28);
    const visitDate = `2026-${pad(month)}-${pad(day)}`;
    const items = rx.items.map(([name, dosage]) => {
      const m = dosage.match(/^(\d+g)(.*)$/);
      return { herb_name: name, dosage: m ? m[1] : dosage, note: m && m[2] ? m[2] : null };
    });
    try {
      caseService.createCase({
        patient_name: randomOf(PATIENTS),
        gender: randomOf(SURNAMES_GENDER),
        age: 20 + Math.floor(Math.random() * 55),
        visit_date: visitDate,
        case_type: Math.random() > 0.6 ? '复诊' : '初诊',
        doctor_name: randomOf(DOCTORS),
        chief_complaint: COMPLAINTS[disease],
        inspection: '舌质淡红，苔薄白。',
        palpation: randomOf(['脉弦细。', '脉滑数。', '脉沉细。', '脉弦。']),
        tcm_diagnosis: disease,
        syndrome: rx.syndrome,
        treatment_principle: rx.principle,
        formula_name: rx.formula,
        doses: 3 + Math.floor(Math.random() * 7),
        usage_text: '每日一剂，水煎分早晚温服',
        advice: '忌食生冷辛辣，注意休息，调畅情志。',
        outcome: randomOf(OUTCOMES),
        source: '手工录入',
        items,
      }, 1);
      created++;
    } catch (e) {
      console.error('创建失败：', e.message);
    }
  }
  console.log(`演示数据生成完成：${created} 条医案`);
}

main();
