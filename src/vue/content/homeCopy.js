export const taskTypes = [
  [
    '阅读',
    [
      'Complete the Words（补全单词）',
      'Read in Daily Life（日常生活阅读）',
      'Read an Academic Passage（学术文章阅读）'
    ]
  ],
  [
    '听力',
    [
      'Listen and Choose a Response',
      'Listen to a Conversation',
      'Listen to an Announcement',
      'Listen to an Academic Talk'
    ]
  ],
  [
    '写作',
    [
      'Build a Sentence（造句）',
      'Write an Email（写邮件）',
      'Write for an Academic Discussion（学术讨论写作）'
    ]
  ],
  ['口语', ['Listen and Repeat（听并复述）', 'Take an Interview（面试式问答）']]
];

export const cefrRows = [
  ['C2', '6'],
  ['C1', '5–5.5'],
  ['B2', '4–4.5'],
  ['B1', '3–3.5'],
  ['A2', '2–2.5'],
  ['A1', '1–1.5']
];

export const scoreConversionRows = [
  ['6', '29–30', '28–30', '29–30', '28–30', '114–120'],
  ['5.5', '26–28', '26–27', '27–28', '27', '106–113'],
  ['5', '24–25', '22–25', '24–26', '25–26', '95–105'],
  ['4.5', '21–23', '19–21', '23', '23–24', '86–94'],
  ['4', '18–20', '17–18', '17–22', '20–22', '72–85'],
  ['3.5', '12–17', '13–16', '15–16', '18–19', '58–71'],
  ['3', '6–11', '9–12', '13–14', '16–17', '44–57'],
  ['2.5', '4–5', '6–8', '11–12', '14–15', '35–43'],
  ['2', '3', '4–5', '7–10', '10–13', '24–34'],
  ['1.5', '2', '2–3', '3–6', '5–9', '12–23'],
  ['1', '1–1.5', '0–1', '0–2', '0–4', '0–11']
];

