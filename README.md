# Git 用户日志工具

这是一个基于 Node.js 开发的命令行工具，用于获取指定用户在特定时间范围内的 Git 提交记录。

## 功能特点

- 🔍 查询特定用户的 Git 提交记录
- 📅 支持灵活的时间范围过滤
- 📊 提供详细的文件修改统计信息
- 🎨 彩色命令行输出提升可读性
- 📁 支持将结果导出到文件
- 🔄 进度显示和友好的用户界面
- 🔧 可自定义输出格式
- 📝 查看完整提交详情和补丁信息
- 🌿 显示提交所属分支和相关标签
- ✂️ 支持极简输出模式（仅显示日期和提交信息）
- 🤖 支持AI总结功能，自动生成3-5句话的工作总结
- ⚙️ 支持配置文件设置默认参数和多仓库别名

## 安装

### 全局安装（推荐）

```bash
npm install -g git-user-log
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
node git-user-log.js --author="用户名" --since="2023-01-01" --until="2023-12-31"
```

## 使用方法

```bash
git-user-log [--author="用户名"] [--since="2023-01-01"] [--until="2023-12-31"] [选项]
```

如果配置了默认值，可以直接使用：

```bash
git-user-log --ai-summary
```

### 配置管理

```bash
# 设置默认作者
git-user-log --set-default-author="张三"

# 设置默认时间范围
git-user-log --set-time-range --since="yesterday" --until="today"

# 添加仓库别名
git-user-log --add-repo="frontend" --path="/path/to/frontend-project"

# 删除仓库别名
git-user-log --remove-repo="frontend"

# 列出所有配置的仓库
git-user-log --list-repos

# 设置API密钥
git-user-log --set-api-key="your-api-key-here"
```

### 主要参数

- `--author="用户名"` - 指定 Git 提交作者（如未指定，使用配置中的默认值）
- `--since="YYYY-MM-DD"` - 起始日期（如未指定，使用配置中的默认值）
- `--until="YYYY-MM-DD"` - 结束日期（如未指定，使用配置中的默认值）
- `--repo="alias或路径"` - Git 仓库路径或配置的别名，默认为当前目录

### 输出选项

- `--format="格式"` - 自定义输出格式，默认为详细格式
- `--brief` - 使用简洁格式（仅显示哈希、作者、日期和提交信息）
- `--simple` - 使用极简格式（仅显示日期和提交信息）
- `--output="文件路径"` - 将输出保存到指定文件
- `--stats` - 包含文件修改统计信息
- `--patch` - 显示每个提交的具体代码变更
- `--no-merges` - 排除合并提交
- `--max-count=N` - 限制显示的提交数量
- `--branches` - 显示每个提交所属的分支
- `--tags` - 显示提交相关的标签
- `--no-color` - 禁用彩色输出
- `--ai-summary` - 使用AI总结提交记录（3-5句话概括）
- `--help` - 显示帮助信息

### 日期格式

支持 Git 的日期格式，例如：

- 具体日期：`2023-01-01`
- 相对日期：`1 month ago`, `last week`, `yesterday`
- 特殊关键词：`now`, `today`, `last Monday`

## 配置文件

配置文件保存在用户主目录下的 `.git-user-log-config.json`，包含以下内容：

```json
{
  "deepseek_api_key": "your-api-key-here",
  "default_author": "张三",
  "default_since": "today",
  "default_until": "today",
  "repositories": {
    "frontend": "/path/to/frontend-project",
    "backend": "/path/to/backend-project"
  }
}
```

## AI总结功能

AI总结功能会将Git提交记录自动整理成3-5句话的工作总结：

```bash
# 使用配置文件中的默认值
git-user-log --ai-summary

# 指定具体参数
git-user-log --author="张三" --since="today" --until="today" --repo="frontend" --ai-summary

# 保存结果到文件
git-user-log --ai-summary --output="today-summary.md"
```

## 示例

### 基本用法

```bash
# 使用配置的默认值生成今日工作总结
git-user-log --ai-summary

# 使用仓库别名查询最近一周的提交
git-user-log --repo="frontend" --since="1 week ago" --until="today" --simple

# 查询多个仓库并生成总结
git-user-log --repo="frontend" --ai-summary --output="frontend-summary.md"
git-user-log --repo="backend" --ai-summary --output="backend-summary.md"

# 自定义查询
git-user-log --author="张三" --since="yesterday" --until="today" --repo="frontend" --stats --ai-summary
```

## 注意事项

- 确保已安装 Git 并可在命令行中使用
- 确保指定的仓库路径或别名有效
- 使用AI总结功能需要有效的DeepSeek API密钥
- 配置文件保存在用户主目录下的 `.git-user-log-config.json` 文件中

## 问题反馈

如果遇到任何问题或有改进建议，请提交 issue 或联系开发者。

## 许可证

MIT 