// ==================== 游戏常量 ====================
const W = 960, H = 720;
const GROUND_Y = Math.floor(H * 0.2);   // 上五分之一是陆地
const TILE = 40;                         // 每个格子大小
const BASEMENT_COLS = Math.floor(W / TILE);           // 24
const BASEMENT_ROWS = Math.floor((H - GROUND_Y) / TILE); // 14
const DOOR_X = W / 2;
// 地窖活板门（横向，较宽较浅，嵌在地表）
const DOOR_WIDTH = 100;
const DOOR_HEIGHT = 18;

// ===== 玩家常量 =====
const PLAYER = {
  baseSpeed: 120,
  baseHp: 40,
  baseAtk: 12,
  baseAtkRange: 48,
  baseAtkInterval: 0.6,
  hitRadius: 18,
  spawnX: W/2,
  spawnY: GROUND_Y - 22
};

// ===== 野生资源堆 =====
const RESOURCE_PILE = {
  spawnInterval: 8,    // 每8秒尝试生成
  maxCount: 5,         // 场上最多5堆
  collectRadius: 30,   // 玩家拾取距离
  values: {            // 随机数量范围
    gold: [3, 15],
    food: [2, 10],
    power: [1, 5]
  }
};

// ===== 铁匠铺升级 =====
const BLACKSMITH_UPGRADES = [
  { level: 1, cost: {gold: 0},    hp: 40,  atk: 12, speed: 120, name: '新手木棒' },
  { level: 2, cost: {gold: 80},   hp: 55,  atk: 18, speed: 130, name: '铁制短剑' },
  { level: 3, cost: {gold: 180,food:30},   hp: 75,  atk: 26, speed: 140, name: '钢铸长剑' },
  { level: 4, cost: {gold: 350,power:40},  hp: 100, atk: 36, speed: 150, name: '附魔巨剑' },
  { level: 5, cost: {gold: 600,food:80,power:80}, hp: 140, atk: 52, speed: 160, name: '传奇神兵' },
  { level: 6, cost: {gold: 1000,food:120,power:120}, hp: 180, atk: 72, speed: 175, name: '龙息巨刃' },
  { level: 7, cost: {gold: 1800,food:200,power:200}, hp: 250, atk: 100, speed: 190, name: '灭世神剑' }
];

// ==================== 8bit 调色板 ====================
const COL = {
  sky1: '#87ceeb', sky2: '#5fa8d3',
  cloud: '#ffffff',
  grass: '#4a8c3a', grassDark: '#3a6c2a',
  dirt: '#8b5a2b', dirtDark: '#6b4420',
  stone: '#7a7a7a', stoneDark: '#5a5a5a', stoneLight: '#9a9a9a',
  wood: '#a0672c', woodDark: '#80501c',
  gold: '#ffd700', goldDark: '#b8960f',
  food: '#5fcf5f', foodDark: '#3a8a3a',
  power: '#4aa8ff', powerDark: '#2a5fbf',
  red: '#e74c3c', redDark: '#a33126',
  zombie: '#6b9b4a', zombieDark: '#4a6b2a',
  soldier: '#3498db', soldierDark: '#2471a5',
  player: '#2ecc71', playerDark: '#1e8449',
  door: '#8b4513', doorDark: '#5a2e0c', doorMetal: '#aaa',
  hpBg: '#2a0a0a', hpFill: '#e74c3c',
  text: '#ffffff', textShadow: '#000000',
  room: '#5a3a2a', roomBorder: '#2a1a0a',
  buildGhost: 'rgba(100,255,100,0.3)',
  buildInvalid: 'rgba(255,50,50,0.3)',
  selected: '#ffcc00',
  pileGold: '#ffd700', pileFood: '#5fcf5f', pilePower: '#4aa8ff'
};