export const changelog = [
  [
    'V1.4.0',
    '2026-07-15',
    '应用整体升级，提升运行速度、数据存储效率和稳定性。优化模考、打字练习与单词学习体验，并修复部分阅读题显示、答案识别及 TPO 编号问题。'
  ],
  [
    'V1.3.2',
    '2026-07-06',
    '修复 Reading 模块多项问题：支持 grouped [ANSWER] 分组答案格式和方括号插入位置标记，补齐 TPO 06 M2 插入位置，并修正题库 Markdown 标题编号。'
  ],
  [
    'V1.3.1',
    '2026-07-06',
    '修复 Listening LCAR 题型时间戳失效问题（TPO 01-04）。generate_listening_pages.js 中 AUDIO_START/AUDIO_END 硬编码为 0/999 导致共享音频文件无法定位到每题对应片段，现已恢复正确的 q.audioStart/q.audioEnd 时间戳传递。'
  ],
  [
    'V1.3.0',
    '2026-07-03',
    '全新 Skills - 真题单词背诵系统（Vocabulary）。<br>覆盖 Reading(665词) / Listening(190词) / Speaking(66词) / Writing(141词) 四模块核心词汇。听音辨义、看音选义、中英互译、原句拼写四种学习模式 × SM-2 间隔复习算法。词根词缀模式：按前缀(28组) / 后缀(65组) / 词根(93组) + 25个推荐词根分类记忆。每日提醒 + 全局模块级复习入口，单日上限 50 词。WordDetail 详情页渲染修复（缺失翻译/IPA/词源兼容多schema）。清除 29 个人名等非词汇数据。AudioLearning / CardLearning 中英键名统一。Spell 输入框自适应宽度。Mac 签名修复（identity: null 免除签名校验）。'
  ],
  [
    'V1.2.6',
    '2026-06-29',
    '新增 TPO 05-09 共五套内容。TPO 05（原07）/ 06 / 07 完整听说读写四模块，TPO 08（原05）/ 09（原06）阅读+写作模块。TPO 重新排序 05-09。新增 Advertisement 题型模板；Listening/Speaking 支持每题独立音频文件；Writing BS 题型答案标签修复；Results 模板双模式音频兼容。'
  ],
  ['V1.2.5', '2026-06-24', '版本号对齐，更新日志完善（V1.2.1 ~ V1.2.5 全记录）。'],
  ['V1.2.4', '2026-06-24', '清理历史发布残留，统一版本号。'],
  [
    'V1.2.3',
    '2026-06-24',
    '修复 Skills - Typing 语料库在 Electron 打包后无法加载（loader.js 路径解析：file:// 协议下自动添加 ../ 前缀，从 dist/ 回退到 app 根目录）。'
  ],
  [
    'V1.2.2',
    '2026-06-24',
    '补全 Typing 练习文章语料：15 篇 TOEFL 学术风格文章（三级难度各 5 篇）。<br>修复 TPO 02-04 Writing &amp; Speaking 模块空白（生成脚本原仅支持 TPO 01，现已对齐 Reading/Listening 自动发现全部 TPO 目录）。'
  ],
  [
    'V1.2.1',
    '2026-06-24',
    '重磅更新：新增 Skills - Typing 英文打字练习模块。<br>支持 Beginner / Intermediate / Advanced 三级难度，含倒计时、暂停/重试、结果页（Raw WPM / Net WPM / Accuracy / 错误分布）和进度页（SVG 趋势图 + 历史记录）。<br>新增 TPO 04 全套真题（阅读/听力/写作/口语）。<br>修复 Reading &amp; Writing 计时器跨模块共用错误。<br>修复 Electron 本地 dev 模式 main.js 无法加载（vite 配置剔除 script 标签）。<br>侧边栏新增 Skills 分区，自动更新增加每 10 分钟轮询检测。'
  ],
  [
    'V1.1.7',
    '2026-06-21',
    '新增 macOS 构建支持，双平台自动更新机制打通。<br>修复 CI 构建包缺失 TPO 题库页面（四大模块空白）与关注合作照片不显示。<br>修复 javascript-obfuscator ESM 导入在 Windows 路径下的兼容性问题。<br>Mac DMG 文件名规范化为 toefl-practice-system-{version}-mac.dmg。'
  ],
  [
    'V1.1.6',
    '2026-06-20',
    '修复打包后测试报告按钮点击空白：file:// 协议拦截器未剥离 ?mode=report 查询参数，导致路径解析为带问号的文件名，fs.existsSync 永返回 false。<br>修复 Writing 结果页计时器显示 7111:32（intro 页过早保存 start_time，结果页 fallback 读到了过期时间戳）。'
  ],
  [
    'V1.1.5',
    '2026-06-18',
    '自动更新功能回归验证通过。全流程（检测 → 红圈 → 下载 → 安装重启）正式打通。'
  ],
  [
    'V1.1.4',
    '2026-06-18',
    '补全 update:check / quit-and-install IPC handler。修复 checkForUpdatesAndNotify → checkForUpdates。自动更新全流程正式打通。'
  ],
  [
    'V1.1.3',
    '2026-06-18',
    '正式打通自动更新全流程。App 更新与内容更新均走日志卡片 → 下载进度 → 安装可见流程。清理历史构建残留。'
  ],
  [
    'V1.1.2',
    '2026-06-18',
    '修复 App 更新功能（process.env.NODE_ENV → app.isPackaged）。验证自动更新日志流程，为后续版本提供可靠基础。'
  ],
  [
    'V1.1.1',
    '2026-06-18',
    '优化更新体验：App 更新与内容更新统一走日志卡片 → 下载进度 → 安装可见流程。内容更新下载去重（仅写 userData），已有文件自动跳过并同步版本号，消除红圈误弹。添加协议拦截器实现图片资源回退加载。'
  ],
  [
    'V1.1.0',
    '2026-06-18',
    '修复 5 项问题：Listening/Reading 答案存储隔离、Speaking 录音计时与权限、继续练习路径、LCAR 题型 Help 按钮、Result 全对检测与庆祝动画。新增四模块 localStorage 前缀隔离，优化 Clear & Exit 逻辑与 Speaking 录音体验，添加 Electron 麦克风预授权。'
  ],
  [
    'V1.0.0',
    '2026-06',
    '首个正式版本。全面支持 TPO 模考，涵盖阅读、听力、写作、口语全科练习。实现答题计时、自动保存、结果统计、错题回顾等核心功能。采用 Electron 桌面应用架构，支持自动更新。'
  ],
  [
    'V0.0（测试版）',
    '2026-05',
    '初始版本正式发布。核心功能上线：全面支持 TPO 模考，涵盖阅读、听力、写作、口语全科练习。<br><br>开发者寄语：本版本为初版测试，旨在为考生提供高效的模考体验。一切内容以后续测试者的实际反馈为准，我们将持续进行优化与改进。'
  ]
];
