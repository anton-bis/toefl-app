# 托福模考系统 - 开发环境设置

## 启动开发服务器

### 方法一：使用 npm scripts

```bash
# 启动开发服务器（默认端口 3000）
npm run dev

# 或者使用 start 命令（支持远程访问）
npm start
```

### 方法二：直接使用 Vite

```bash
# 指定端口启动
npx vite --port 3000

# 支持远程访问
npx vite --host
```

## 访问应用

开发服务器启动后，在浏览器中访问：

- **本地**: http://localhost:3000
- **局域网其他设备**: http://<你的IP地址>:3000

## 项目结构

```
├── src/
│   ├── components/      # UI组件
│   │   ├── ListeningPlayer.js
│   │   ├── ListeningQuestion.js
│   │   ├── MultipleChoice.js
│   │   └── ...
│   ├── core/           # 核心模块
│   │   ├── store.js    # 状态管理（答案存储）
│   │   ├── loader.js   # 题库加载
│   │   ├── parser.js   # Markdown解析
│   │   └── utils.js    # 工具函数
│   ├── modules/        # 模块
│   │   ├── reading/    # 阅读模块
│   │   └── listening/ # 听力模块
│   └── main.js         # 应用入口
├── assets/
│   └── questions/     # 题库文件
│       ├── reading/
│       └── listening/
├── docs/              # 文档
└── package.json
```

## 题库格式

### 阅读题库

文件位置：`assets/questions/reading/reading-2026-test-01.md`

```markdown
# Reading Test

## Read the passage and answer the questions.

The atmosphere is the layer of gases surrounding Earth...

## Question 1

The word "atmosphere" in the passage is closest in meaning to:

A) sky
B) ocean
C) land
D) space

@answer A
```

### 听力题库

文件位置：`assets/questions/listening/listening-2026-test-01.md`

```markdown
# Listening Test

## Listen to a Conversation

### Audio
audio: conversation1.mp3

### Script
Student: Hi, professor...
Professor: Hello, how can I help you?

### Question 1

What is the main topic of the conversation?

A) Homework assignment
B) Office hours
C) Campus event
D) Library resources

@answer A

@type listening
@taskType listen_to_conversation
```

## 可用模块

在应用下拉菜单中选择：

- 📚 阅读模块 (Reading)
- 🎧 听力模块 (Listening)  
- 🎤 口语模块 (Speaking)
- ✍️ 写作模块 (Writing)

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览构建结果 |
| `npm run electron:dev` | Electron开发模式 |
| `npm run electron:build` | 构建桌面应用 |

## 技术栈

- **构建工具**: Vite
- **模板引擎**: Handlebars
- **桌面端**: Electron（可选）
- **代码规范**: ESLint + Prettier

## 常见问题

### 端口被占用

```bash
# 查看占用端口的进程
netstat -ano | findstr :3000

# 结束进程
taskkill /PID <进程ID> /F
```

### 题库文件加载失败

确保题库文件：
1. 位于正确目录 (`assets/questions/reading/` 或 `assets/questions/listening/`)
2. 扩展名为 `.md`
3. 格式正确

### 音频文件无法播放

音频文件应放在 `assets/questions/listening/` 目录，支持格式：MP3, WAV, OGG