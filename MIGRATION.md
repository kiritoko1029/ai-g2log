# G2Log 配置文件迁移指南

## 🎯 变更概述

从 v1.6.0 开始，g2log 的配置文件格式和位置进行了重大升级：

### 主要变更

1. **新格式**: JSON → JSONC (支持注释)
2. **新位置**: `~/.git-user-log-config.json` → `~/.g2log/config.jsonc`
3. **新增 Schema**: `~/.g2log/schema.json`（自动从项目目录复制，用于配置验证）

## 📦 自动迁移

程序会在首次运行时自动检测并迁移旧配置文件：

### 迁移场景

1. **旧位置 → 新位置**
   - 从: `~/.git-user-log-config.json`
   - 到: `~/.g2log/config.jsonc`

2. **旧格式 → 新格式**
   - 从: `~/.g2log/config.json`
   - 到: `~/.g2log/config.jsonc`

### 迁移过程

程序会自动：
1. ✅ 检测旧配置文件
2. ✅ 读取并解析现有配置
3. ✅ 添加 `$schema` 字段（指向 schema.json，用于 VS Code 智能提示）
4. ✅ 转换为 JSONC 格式
5. ✅ 保存到新位置（`$schema` 在第一行）
6. ✅ 复制 `schema.json` 到配置目录（使 `$schema` 引用生效）
7. ✅ 保留原始配置文件（可手动删除）

### 配置文件中的 $schema

新生成的配置文件会在第一行包含 `$schema` 字段：

```jsonc
{
  "$schema": "./schema.json",
  "default_author": "",
  ...
}
```

**作用：**
- VS Code 会自动识别 schema 并提供智能提示
- 支持配置验证和自动补全
- 帮助发现配置错误

## 📝 新配置文件示例

```jsonc
{
  // ============================================================================
  // G2Log 配置文件
  // ============================================================================

  // 默认 Git 提交者名称
  "default_author": "张三",

  // 当前使用的 AI 配置档案
  "current_profile": "zhipu",

  // AI 服务配置档案
  "profiles": {
    "zhipu": {
      "api_key": "your-api-key",
      "api_base_url": "https://open.bigmodel.cn/api/paas/v4",
      "model": "glm-4.7",
      "stream": true,
      "enable_thinking": true
    }
  },

  // Git 仓库映射表
  "repositories": {
    "前端": "/path/to/frontend",
    "后端": "/path/to/backend"
  }
}
```

## 🔧 JSONC 解析器

### 功能特性

- ✅ 支持单行注释 `// ...`
- ✅ 支持多行注释 `/* ... */`
- ✅ 支持尾随逗号
- ✅ 完全兼容标准 JSON

### 实现方式

程序内置了 JSONC 解析器，无需额外依赖：

```javascript
// 移除注释和尾随逗号
function parseJSONC(content) {
  let jsonc = content.replace(/\/\/.*$/gm, '');        // 单行注释
  jsonc = jsonc.replace(/\/\*[\s\S]*?\*\//g, '');     // 多行注释
  jsonc = jsonc.replace(/,\s*([}\]])/g, '$1');        // 尾随逗号
  return JSON.parse(jsonc);
}
```

## 📋 Schema 验证

### Schema 文件位置

- **用户目录**: `~/.g2log/schema.json`（自动复制，推荐使用）
- **项目目录**: `schema.json`（源文件）

程序首次运行时会自动将 `schema.json` 从项目目录复制到 `~/.g2log/` 目录。

### 使用方法

1. **VS Code**: 自动补全和验证
   - 打开 `~/.g2log/config.jsonc`
   - VS Code 会自动识别 `$schema` 字段并加载 schema
   - 提供智能提示、自动补全和实时验证

2. **命令行验证** (使用 ajv-cli):
   ```bash
   # 使用配置目录中的 schema
   npx ajv validate -s ~/.g2log/schema.json -d ~/.g2log/config.jsonc
   ```

## 🚀 快速开始

### 首次使用

```bash
# 直接运行，会自动触发配置向导
g2log

# 或手动启动配置向导
g2log --config
```

### 手动配置

1. 编辑配置文件:
   ```bash
   # macOS/Linux
   nano ~/.g2log/config.jsonc

   # Windows
   notepad %USERPROFILE%\.g2log\config.jsonc
   ```

2. 填写必要信息:
   - 设置 `default_author`（你的 Git 提交者名称）
   - 选择 `current_profile`（deepseek/openai/zhipu/moonshot）
   - 在 `profiles` 中填写对应的 API 密钥

3. 添加仓库:
   ```bash
   g2log --add-repo="前端" --path="/path/to/frontend"
   ```

## 🔍 故障排查

### 问题: 配置文件未找到

**原因**: 配置文件仍在旧位置

**解决**:
```bash
# 手动触发迁移
g2log --help
```

### 问题: JSONC 解析失败

**原因**: 配置文件格式错误

**解决**:
```bash
# 使用备份恢复
g2log --fix-config

# 或重置为默认配置
rm ~/.g2log/config.jsonc
g2log --config
```

### 问题: 注释导致解析错误

**原因**: 字符串内的注释也会被移除

**解决**: 避免在字符串值中使用 `//` 或 `/* */`

## 📚 相关文件

- **主程序**: `git-user-log.js`
- **配置模板**: `config.jsonc.template`
- **Schema**: `schema.json`
- **迁移指南**: `MIGRATION.md` (本文件)
- **用户文档**: `README.md`
- **发布指南**: `PUBLISH.md`
- **架构文档**: `CLAUDE.md`

## ⚠️ 注意事项

1. **API 密钥安全**: 配置文件包含敏感信息，请勿提交到版本控制
2. **向后兼容**: 旧版配置会自动迁移，无需手动操作
3. **备份建议**: 迁移后可手动删除旧配置文件
4. **注释支持**: 可以在配置文件中添加注释说明

## 🔄 版本历史

- **v1.6.0**: 引入 JSONC 格式和新的配置目录结构
- **v1.5.x**: 旧版 JSON 格式配置

## 💡 最佳实践

1. **使用注释**: 在配置文件中添加说明，方便后续维护
2. **版本控制**: 将 `config.jsonc.template` 纳入版本控制
3. **环境隔离**: 不同环境使用不同的 profile
4. **定期备份**: 定期备份配置文件
5. **验证配置**: 使用 schema 验证配置文件格式

---

如有问题，请查看 [README.md](README.md)或提交 [Issue](https://github.com/chenxiangcai/git-user-log/issues)。