// ==================== 房间类型定义（宽:高=2:1，长=宽×2） ====================
const ROOM_TYPES = {
  command: {
    name: '指挥中心', icon: '♛',
    cost: {gold:0}, desc: '基地核心，游戏开始就有',
    color: '#c9a227', colorDark: '#8b6914',
    size: {w:2,h:2}, unique: true,
    produce: null,
    texture: 'room_command.jpg'
  },
  goldmine: {
    name: '金矿', icon: '◉',
    cost: {gold:50}, desc: '每秒产生 2 金币',
    color: '#ffd700', colorDark: '#b8860b',
    size: {w:2,h:1},
    produce: {gold: 2, interval: 1},
    texture: 'room_goldmine.jpg'
  },
  farm: {
    name: '农田', icon: '♥',
    cost: {gold:40}, desc: '每秒产生 1.5 食物',
    color: '#5fcf5f', colorDark: '#3a8a3a',
    size: {w:2,h:1},
    produce: {food: 1.5, interval: 1},
    texture: 'room_farm.jpg'
  },
  powerplant: {
    name: '发电站', icon: '⚡',
    cost: {gold:80}, desc: '每秒产生 1 电力',
    color: '#4aa8ff', colorDark: '#2a5fbf',
    size: {w:2,h:1},
    produce: {power: 1, interval: 1},
    texture: 'room_powerplant.jpg'
  },
  barracks: {
    name: '兵营', icon: '⚔',
    cost: {gold:100,food:30}, desc: '训练 1 名防御士兵驻守地面',
    color: '#e74c3c', colorDark: '#a33126',
    size: {w:2,h:1},
    produce: null,
    effect: {soldier: 1},
    texture: 'room_barracks.jpg'
  },
  armory: {
    name: '武器库', icon: '➹',
    cost: {gold:150, power:20}, desc: '所有士兵攻击力 +20%',
    color: '#9b59b6', colorDark: '#6c3483',
    size: {w:2,h:1},
    effect: {atkBonus: 0.2},
    texture: 'room_armory.jpg'
  },
  infirmary: {
    name: '医疗室', icon: '✚',
    cost: {gold:120, food:50}, desc: '每秒修复大门 1 点耐久',
    color: '#ecf0f1', colorDark: '#8a8a8a',
    size: {w:2,h:1},
    produce: {doorHeal: 1, interval: 1},
    texture: 'room_infirmary.jpg'
  },
  warehouse: {
    name: '仓库', icon: '▣',
    cost: {gold:60}, desc: '资源上限 +200',
    color: '#a0672c', colorDark: '#70470c',
    size: {w:2,h:1},
    effect: {capacity: 200},
    texture: 'room_warehouse.jpg'
  },
  trap: {
    name: '陷阱室', icon: '✴',
    cost: {gold:80, power:10}, desc: '每波开始对随机3只丧尸造成10伤害',
    color: '#e67e22', colorDark: '#a0400a',
    size: {w:2,h:1},
    effect: {trapDmg: 10, trapCount: 3},
    texture: 'room_trap.jpg'
  },
  blacksmith: {
    name: '铁匠铺', icon: '⚒',
    cost: {gold:120, food:20}, desc: '升级玩家的武器与装备',
    color: '#8a5a2a', colorDark: '#5a3a14',
    size: {w:2,h:1},
    effect: {blacksmith: true},
    texture: 'room_blacksmith.jpg'
  },
  wall: {
    name: '加固墙', icon: '▤',
    cost: {gold:20}, desc: '美观&填充，不占用功能位',
    color: '#7a7a7a', colorDark: '#4a4a4a',
    size: {w:1,h:1},
    effect: null
  }
};

// ==================== 手动使用房间功能定义 ====================
const ROOM_USE = {
  goldmine: {
    label: '⛏ 手动挖矿',
    desc: '消耗 2 食物，立刻产出 25 金币',
    cost: { food: 2 },
    effect: (g) => { g.addRes('gold', 25); },
    cd: 4
  },
  farm: {
    label: '🌾 立即收割',
    desc: '消耗 1 电力，立刻产出 18 食物',
    cost: { power: 1 },
    effect: (g) => { g.addRes('food', 18); },
    cd: 4
  },
  powerplant: {
    label: '🔥 启动锅炉',
    desc: '消耗 3 金币 + 3 食物，立刻产出 8 电力',
    cost: { gold: 3, food: 3 },
    effect: (g) => { g.addRes('power', 8); },
    cd: 5
  },
  infirmary: {
    label: '✚ 紧急治疗',
    desc: '消耗 15 食物，恢复玩家 30 HP',
    cost: { food: 15 },
    effect: (g) => { g.player.hp = Math.min(g.player.maxHp, g.player.hp + 30); },
    cd: 8
  },
  barracks: {
    label: '⚔ 临时援军',
    desc: '消耗 30 金币 + 10 食物，召唤 1 名援军士兵（本波）',
    cost: { gold: 30, food: 10 },
    effect: (g) => { g.summonTempSoldier(); },
    cd: 15
  },
  armory: {
    label: '➹ 分发弹药',
    desc: '消耗 10 电力，士兵攻击 +40%（持续 15 秒）',
    cost: { power: 10 },
    effect: (g) => { g.buffs.soldierAtk = { until: performance.now()/1000 + 15, mult: 1.4 }; },
    cd: 20
  },
  trap: {
    label: '✴ 紧急陷阱',
    desc: '消耗 15 电力，对场上所有丧尸造成 25 伤害',
    cost: { power: 15 },
    effect: (g) => { g.damageAllZombies(25); },
    cd: 18
  },
  command: {
    label: '♛ 集结号令',
    desc: '消耗 20 金币 + 5 食物 + 5 电力，玩家攻击力翻倍 12 秒',
    cost: { gold: 20, food: 5, power: 5 },
    effect: (g) => { g.buffs.playerAtk = { until: performance.now()/1000 + 12, mult: 2 }; },
    cd: 25
  },
  warehouse: {
    label: '▣ 清点库存',
    desc: '立即获得 5 金币 + 5 食物 + 3 电力',
    cost: {},
    effect: (g) => { g.addRes('gold', 5); g.addRes('food', 5); g.addRes('power', 3); },
    cd: 6
  },
  blacksmith: null,  // 升级面板
  wall: null
};
