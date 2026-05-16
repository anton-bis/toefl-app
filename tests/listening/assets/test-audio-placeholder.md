# 测试音频文件占位符

由于测试需要音频文件，这里提供几种选择：

## 1. 在线测试音频（推荐）
- URL: `https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3`
- 时长: 5秒
- 格式: MP3

## 2. 本地测试音频
如需本地文件，请在此目录下放置：
- `conversation1.mp3` - 短对话示例
- `announcement1.mp3` - 公告示例  
- `lecture1.mp3` - 学术讲座示例

## 3. 生成测试音频
可以使用以下工具生成测试音频：
- `ffmpeg -f lavfi -i sine=frequency=1000:duration=30 -c:a libmp3lame conversation1.mp3`
- 或使用在线音频生成器

## 测试说明
测试HTML文件默认使用在线音频，确保网络连接正常。
如需测试离线功能，请下载音频文件到本地并修改测试脚本中的URL。