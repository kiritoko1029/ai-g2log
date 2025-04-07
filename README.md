# AI-Git 用户日报生成工具

这是一个基于 Node.js 开发的命令行工具，用于获取指定用户在特定时间范围内的 Git 提交记录，并通过 AI 自动生成工作总结。

## 功能特点

- 🔍 自动从配置文件读取用户信息和仓库路径
- 📅 支持灵活的时间范围过滤
- 🎨 彩色命令行输出提升可读性
- 📁 支持将结果导出到文件
- 🔄 进度显示和友好的用户界面
- 🤖 自动生成3-5句话的工作总结
- ⚙️ 支持配置文件设置默认参数和多仓库别名
- 🌊 支持流式输出AI响应，实时查看生成过程
- 🔌 支持多种AI提供商API(OpenAI, DeepSeek)
- 🚀 支持通过npx直接运行，无需安装

## 安装与使用

### 通过 NPX 直接运行（无需安装）

```bash
npx g2log [选项]
```

### 全局安装（推荐长期使用）

```bash
npm install -g g2log
```

然后使用:

```bash
g2log [选项]
```

或者：

```bash
# 从本地目录全局安装
git clone https://github.com/yourusername/git-user-log.git
cd git-user-log
npm install -g
```

### 临时使用

无需安装，直接使用 Node.js 运行脚本：

```bash
node git-user-log.js
```

## 使用方法

```bash
g2log [--since="2023-01-01"] [--until="2023-12-31"] [选项]
```

或通过npx直接运行:

```bash
npx g2log [--since="2023-01-01"] [--until="2023-12-31"] [选项]
```

### 命令行参数

时间参数:
- `--since="YYYY-MM-DD"` - 起始日期（如未指定，使用配置中的默认值）
- `--until="YYYY-MM-DD"` - 结束日期（如未指定，使用配置中的默认值）
- `--days=N` - 查询最近N天的记录

显示设置:
- `--no-color` - 禁用彩色输出
- `--save` 或 `--output="文件路径"` - 将输出保存到文件
- `--debug` - 显示调试信息
- `--show-prompt` - 显示完整的prompt内容
- `--version` - 显示当前版本号

配置管理命令:
- `--config` - 启动交互式配置向导
- `--set-api-key="KEY"` - 设置API密钥
- `--set-ai-model="MODEL"` - 设置AI模型（默认: deepseek-chat）
- `--set-api-provider="PROVIDER"` - 设置API提供商（deepseek或openai）
- `--set-api-url="URL"` - 设置API基础URL
- `--set-default-author="NAME"` - 设置默认作者
- `--set-time-range --since="DATE" --until="DATE"` - 设置默认时间范围
- `--add-repo="ALIAS" --path="/path/to/repo"` - 添加仓库配置
- `--remove-repo="ALIAS"` - 删除仓库配置
- `--list-repos` - 列出所有配置的仓库
- `--set-prompt-template="file.txt"` - 从文件设置AI总结的prompt模板
- `--reset-prompt-template` - 重置AI总结的prompt模板为默认值
- `--fix-config` - 修复配置文件格式问题
- `--uninstall` - 删除g2log配置文件
- `--help` - 显示帮助信息

### 配置文件

配置文件保存在用户主目录下的 `.git-user-log-config.json`，包含以下内容：

```json
{
  "api_key": "your-api-key-here",
  "default_author": "张三",
  "default_since": "7 days ago",
  "default_until": "today",
  "model": "deepseek-chat",
  "api_base_url": "https://api.deepseek.com",
  "api_provider": "deepseek",
  "repositories": {
    "前端": "/path/to/frontend-project",
    "后端": "/path/to/backend-project"
  },
  "prompt_template": "请根据下面的Git提交记录，用3-5句话简洁地总结一天的工作内容。\n\n以下是Git提交记录:\n\n{{GIT_LOGS}}\n\n要求：\n1. 按项目和日期组织内容\n2. 每个项目每天的工作内容用3-5句话概括\n3. 使用清晰、专业但不晦涩的语言\n4. 突出重要的功能开发、问题修复和优化改进\n5. 适合放入工作日报的简洁描述\n6. 输出格式为：【日期】：\n                  【项目名称】- 【工作内容概述】\n                  【项目名称】- 【工作内容概述】\n7. 回复不要出现多余的内容，非必要不要用markdown格式"
}
```

## 配置优先级

1. 命令行参数优先级最高（仅支持时间范围参数）
2. 配置文件中的设置作为默认值
3. 内置默认值作为最低优先级

## 示例

```bash
# 使用配置的默认值生成今日工作总结
g2log

# 指定时间范围
g2log --since="2023-01-01" --until="2023-12-31"

# 使用本地仓库
g2log --local

# 保存结果到文件
g2log --output="today-summary.md"

# 设置配置
g2log --set-default-author="张三"
g2log --set-ai-model="gpt-3.5-turbo"
g2log --set-api-provider="openai"
g2log --set-api-url="https://api.openai.com"
g2log --add-repo="前端" --path="/path/to/frontend-project"
```

## 日期格式

支持 Git 的日期格式，例如：

- 具体日期：`2023-01-01`
- 相对日期：`1 month ago`, `last week`, `yesterday`
- 特殊关键词：`now`, `today`, `last Monday`

## 多仓库自动处理功能

工具默认会处理配置文件中的所有仓库：

1. 自动获取所有配置仓库的Git提交记录
2. 合并所有仓库的日志，并在每条记录前加上仓库标识
3. 将所有仓库的日志一起发送给AI进行总结
4. 生成包含所有项目工作内容的统一总结

如果希望仅处理本地仓库，可以使用 `--local` 参数。

## 注意事项

- 确保已安装 Git 并可在命令行中使用
- 确保配置文件中有正确的作者名称和仓库路径
- 使用AI总结功能需要有效的DeepSeek API密钥
- 配置文件保存在用户主目录下的 `.git-user-log-config.json` 文件中

## 问题反馈

如果遇到任何问题或有改进建议，请提交 issue 或联系开发者。

## 许可证

MIT 

## AI提供商支持

工具支持多种AI提供商的API：

1. **DeepSeek API (默认)**
   - 基础URL: https://api.deepseek.com
   - 推荐模型: deepseek-chat

2. **OpenAI API**
   - 基础URL: https://api.openai.com
   - 推荐模型: gpt-3.5-turbo, gpt-4

切换提供商示例：
```bash
# 切换到OpenAI
g2log --set-api-provider="openai"
g2log --set-api-url="https://api.openai.com"
g2log --set-ai-model="gpt-3.5-turbo"

# 切换回DeepSeek
g2log --set-api-provider="deepseek"
g2log --set-api-url="https://api.deepseek.com"
g2log --set-ai-model="deepseek-chat"
```

## 流式输出

当使用OpenAI API时，工具会启用流式输出功能，让您能够实时看到AI生成内容的过程，无需等待整个响应完成。这提供了更好的用户体验，特别是当处理大量提交记录时。 