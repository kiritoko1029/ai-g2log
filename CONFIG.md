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
  },
  "prompt_template": "请根据下面的Git提交记录，用3-5句话简洁地总结一天的工作内容。\n\n这些是{author}在{since}至{until}期间的Git提交记录:\n\n{log_content}\n\n..."
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
- 自动处理功能：当配置了多个仓库时，不指定`--repo`参数会自动处理所有仓库并汇总结果
- 使用方法：
  - 处理所有仓库：`git-user-log --ai-summary`
  - 指定单个仓库：`git-user-log --repo="前端" --ai-summary`
- 管理命令：
  - 添加仓库：`git-user-log --add-repo="前端" --path="/path/to/frontend"`
  - 删除仓库：`git-user-log --remove-repo="前端"`
  - 查看所有：`git-user-log --list-repos"`

### AI提示词模板

```json
"prompt_template": "请根据下面的Git提交记录，用3-5句话简洁地总结一天的工作内容。\n\n这些是{author}在{since}至{until}期间的Git提交记录:\n\n{log_content}\n\n..."
```

- 自定义AI总结功能的提示词模板
- 支持的变量：
  - `{author}`: 提交作者
  - `{since}`: 起始日期
  - `{until}`: 结束日期
  - `{log_content}`: Git提交日志内容
- 设置方式：
  - 通过配置文件直接设置
  - 通过命令行从文件读取：`git-user-log --set-prompt-template="my-prompt.txt"`

## 配置优先级

1. 命令行参数具有最高优先级
2. 配置文件中的设置作为默认值
3. 如果都未指定，则部分参数会使用程序内置默认值

## 多仓库自动处理功能

当配置文件中设置了多个仓库，且运行命令时不指定`--repo`参数时，工具会：

1. 自动获取所有配置仓库的Git提交记录
2. 合并所有仓库的日志，并在每条记录前加上仓库标识
3. 如果使用`--ai-summary`，将所有仓库的日志一起发送给AI进行总结
4. 生成包含所有项目工作内容的统一总结

这个功能特别适合：
- 同时负责多个项目的开发人员
- 需要生成包含所有项目的每日工作总结
- 希望减少重复操作的场景

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
  },
  "prompt_template": "请根据下面的Git提交记录，用3-5句话简洁地总结一天的工作内容。\n\n这些是{author}在{since}至{until}期间的Git提交记录:\n\n{log_content}\n\n要求：\n1. 按项目和日期组织内容\n2. 每个项目每天的工作内容用3-5句话概括\n3. 使用清晰、专业但不晦涩的语言"
}
```

## 使用技巧

1. 设置适合自己的默认作者和时间范围，可以直接使用`git-user-log --ai-summary`生成今日工作总结
2. 为经常使用的项目配置别名，避免每次输入完整路径
3. 可以按团队、项目类型等方式组织仓库别名，便于管理
4. 自定义AI提示词模板，使生成的工作总结更符合自己的风格和需求
5. 对于跨多个仓库工作的开发者，利用多仓库自动处理功能大幅提高效率
6. 建议保持API密钥的安全，不要将含有真实API密钥的配置文件提交到公共代码仓库 