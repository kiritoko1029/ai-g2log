# Git用户日志工具配置说明

Git用户日志工具支持通过配置文件来简化命令行参数输入，提高使用效率。配置文件默认保存在用户主目录下的 `.git-user-log-config.json`。

## 配置文件结构

配置文件采用JSON格式，包含以下主要配置项：

```json
{
  "deepseek_api_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "default_author": "张三",
  "default_since": "yesterday",
  "default_until": "today",
  "repositories": {
    "前端": "/path/to/frontend-project",
    "后端": "/path/to/backend-project"
  }
}
```

## 配置项说明

### API密钥设置

```json
"deepseek_api_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

- 用于AI总结功能
- 从DeepSeek官网获取API密钥后填入
- 也可通过命令行设置：`git-user-log --set-api-key="YOUR_API_KEY"`

### 默认作者

```json
"default_author": "张三"
```

- 设置默认的Git提交作者名称
- 如果命令行不指定`--author`参数，将使用此默认值
- 也可通过命令行设置：`git-user-log --set-default-author="张三"`

### 默认时间范围

```json
"default_since": "yesterday",
"default_until": "today"
```

- 设置查询Git提交记录的默认时间范围
- 支持Git支持的各种时间格式：
  - 具体日期：`2023-01-01`
  - 相对日期：`1 week ago`, `yesterday`
  - 特殊关键词：`today`, `last Monday`
- 也可通过命令行设置：`git-user-log --set-time-range --since="yesterday" --until="today"`

### 仓库配置

```json
"repositories": {
  "前端": "/Users/username/Projects/frontend-project",
  "后端": "/Users/username/Projects/backend-project",
  "移动端": "/Users/username/Projects/mobile-app"
}
```

- 设置仓库路径别名，方便快速切换不同项目
- 键值对格式：`"别名": "完整路径"`
- 使用方法：`git-user-log --repo="前端" --ai-summary`
- 管理命令：
  - 添加仓库：`git-user-log --add-repo="前端" --path="/path/to/frontend"`
  - 删除仓库：`git-user-log --remove-repo="前端"`
  - 查看所有：`git-user-log --list-repos`

## 配置优先级

1. 命令行参数具有最高优先级
2. 配置文件中的设置作为默认值
3. 如果都未指定，则部分参数会使用程序内置默认值

## 配置示例

### 基础配置示例

```json
{
  "deepseek_api_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "default_author": "张三",
  "default_since": "today",
  "default_until": "today"
}
```

### 带多个仓库的完整配置

```json
{
  "deepseek_api_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "default_author": "张三",
  "default_since": "yesterday",
  "default_until": "today",
  "repositories": {
    "前端": "/Users/username/Projects/frontend-project",
    "后端": "/Users/username/Projects/backend-project",
    "移动端": "/Users/username/Projects/mobile-app",
    "文档": "/Users/username/Projects/documentation",
    "工具": "/Users/username/Projects/tools"
  }
}
```

## 使用技巧

1. 设置适合自己的默认作者和时间范围，可以直接使用`git-user-log --ai-summary`生成今日工作总结
2. 为经常使用的项目配置别名，避免每次输入完整路径
3. 可以按团队、项目类型等方式组织仓库别名，便于管理
4. 建议保持API密钥的安全，不要将含有真实API密钥的配置文件提交到公共代码仓库 