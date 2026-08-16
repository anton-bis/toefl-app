# Writing 头像库（Avatar Library）

## 用途

Writing 三种题型的圆形人像头像统一从本目录取用。头像只用于视觉呈现。

- Build a Sentence：每题 2 个头像（两位发言人），使用 **BS 白底**头像
- Write for an Academic Discussion：教授 1 个 + 两位学生各 1 个，共 3 个头像，使用 **场景底**头像
- Write an Email：不使用头像

## 目录

`assets/questions/writing/avatars/`

## 为什么区分两套头像

- Build Sentence（BS）：人物为**纯白背景**（`avatar-bs-*.png`）
- Academic Discussion（D）：人物带**场景背景**（`avatar-d-*.png`）

两套视觉风格不同，必须各自独立，不能混用。

## 文件命名

头像与引用它的 Markdown 同级目录存放（`collectDocumentAssets` 按 `sourceDirectory + 文件名`
收集，路径不允许 `..`，故不用子目录）：

```text
avatar-bs-1.png   ...  avatar-bs-16.png   (Build Sentence 白底)
avatar-d-1.png    ...  avatar-d-7.png     (Academic Discussion 场景底)
```

统一尺寸：400×400 透明底 PNG，等比缩放居中、不裁剪、不拉伸。

## 分配规则（AI 导入时遵循）

1. Build Sentence：从 `avatar-bs-*` 中**随机**抽 2 张，**同一题内两页头像不得重复**；
   不同题之间可复用。
2. Academic Discussion：从 `avatar-d-*` 中**随机**抽 3 张（教授 + 2 学生），
   **同一题内不得重复**；不同题可复用。
3. 无头像时不渲染图片，回退为图标占位。

## 字段映射

| Markdown 字段 | 编译后 | 适用题型 | 头像子集 |
|---|---|---|---|
| `speaker_a_image: avatar-bs-3.png` | `question.speakerAImage` | build-sentence | bs |
| `speaker_b_image: avatar-bs-5.png` | `question.speakerBImage` | build-sentence | bs |
| `professor_image: avatar-d-1.png` | `question.professorImage` | academic-discussion | d |
| `student_a_image: avatar-d-2.png` | `students[0].image` | academic-discussion | d |
| `student_b_image: avatar-d-4.png` | `students[1].image` | academic-discussion | d |
