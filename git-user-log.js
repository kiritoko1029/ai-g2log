#!/usr/bin/env node

/**
 * 获取指定用户和时间范围的Git日志
 * 使用方法: 
 * - 全局安装: g2log [选项]
 * - NPX直接运行: npx g2log [选项]
 * 
 * 常用选项:
 * [--author="用户名"] [--since="2023-01-01"] [--until="2023-12-31"] 
 * [--repo="alias或路径"] [--format="格式"] [--output="文件路径"] [--stats] [--help]
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const readline = require('readline');
// 改用动态导入
let ora;
import('ora').then(module => {
  ora = module.default;
}).catch(err => {
  console.error('无法加载ora模块:', err);
});

// 检测是否通过npx运行
const isRunningWithNpx = process.env.npm_lifecycle_event === 'npx' || 
                        process.env.npm_execpath?.includes('npx') || 
                        process.env.npm_command === 'exec';

// 预解析命令行参数，以便在早期决定是否使用颜色
const rawArgs = process.argv.slice(2);
const forceColor = rawArgs.includes('--color') || rawArgs.includes('--force-color');
const disableColor = rawArgs.includes('--no-color');

// 修改颜色显示逻辑 - 默认就显示颜色，只有pipe时才根据TTY判断，或显式禁用时才不显示
const isPiped = !process.stdout.isTTY;
const shouldUseColor = (isPiped ? forceColor : true) && !disableColor;

// ANSI 颜色代码定义
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// 优化的彩色输出函数
function colorize(text, color) {
  // 如果不使用颜色或没有对应颜色代码，直接返回原文本
  if (!shouldUseColor || !colors[color]) return text;
  return colors[color] + text + colors.reset;
}

// Markdown 格式化函数 - 将 Markdown 转换为带颜色的终端输出
function formatMarkdown(text) {
  if (!shouldUseColor) return text;

  let lines = text.split('\n');
  let result = [];

  for (let line of lines) {
    // 标题处理
    if (line.startsWith('# ')) {
      result.push(colorize(line.substring(2), 'bright') + '\n');
    } else if (line.startsWith('## ')) {
      result.push(colorize(line.substring(3), 'cyan') + '\n');
    } else if (line.startsWith('### ')) {
      result.push(colorize(line.substring(4), 'green') + '\n');
    } else if (line.startsWith('#### ')) {
      result.push(colorize(line.substring(5), 'yellow') + '\n');
    }
    // 列表处理
    else if (line.match(/^\s*[-*+]\s/)) {
      const indent = line.match(/^\s*/)[0];
      const content = line.replace(/^\s*[-*+]\s/, '');
      result.push(indent + '• ' + content + '\n');
    } else if (line.match(/^\s*\d+\.\s/)) {
      result.push(line + '\n');
    }
    // 代码块
    else if (line.startsWith('```')) {
      result.push(colorize(line, 'dim') + '\n');
    }
    // 粗体
    else if (line.includes('**')) {
      let formattedLine = line.replace(/\*\*(.*?)\*\*/g, (match, p1) => {
        return colorize(p1, 'bright');
      });
      result.push(formattedLine + '\n');
    }
    // 斜体
    else if (line.includes('*')) {
      let formattedLine = line.replace(/\*(.*?)\*/g, (match, p1) => {
        return colorize(p1, 'cyan');
      });
      result.push(formattedLine + '\n');
    }
    // 分隔线
    else if (line.match(/^---+$/)) {
      result.push(colorize(line, 'dim') + '\n');
    }
    // 普通文本
    else {
      result.push(line + '\n');
    }
  }

  return result.join('');
}

// 将文本转换为HTML格式
function textToHtml(text, title = 'Git工作总结') {
  const date = new Date().toLocaleString('zh-CN');

  // 处理文本格式
  let html = text
    // 转义HTML特殊字符
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 处理标题
    .replace(/^【(.*?)】/gm, '<h3>$1</h3>')
    // 处理列表项
    .replace(/^[\s]*[-•]\s+(.*)$/gm, '<li>$1</li>')
    // 处理段落
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2c3e50;
      margin-bottom: 10px;
      font-size: 28px;
    }
    .meta {
      color: #7f8c8d;
      font-size: 14px;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    h3 {
      color: #3498db;
      margin-top: 25px;
      margin-bottom: 15px;
      font-size: 18px;
      padding-left: 10px;
      border-left: 4px solid #3498db;
    }
    p {
      margin-bottom: 15px;
      line-height: 1.8;
    }
    li {
      margin-bottom: 8px;
      margin-left: 20px;
      line-height: 1.6;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #95a5a6;
      font-size: 12px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 ${title}</h1>
    <div class="meta">生成时间: ${date}</div>
    <p>${html}</p>
    <div class="footer">
      由 g2log 自动生成 | Git工作总结工具
    </div>
  </div>
</body>
</html>`;
}

// 生成HTML文件并保存
function generateHtmlAndSave(content, title = 'Git工作总结', author = '', since = '', until = '') {
  const path = require('path');
  const fs = require('fs');

  // 生成详细的文件名：工作总结_{作者}_{起始日期}_to_{结束日期}.html
  const authorName = author || '团队';

  // 将日期格式化为 YYYY-MM-DD
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toISOString().split('T')[0];
  };

  const sinceDate = formatDate(since);
  const untilDate = formatDate(until);

  const filename = `工作总结_${authorName}_${sinceDate}_to_${untilDate}.html`;
  const filepath = path.join(CONFIG_DIR, filename);

  // 写入HTML文件
  const html = textToHtml(content, title);
  fs.writeFileSync(filepath, html, 'utf-8');

  console.log(colorize(`\n✅ HTML文件已保存: ${filepath}`, 'green'));
  console.log(colorize(`💡 提示: 可以在浏览器中打开查看`, 'dim'));
  return filepath;
}

// 生成HTML文件并在浏览器中打开
function generateAndOpenHtml(content, title = 'Git工作总结') {
  const os = require('os');
  const path = require('path');
  const fs = require('fs');
  const { execSync } = require('child_process');

  // 创建临时目录
  const tmpDir = path.join(os.tmpdir(), 'g2log');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // 生成文件名（包含时间戳）
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `git-summary-${timestamp}.html`;
  const filepath = path.join(tmpDir, filename);

  // 写入HTML文件
  const html = textToHtml(content, title);
  fs.writeFileSync(filepath, html, 'utf-8');

  console.log(colorize(`\n📄 HTML文件已生成: ${filepath}`, 'cyan'));
  console.log(colorize(`💡 提示: 文件保存在临时目录，重启电脑后可能会被清除`, 'dim'));

  // 在浏览器中打开
  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    command = `open '${filepath}'`;
  } else if (platform === 'win32') {
    command = `start '' '${filepath}'`;
  } else {
    command = `xdg-open '${filepath}'`;
  }

  console.log(colorize(`🌐 正在打开浏览器... (平台: ${platform})`, 'cyan'));

  try {
    execSync(command, { stdio: 'inherit' });
    console.log(colorize('✅ 已在浏览器中打开', 'green'));
  } catch (error) {
    console.log(colorize(`\n⚠️  无法自动打开浏览器`, 'yellow'));
    console.log(colorize(`命令: ${command}`, 'dim'));
    console.log(colorize(`错误: ${error.message}`, 'red'));
    console.log(colorize(`\n请手动打开文件:`, 'yellow'));
    console.log(colorize(filepath, 'bright'));
  }

  return filepath;
}

// 配置文件路径
const CONFIG_DIR = path.join(os.homedir(), '.g2log');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.jsonc');
const SCHEMA_PATH = path.join(CONFIG_DIR, 'schema.json');  // Schema 文件路径（用于 $schema 引用）
const PROJECT_SCHEMA_PATH = path.join(__dirname, 'schema.json');  // 项目中的 schema 文件
const OLD_CONFIG_PATH = path.join(os.homedir(), '.git-user-log-config.json');

// 默认配置
const DEFAULT_CONFIG = {
  default_author: '',
  default_since: 'today',
  default_until: 'today',
  current_profile: 'deepseek', // 当前使用的AI配置名称
  profiles: {
    deepseek: {
      api_key: '',
      api_base_url: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      temperature: 0.5,
      max_tokens: 20480,
      enable_thinking: false
    },
    openai: {
      api_key: '',
      api_base_url: 'https://api.openai.com',
      model: 'gpt-4',
      temperature: 0.5,
      max_tokens: 2048,
      enable_thinking: false
    },
    zhipu: {
      api_key: '',
      api_base_url: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-4',
      temperature: 0.7,
      max_tokens: 2048,
      enable_thinking: false
    }
  },
  repositories: {},
  prompt_template: `
请根据下面的Git提交记录生成工作总结。请根据实际提交的内容量和重要性灵活调整总结的详细程度。

以下是Git提交记录:

{{GIT_LOGS}}

要求：
1. 按日期和项目组织内容
2. 根据提交量自适应调整总结详细程度：
   - 提交较少时：简明扼要，突出关键成果
   - 提交较多时：详细列出各项工作，确保重要内容不遗漏
   - 重要功能开发、重大bug修复应详细说明
3. 使用清晰、专业但不晦涩的语言
4. 突出重要的功能开发、问题修复和优化改进
5. 适合放入工作日报，便于团队了解工作进展和复制
6. 严格按照以下输出格式（每个项目一行，项目和内容在同一行）：
   【日期】：YYYY-MM-DD
   项目名称1: 工作内容描述
   项目名称2: 工作内容描述
   项目名称3: 工作内容描述

   【日期】：YYYY-MM-DD
   项目名称1: 工作内容描述
   项目名称2: 工作内容描述
7. 不同日期之间空一行分隔
8. 同一天的不同项目直接换行，不空行
9. 回复不要出现多余的内容，不要使用markdown格式，不要使用列表符号
`
};

// ============================================================================
// JSONC (JSON with Comments) 解析器
// ============================================================================

/**
 * 解析 JSONC 格式的内容（支持注释和尾随逗号）
 * @param {string} content - JSONC 格式的字符串
 * @returns {object} 解析后的 JavaScript 对象
 */
function parseJSONC(content) {
  try {
    // 先尝试直接解析标准 JSON（处理控制字符等问题）
    return JSON.parse(content);
  } catch (error) {
    // 如果标准解析失败，尝试 JSONC 格式
    try {
      // 移除单行注释 // ...
      let jsonc = content.replace(/\/\/.*$/gm, '');

      // 移除多行注释 /* ... */
      jsonc = jsonc.replace(/\/\*[\s\S]*?\*\//g, '');

      // 移除字符串外的尾随逗号
      // 这个正则处理: "key": value,  或  ],  或  },
      jsonc = jsonc.replace(/,\s*([}\]])/g, '$1');

      // 解析 JSON
      return JSON.parse(jsonc);
    } catch (jsoncError) {
      throw new Error(`JSONC 解析失败: ${jsoncError.message}`);
    }
  }
}

/**
 * 将对象序列化为 JSONC 格式（带格式的 JSON）
 * @param {object} obj - 要序列化的对象
 * @returns {string} JSONC 格式的字符串
 */
function stringifyJSONC(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

/**
 * 复制 schema.json 到配置目录
 * @returns {boolean} 是否成功复制
 */
function copySchemaFile() {
  try {
    // 如果 schema.json 已存在，跳过
    if (fs.existsSync(SCHEMA_PATH)) {
      return true;
    }

    // 检查项目目录的 schema 是否存在
    if (!fs.existsSync(PROJECT_SCHEMA_PATH)) {
      // 如果项目目录不存在 schema.json，静默跳过
      return false;
    }

    // 确保目标目录存在
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // 复制文件
    fs.copyFileSync(PROJECT_SCHEMA_PATH, SCHEMA_PATH);
    console.log(colorize(`✅ Schema 文件已复制: ${SCHEMA_PATH}`, 'green'));
    return true;
  } catch (error) {
    // 复制失败不影响主流程，仅输出调试信息
    if (process.env.DEBUG) {
      console.error(colorize(`Schema 复制失败: ${error.message}`, 'dim'));
    }
    return false;
  }
}

/**
 * 迁移旧的 JSON 配置文件到新的 JSONC 格式
 * @param {string} oldPath - 旧配置文件路径
 * @param {string} newPath - 新配置文件路径
 * @returns {boolean} 是否成功迁移
 */
function migrateToJSONC(oldPath, newPath) {
  try {
    if (!fs.existsSync(oldPath)) return false;

    console.log(colorize('📦 检测到旧配置文件，正在迁移到新位置...', 'yellow'));
    console.log(colorize(`   旧位置: ${oldPath}`, 'dim'));

    // 读取旧配置
    const oldContent = fs.readFileSync(oldPath, 'utf-8');

    // 尝试解析（支持旧 JSON 和新 JSONC）
    let config;
    try {
      config = parseJSONC(oldContent);
    } catch (error) {
      throw new Error(`配置文件解析失败: ${error.message}`);
    }

    // 确保目标目录存在
    const targetDir = path.dirname(newPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 添加 $schema 字段（如果不存在），并确保它在第一行
    if (!config.$schema) {
      // 创建新对象，先放入 $schema，再放入其他属性
      const configWithSchema = {
        $schema: './schema.json'
      };
      // 合并原有配置
      Object.assign(configWithSchema, config);
      config = configWithSchema;
    }

    // 直接保存为 JSONC 格式（带缩进的标准 JSON）
    // $schema 字段在第一行，方便编辑器识别
    fs.writeFileSync(newPath, stringifyJSONC(config), 'utf-8');

    console.log(colorize(`   新位置: ${newPath}`, 'dim'));
    console.log(colorize('✅ 配置文件已迁移到 JSONC 格式', 'green'));

    // 复制 schema.json 到配置目录（使 $schema 引用生效）
    copySchemaFile();

    return true;
  } catch (error) {
    console.error(colorize(`迁移失败: ${error.message}`, 'red'));
    return false;
  }
}

// 加载配置
function loadConfig() {
  try {
    // 确保配置目录存在
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // 检查是否需要迁移旧配置文件到新的 JSONC 格式
    // 情况1: 旧位置 (~/.git-user-log-config.json) -> 新位置 (~/.g2log/config.jsonc)
    if (fs.existsSync(OLD_CONFIG_PATH) && !fs.existsSync(CONFIG_PATH)) {
      migrateToJSONC(OLD_CONFIG_PATH, CONFIG_PATH);
    }

    // 情况2: 旧格式 JSON (~/.g2log/config.json) -> 新格式 JSONC (~/.g2log/config.jsonc)
    const oldJsonConfigPath = path.join(CONFIG_DIR, 'config.json');
    if (fs.existsSync(oldJsonConfigPath) && !fs.existsSync(CONFIG_PATH)) {
      migrateToJSONC(oldJsonConfigPath, CONFIG_PATH);
    }

    // 确保 schema.json 存在于配置目录
    if (!fs.existsSync(SCHEMA_PATH)) {
      copySchemaFile();
    }

    if (fs.existsSync(CONFIG_PATH)) {
      // 读取配置文件
      const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');

      try {
        // 尝试解析 JSONC（支持注释）或 JSON
        let userConfig = parseJSONC(fileContent);

        // 检测是否是旧版配置（没有 profiles 字段）
        if (!userConfig.profiles) {
          console.log(colorize('检测到旧版配置，正在迁移到新结构...', 'yellow'));

          // 创建新的 profiles 结构
          const profiles = {
            deepseek: {
              api_key: '',
              api_base_url: 'https://api.deepseek.com',
              model: 'deepseek-chat',
              temperature: 0.5,
              max_tokens: 20480,
              enable_thinking: false
            },
            openai: {
              api_key: '',
              api_base_url: 'https://api.openai.com',
              model: 'gpt-4',
              temperature: 0.5,
              max_tokens: 2048,
              enable_thinking: false
            },
            zhipu: {
              api_key: '',
              api_base_url: 'https://open.bigmodel.cn/api/paas/v4',
              model: 'glm-4',
              temperature: 0.7,
              max_tokens: 2048,
              enable_thinking: false
            }
          };

          // 确定当前 profile
          const provider = (userConfig.api_provider || 'deepseek').toLowerCase();
          let currentProfile = 'deepseek';

          // 根据旧配置填充 profile
          if (provider === 'openai' || provider === 'zhipu' || provider === 'bigmodel') {
            currentProfile = provider === 'bigmodel' ? 'zhipu' : provider;
          }

          // 迁移配置到对应的 profile
          if (currentProfile === 'openai') {
            profiles.openai.api_key = userConfig.api_key || '';
            profiles.openai.api_base_url = userConfig.api_base_url || 'https://api.openai.com';
            profiles.openai.model = userConfig.model || 'gpt-4';
          } else if (currentProfile === 'zhipu') {
            profiles.zhipu.api_key = userConfig.api_key || '';
            profiles.zhipu.api_base_url = userConfig.api_base_url || 'https://open.bigmodel.cn/api/paas/v4';
            profiles.zhipu.model = userConfig.model || 'glm-4';
            profiles.zhipu.enable_thinking = userConfig.enable_thinking || false;
          } else {
            profiles.deepseek.api_key = userConfig.api_key || userConfig.deepseek_api_key || '';
            profiles.deepseek.api_base_url = userConfig.api_base_url || 'https://api.deepseek.com';
            profiles.deepseek.model = userConfig.model || 'deepseek-chat';
          }

          // 构建新配置
          userConfig = {
            default_author: userConfig.default_author || '',
            default_since: userConfig.default_since || 'today',
            default_until: userConfig.default_until || 'today',
            current_profile: currentProfile,
            profiles: profiles,
            repositories: userConfig.repositories || {},
            prompt_template: userConfig.prompt_template || DEFAULT_CONFIG.prompt_template
          };

          // 自动保存迁移后的配置
          saveConfig(userConfig);
          console.log(colorize('✅ 配置已自动迁移到新结构', 'green'));
        }

        // 合并配置（优先使用用户配置）
        const mergedConfig = {
          ...DEFAULT_CONFIG,
          ...userConfig,
          profiles: {
            ...DEFAULT_CONFIG.profiles,
            ...userConfig.profiles
          }
        };

        return mergedConfig;
      } catch (parseError) {
        console.error(colorize(`解析配置文件失败: ${parseError.message}，将使用默认配置`, 'red'));
        return {...DEFAULT_CONFIG};
      }
    }
    return {...DEFAULT_CONFIG};
  } catch (error) {
    console.error(colorize(`加载配置失败: ${error.message}`, 'red'));
    return {...DEFAULT_CONFIG};
  }
}

// 保存配置
function saveConfig(config) {
  try {
    // 确保 $schema 字段存在且在第一行
    if (!config.$schema) {
      const configWithSchema = {
        $schema: './schema.json'
      };
      Object.assign(configWithSchema, config);
      config = configWithSchema;
    }

    fs.writeFileSync(CONFIG_PATH, stringifyJSONC(config), 'utf-8');

    // 确保 schema.json 文件存在（使 $schema 引用生效）
    copySchemaFile();

    return true;
  } catch (error) {
    console.error(colorize(`保存配置失败: ${error.message}`, 'red'));
    return false;
  }
}

// 获取当前激活的 profile
function getCurrentProfile() {
  const config = loadConfig();
  const profileName = config.current_profile || 'deepseek';
  return config.profiles[profileName] || config.profiles.deepseek;
}

// 设置当前 profile
function setCurrentProfile(profileName) {
  const config = loadConfig();
  if (!config.profiles[profileName]) {
    console.error(colorize(`错误: profile "${profileName}" 不存在`, 'red'));
    return false;
  }
  config.current_profile = profileName;
  return saveConfig(config);
}

// 列出所有 profiles
function listProfiles() {
  const config = loadConfig();
  const current = config.current_profile || 'deepseek';
  console.log(colorize('\n可用的 AI 配置 (Profiles):', 'cyan'));
  console.log(colorize('='.repeat(50), 'dim'));

  for (const [name, profile] of Object.entries(config.profiles)) {
    const isCurrent = name === current;
    const marker = isCurrent ? '→' : ' ';
    const color = isCurrent ? 'green' : 'dim';

    console.log(colorize(`${marker} [${name}] ${isCurrent ? '(当前)' : ''}`, color));
    console.log(colorize(`  模型: ${profile.model}`, 'dim'));
    console.log(colorize(`  API: ${profile.api_base_url}`, 'dim'));
    console.log(colorize(`  温度: ${profile.temperature}`, 'dim'));
    if (profile.enable_thinking) {
      console.log(colorize(`  深度思考: 已启用`, 'cyan'));
    }
    console.log('');
  }
}

// 更新当前 profile 的设置
function updateProfileSetting(key, value) {
  const config = loadConfig();
  const profileName = config.current_profile || 'deepseek';
  if (!config.profiles[profileName]) {
    return false;
  }
  config.profiles[profileName][key] = value;
  return saveConfig(config);
}

// 设置 API 密钥（更新当前 profile）
function setApiKey(key) {
  return updateProfileSetting('api_key', key);
}

// 获取 API 密钥
function getApiKey() {
  const profile = getCurrentProfile();
  return profile.api_key;
}

// 设置 AI 模型（更新当前 profile）
function setAIModel(model) {
  return updateProfileSetting('model', model);
}

// 设置 API URL（更新当前 profile）
function setAPIBaseURL(url) {
  return updateProfileSetting('api_base_url', url);
}

// 设置温度（更新当前 profile）
function setTemperature(temp) {
  return updateProfileSetting('temperature', parseFloat(temp));
}

// 设置深度思考模式（更新当前 profile）
function setThinkingMode(enabled) {
  return updateProfileSetting('enable_thinking', enabled);
}

// 设置默认作者
function setDefaultAuthor(author) {
  const config = loadConfig();
  config.default_author = author;
  return saveConfig(config);
}

// 设置默认时间范围
function setDefaultTimeRange(since, until) {
  const config = loadConfig();
  if (since) config.default_since = since;
  if (until) config.default_until = until;
  return saveConfig(config);
}

// 添加或更新仓库配置
function addRepository(alias, path) {
  const config = loadConfig();
  if (!config.repositories) {
    config.repositories = {};
  }
  config.repositories[alias] = path;
  return saveConfig(config);
}

// 删除仓库配置
function removeRepository(alias) {
  const config = loadConfig();
  if (config.repositories && config.repositories[alias]) {
    delete config.repositories[alias];
    return saveConfig(config);
  }
  return false;
}

// 获取仓库路径（支持别名）
function getRepositoryPath(repoIdentifier, useLocalRepo) {
  if (useLocalRepo) {
    return findGitRepository(process.cwd());
  }

  if (!repoIdentifier) return findGitRepository(process.cwd());

  const config = loadConfig();
  if (config.repositories && config.repositories[repoIdentifier]) {
    return config.repositories[repoIdentifier];
  }

  // 如果不是别名，就当作路径处理
  return repoIdentifier;
}

// 向上搜索 Git 仓库根目录
function findGitRepository(startPath) {
  let currentPath = path.resolve(startPath);

  while (currentPath !== path.dirname(currentPath)) {
    const gitDir = path.join(currentPath, '.git');
    if (fs.existsSync(gitDir)) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }

  // 检查根目录
  const gitDir = path.join(currentPath, '.git');
  if (fs.existsSync(gitDir)) {
    return currentPath;
  }

  // 未找到 Git 仓库
  return null;
}

// 列出所有配置的仓库
function listRepositories() {
  const config = loadConfig();
  return config.repositories || {};
}

// 递归搜索指定目录下的所有 Git 仓库
async function findGitRepositories(searchPath, maxDepth = 3, currentDepth = 0) {
  const results = [];

  // 如果达到最大深度，停止搜索
  if (currentDepth >= maxDepth) {
    return results;
  }

  try {
    const entries = fs.readdirSync(searchPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(searchPath, entry.name);

      // 跳过隐藏目录和特殊目录
      if (entry.name.startsWith('.')) {
        continue;
      }

      // 跳过 node_modules 等常见不需要搜索的目录
      const skipDirs = ['node_modules', '.git', 'dist', 'build', 'target', 'vendor', '.vscode', '.idea'];
      if (skipDirs.includes(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        // 检查是否是 Git 仓库
        const gitDir = path.join(fullPath, '.git');
        if (fs.existsSync(gitDir)) {
          // 使用文件夹名作为别名
          results.push({
            alias: entry.name,
            path: fullPath
          });
        } else {
          // 递归搜索子目录
          const subResults = await findGitRepositories(fullPath, maxDepth, currentDepth + 1);
          results.push(...subResults);
        }
      }
    }
  } catch (error) {
    // 忽略无权限访问的目录
  }

  return results;
}

// 从用户主目录搜索 Git 仓库并添加到配置
async function findAndAddRepositories() {
  const spinner = createSpinner();
  const searchPaths = [
    path.join(os.homedir(), 'Projects'),
    path.join(os.homedir(), 'projects'),
    path.join(os.homedir(), 'Workspace'),
    path.join(os.homedir(), 'workspace'),
    path.join(os.homedir(), 'Development'),
    path.join(os.homedir(), 'development'),
    path.join(os.homedir(), 'code'),
    path.join(os.homedir(), 'src'),
    os.homedir()
  ];

  console.log(colorize('\n🔍 正在搜索 Git 仓库...', 'cyan'));
  console.log(colorize('搜索路径:', 'dim'), searchPaths.join(', '));
  console.log('');

  const allRepos = [];
  const seenPaths = new Set();

  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) {
      continue;
    }

    spinner.start(`🔍 正在搜索: ${searchPath}`);
    const repos = await findGitRepositories(searchPath, 3);

    for (const repo of repos) {
      if (!seenPaths.has(repo.path)) {
        seenPaths.add(repo.path);
        allRepos.push(repo);
      }
    }
  }

  spinner.stop(`✅ 搜索完成，找到 ${allRepos.length} 个 Git 仓库`);

  if (allRepos.length === 0) {
    console.log(colorize('⚠️ 未找到任何 Git 仓库', 'yellow'));
    console.log(colorize('💡 提示: 请将项目放在常见的目录中（如 ~/Projects, ~/Workspace 等）', 'cyan'));
    return 0;
  }

  // 显示找到的仓库
  console.log(colorize('\n📦 找到的仓库:', 'bright'));
  console.log(colorize('─'.repeat(50), 'dim'));
  allRepos.forEach((repo, index) => {
    console.log(`  ${colorize(String(index + 1) + '.', 'green')} ${colorize(repo.alias, 'cyan')}: ${repo.path}`);
  });
  console.log(colorize('─'.repeat(50), 'dim'));

  // 询问是否添加到配置
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  try {
    const answer = await question(colorize('\n❓ 是否将这些仓库添加到配置？(y/n): ', 'cyan'));
    rl.close();

    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      const config = loadConfig();
      if (!config.repositories) {
        config.repositories = {};
      }

      let addedCount = 0;
      for (const repo of allRepos) {
        // 处理重名，添加后缀
        let alias = repo.alias;
        let counter = 1;
        while (config.repositories[alias]) {
          alias = `${repo.alias}-${counter}`;
          counter++;
        }

        config.repositories[alias] = repo.path;
        addedCount++;
      }

      saveConfig(config);
      console.log(colorize(`\n✅ 已添加 ${addedCount} 个仓库到配置文件`, 'green'));
      return addedCount;
    } else {
      console.log(colorize('ℹ️ 已取消', 'blue'));
      return 0;
    }
  } catch (error) {
    rl.close();
    return 0;
  }
}

// 创建一个高级spinner
function createSpinner() {
  // 如果ora模块未加载完成或不支持，提供一个简单的替代方案
  if (!ora) {
    return {
      start(text) {
        console.log(text);
        return this;
      },
      stop(text) {
        if (text) console.log(text);
        return this;
      },
      fail(text) {
        console.error(text || '操作失败');
        return this;
      },
      update(text) {
        console.log(text);
        return this;
      }
    };
  }
  
  // 原有的spinner实现
  const spinner = ora({
    color: 'cyan',
    spinner: 'dots',
    discardStdin: false
  });
  
  return {
    start(text) {
      if (shouldUseColor) {
        process.stdout.write(colorize(`⏳ ${text}`, 'cyan'));
      } else {
        process.stdout.write(`${text}`);
      }
      return this;
    },
    stop(text) {
      process.stdout.clearLine?.(0);
      process.stdout.cursorTo?.(0);
      if (shouldUseColor) {
        console.log(colorize(text, 'green'));
      } else {
        console.log(text);
      }
      return this;
    },
    fail(text) {
      process.stdout.clearLine?.(0);
      process.stdout.cursorTo?.(0);
      if (shouldUseColor) {
        console.log(colorize(text, 'red'));
      } else {
        console.log(text);
      }
      return this;
    },
    update(text) {
      process.stdout.clearLine?.(0);
      process.stdout.cursorTo?.(0);
      if (shouldUseColor) {
        process.stdout.write(colorize(`⏳ ${text}`, 'cyan'));
      } else {
        process.stdout.write(`${text}`);
      }
      return this;
    }
  };
}

// 修复配置文件
function fixConfigFile() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      // 读取当前配置
      const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
      let config;
      
      try {
        config = JSON.parse(fileContent);
        
        // 迁移旧字段到新字段
        if (config.deepseek_api_key && !config.api_key) {
          config.api_key = config.deepseek_api_key;
          delete config.deepseek_api_key;
          console.log(colorize('已将配置中的 deepseek_api_key 迁移到 api_key', 'yellow'));
        }
        
        // 确保有API提供商和基础URL配置
        if (!config.api_provider) {
          config.api_provider = DEFAULT_CONFIG.api_provider;
          console.log(colorize('已添加默认API提供商配置', 'yellow'));
        }
        
        if (!config.api_base_url) {
          config.api_base_url = DEFAULT_CONFIG.api_base_url;
          console.log(colorize('已添加默认API基础URL配置', 'yellow'));
        }
        
        // 移除旧版推理模型相关配置
        if (config.use_reasoning !== undefined) {
          delete config.use_reasoning;
          console.log(colorize('已移除旧版推理模式配置', 'yellow'));
        }
        
        if (config.show_reasoning !== undefined) {
          delete config.show_reasoning;
          console.log(colorize('已移除旧版显示推理过程配置', 'yellow'));
        }
        
        if (config.reasoning_prompt_template) {
          delete config.reasoning_prompt_template;
          console.log(colorize('已移除旧版推理模板配置', 'yellow'));
        }
        
        // 检查prompt_template是否完整
        if (config.prompt_template && typeof config.prompt_template === 'string') {
          // 检查变量名是否被错误分割
          if (config.prompt_template.includes('{log_con') && 
              !config.prompt_template.includes('{log_content}')) {
            console.log(colorize('警告: 配置文件中的prompt模板格式有误，已修复', 'yellow'));
            config.prompt_template = config.prompt_template.replace('{log_con\ntent}', '{log_content}');
          }
        }
        
      } catch (error) {
        console.error(colorize(`配置文件JSON格式错误，将重新创建配置文件`, 'red'));
        config = {...DEFAULT_CONFIG};
      }
      
      // 重新写入完整的配置文件
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
      return true;
    } else {
      console.error(colorize(`配置文件不存在，将创建默认配置`, 'yellow'));
      return saveConfig({...DEFAULT_CONFIG});
    }
  } catch (error) {
    console.error(colorize(`修复配置文件失败: ${error.message}`, 'red'));
    return false;
  }
}

// 显示帮助
function showHelp() {
  console.log(`
使用方法: g2log [选项]

时间参数:
  --since <date>          开始日期 (默认: 7天前)
  --until <date>          结束日期 (默认: 今天)
  --days <number>         查询最近n天的记录 (默认: 7)

过滤参数:
  --author <name>         按作者过滤提交 (可选，不指定则获取所有作者)
  --local                 仅处理本地仓库

显示设置:
  --no-color             禁用彩色输出
  --save                 保存结果到文件（已弃用，使用--output）
  --output <file>        保存到指定文件
  --html                 生成HTML页面并保存到当前目录
  --open                 同 --html
  --debug                显示调试信息
  --show-prompt          显示完整的prompt内容
  --version              显示当前版本号

配置管理:
  --find                 自动搜索并添加 Git 仓库到配置
  --config               启动交互式配置向导
  --set-api-key          设置API密钥
  --set-api-provider     设置API提供商 (openai/deepseek/zhipu/bigmodel)
  --set-api-url          设置API基础URL
  --set-ai-model         设置AI模型
  --enable-thinking      启用深度思考模式 (仅智谱AI支持)
  --disable-thinking     禁用深度思考模式
  --set-default-author   设置默认作者 (可选)
  --add-repo <alias> --path <path>   添加仓库配置
  --remove-repo <alias>  移除仓库配置
  --list-repos           列出所有配置的仓库
  --uninstall            删除g2log配置目录 (~/.g2log/)

示例:
  g2log                                          # 生成工作总结并保存到 ~/.g2log/（默认Markdown）
  g2log --html                                   # 生成HTML页面并保存到 ~/.g2log/
  g2log --output my-report.md                    # 保存到当前目录（自定义路径）
  g2log --author "张三" --html                   # 生成张三的工作总结HTML
  g2log --days 7                                # 最近7天的工作总结
  g2log --set-api-key "your-api-key"
  g2log --set-api-provider "zhipu"               # 使用智谱AI
  g2log --enable-thinking                        # 启用深度思考模式
`);
  process.exit(0);
}

// 解析命令行参数
function parseArgs() {
  const args = {};
  const rawArgs = process.argv.slice(2);
  
  // 将帮助标志和便捷选项放在前面
  if (rawArgs.includes('-h') || rawArgs.includes('--help')) {
    args.help = true;
    return args;
  }
  
  // 解析标准参数
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    
    // 处理格式为 --key=value 的参数
    if (arg.startsWith('--') && arg.includes('=')) {
      const parts = arg.substring(2).split('=');
      const key = parts[0];
        const value = parts.slice(1).join('=').replace(/^["'](.*)["']$/, '$1'); // 移除可能的引号
        args[key] = value;
      continue;
    }
    
    // 处理格式为 --key value 的参数
    if (arg.startsWith('--') && i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('--')) {
      const key = arg.substring(2);
      const value = rawArgs[i + 1];
      args[key] = value;
      i++; // 跳过下一个参数，因为它是值
      continue;
    }
    
    // 处理格式为 --flag 的布尔参数
    if (arg.startsWith('--')) {
      const key = arg.substring(2);
        args[key] = true;
      }
    }
  
  // 处理特殊参数
  if (args.local === undefined) {
    args.local = false; // 默认使用配置中的仓库
  }
  
  // 处理--output和--save参数，它们是同义词
  if (args.save && !args.output) {
    args.output = args.save;
  }
  
  // 添加--skip-config-check参数支持
  if (args['skip-config-check'] === undefined) {
    args['skip-config-check'] = false; // 默认不跳过配置检查
  }
  
  // 添加--config参数支持（用于显式启动配置向导）
  if (args.config === undefined) {
    args.config = false; // 默认不启动配置向导
  }
  
  return args;
}

// 获取提交的详细信息
function getCommitDetails(repoPath, commitHash) {
  try {
    // 获取完整的提交信息
    const detailCommand = `git -C "${repoPath}" show --no-patch --pretty=fuller ${commitHash}`;
    const details = execSync(detailCommand, { encoding: 'utf-8' });
    
    // 获取提交所属的分支信息
    let branchInfo = '';
    try {
      const branchCommand = `git -C "${repoPath}" branch --contains ${commitHash} | grep -v "detached" | grep -v "no branch"`;
      branchInfo = execSync(branchCommand, { encoding: 'utf-8' }).trim()
        .replace(/^\*?\s+/, '') // 移除前导星号和空格
        .split('\n')
        .map(branch => branch.trim())
        .filter(branch => branch)
        .join(', ');
    } catch (e) {
      branchInfo = '无分支信息';
    }
    
    // 获取与提交相关的标签
    let tagInfo = '';
    try {
      const tagCommand = `git -C "${repoPath}" tag --contains ${commitHash}`;
      tagInfo = execSync(tagCommand, { encoding: 'utf-8' }).trim();
      if (tagInfo) {
        tagInfo = tagInfo.split('\n').join(', ');
      } else {
        tagInfo = '无标签';
      }
    } catch (e) {
      tagInfo = '无标签信息';
    }
    
    return {
      details,
      branches: branchInfo,
      tags: tagInfo
    };
  } catch (error) {
    return {
      details: `无法获取提交详情: ${error.message}`,
      branches: '无分支信息',
      tags: '无标签信息'
    };
  }
}

// 获取提交简洁信息
function getCommitSimpleDetails(repoPath, commitHash) {
  try {
    // 仅获取提交日期和消息
    const simpleCommand = `git -C "${repoPath}" show --no-patch --pretty=format:"%ad%n%n%s%n%n%b" --date=format:"%Y-%m-%d %H:%M:%S" ${commitHash}`;
    return execSync(simpleCommand, { encoding: 'utf-8' });
  } catch (error) {
    return `无法获取提交信息: ${error.message}`;
  }
}

// 获取提交统计信息
function getCommitStats(repoPath, commitHash) {
  try {
    const statsCommand = `git -C "${repoPath}" show --stat ${commitHash}`;
    return execSync(statsCommand, { encoding: 'utf-8' }).split('\n').slice(1).join('\n');
  } catch (error) {
    return `无法获取统计信息: ${error.message}`;
  }
}

// 获取提交补丁信息
function getCommitPatch(repoPath, commitHash) {
  try {
    const patchCommand = `git -C "${repoPath}" show --patch ${commitHash}`;
    const patchOutput = execSync(patchCommand, { encoding: 'utf-8' });
    
    // 简单处理补丁输出，去除前几行提交信息 (因为我们已经在别处显示了)
    const lines = patchOutput.split('\n');
    let startIndex = 0;
    
    // 查找补丁开始的位置 (通常是 diff --git 行)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('diff --git')) {
        startIndex = i;
        break;
      }
    }
    
    return lines.slice(startIndex).join('\n');
  } catch (error) {
    return `无法获取补丁信息: ${error.message}`;
  }
}

// 格式化提交信息 - 添加颜色
function formatCommitLine(line, useColor) {
  if (!useColor) return line;
  
  try {
    // 尝试将提交行分成不同部分来应用颜色
    // 假设格式是 "hash - author (date): message"
    const hashMatch = line.match(/^([a-f0-9]+)/);
    if (hashMatch) {
      const hash = hashMatch[1];
      const restOfLine = line.substring(hash.length);
      
      // 查找日期部分
      const dateMatch = restOfLine.match(/\((.*?)\)/);
      if (dateMatch) {
        const beforeDate = restOfLine.substring(0, dateMatch.index);
        const date = dateMatch[0];
        const afterDate = restOfLine.substring(dateMatch.index + date.length);
        
        // 给不同部分添加颜色
        return colorize(hash, 'yellow') + 
               beforeDate + 
               colorize(date, 'green') + 
               colorize(afterDate, 'cyan');
      }
    }
  } catch (e) {
    // 如果解析失败，返回原始行
  }
  
  return line;
}

// 将补丁内容着色
function colorizePatch(patch, useColor) {
  if (!useColor) return patch;
  
  return patch.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return colorize(line, 'green');
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      return colorize(line, 'red');
    } else if (line.startsWith('@@ ')) {
      return colorize(line, 'cyan');
    } else if (line.startsWith('diff ') || line.startsWith('index ')) {
      return colorize(line, 'yellow');
    } else {
      return line;
    }
  }).join('\n');
}

// 构建完整的API URL
function buildApiUrl(baseUrl, endpoint = 'chat/completions') {
  // 如果baseUrl以斜杠结尾，直接拼接endpoint
  if (baseUrl.endsWith('/')) {
    return `${baseUrl}${endpoint}`;
  }
  
  // 如果baseUrl不以斜杠结尾，添加斜杠再拼接endpoint
  return `${baseUrl}/${endpoint}`;
}

// 使用AI进行总结
async function summarizeWithAI(gitLogs, author, since, until, spinner = null) {
  try {
    // 加载配置
    const config = loadConfig();
    const profile = getCurrentProfile();

    const modelName = profile.model;
    const apiKey = profile.api_key;
    const apiBaseURL = profile.api_base_url;
    const temperature = profile.temperature;
    const maxTokens = profile.max_tokens;
    const enableThinking = profile.enable_thinking;

    // 根据 profile 名称确定提供商
    const profileName = config.current_profile || 'deepseek';
    let providerType = 'deepseek';
    if (profileName === 'openai') providerType = 'openai';
    else if (profileName === 'zhipu') providerType = 'zhipu';

    let prompt = config.prompt_template || `请根据以下Git提交记录，总结工作内容。
按照类别进行归纳，突出重点任务和成就。
用清晰的标题和小标题组织内容，确保总结全面且易于阅读。

Git提交记录:
{{GIT_LOGS}}`;

    // 替换变量 - 支持多种变量格式以兼容用户自定义模板
    const authorText = author || '所有作者';
    prompt = prompt.replace('{{GIT_LOGS}}', gitLogs)
                  .replace('{log_content}', gitLogs)
                  .replace('{{AUTHOR}}', authorText)
                  .replace('{author}', authorText)
                  .replace('{{SINCE}}', since)
                  .replace('{since}', since)
                  .replace('{{UNTIL}}', until)
                  .replace('{until}', until);

    if (spinner) spinner.update('🔄 正在连接API...');

    // 打印完整提示内容（添加--debug参数时显示）
    if (process.argv.includes('--debug') || process.argv.includes('--show-prompt')) {
      console.log(colorize('\n📝 完整提示内容:', 'cyan'));
      console.log(colorize('=' .repeat(50), 'dim'));
      console.log(prompt);
      console.log(colorize('=' .repeat(50), 'dim'));
    }

    // 输出AI总结的标题信息
    const summaryTitle = author ? `${author} 的工作总结` : '团队工作总结';
    console.log(`\n${colorize('📊 ' + summaryTitle, 'bright')}`);
    console.log(`${colorize('📅 时间范围: ' + since + ' 至 ' + until, 'green')}`);
    console.log(`${colorize('🤖 AI配置: ' + profileName, 'cyan')}`);
    console.log(`${colorize('🎯 模型: ' + modelName, 'cyan')}`);
    if (enableThinking) {
      console.log(`${colorize('🧠 深度思考: 已启用', 'cyan')}`);
    }
    console.log(`${colorize('=' .repeat(30), 'bright')}\n`);

    // 根据提供商名称选择对应的实现
    let aiResponse = '';

    if (providerType === 'openai') {
      aiResponse = await getOpenAIResponse(apiKey, prompt, modelName, apiBaseURL, spinner, temperature, maxTokens);
    } else if (providerType === 'zhipu') {
      aiResponse = await getZhipuResponse(apiKey, prompt, modelName, apiBaseURL, spinner, temperature, maxTokens, enableThinking);
    } else {
      // 其他提供商默认使用DeepSeek实现
      aiResponse = await getDeepSeekResponse(apiKey, prompt, modelName, apiBaseURL, spinner, temperature, maxTokens);
    }

    // 停止spinner并显示成功消息
    if (spinner) spinner.stop('✅ AI总结已生成');

    // 返回原始 AI 响应文本（不包含颜色代码）
    return aiResponse;
  } catch (error) {
    if (spinner) spinner.fail(`❌ AI总结失败: ${error.message}`);
    throw error;
  }
}

// 从OpenAI获取响应
async function getOpenAIResponse(apiKey, prompt, modelName, apiBaseURL, spinner = null, temperature = null, maxTokens = null) {
  // 验证参数
  if (!apiKey) throw new Error('未设置OpenAI API密钥');

  // 构造请求头和URL
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const baseURL = apiBaseURL || 'https://api.openai.com';
  const url = `${baseURL}/chat/completions`;

  // 构造请求体
  const data = {
    model: modelName || 'gpt-4',
    messages: [
      { role: 'system', content: '你是一位专业的工作总结助手，擅长将Git提交记录整理成清晰的工作报告。' },
      { role: 'user', content: prompt }
    ],
    stream: true // 启用流式传输
  };

  // 只在参数存在时添加
  if (temperature !== null && temperature !== undefined) {
    data.temperature = temperature;
  }
  if (maxTokens !== null && maxTokens !== undefined) {
    data.max_tokens = maxTokens;
  }

  // 打印请求内容
  console.log(colorize('\n📨 发送给AI的请求:', 'cyan'));
  console.log(colorize(`📌 API端点: ${url}`, 'dim'));
  console.log(colorize(`🤖 使用模型: ${data.model}`, 'dim'));
  if (data.temperature !== undefined) {
    console.log(colorize(`🌡️ 温度: ${data.temperature}`, 'dim'));
  }
  if (data.max_tokens !== undefined) {
    console.log(colorize(`🔢 最大Token: ${data.max_tokens}`, 'dim'));
  }
  console.log(colorize('📄 系统角色: ' + data.messages[0].content, 'dim'));
  console.log(colorize('💬 提示内容预览: ' + data.messages[1].content.substring(0, 150) + '...', 'dim'));
  
  if (spinner) spinner.update('🔄 正在向AI发送请求...\n');
  
  return new Promise((resolve, reject) => {
    try {
      // 解析URL以获取主机名和路径
      const urlObj = new URL(url);
      
      // 准备请求选项
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        headers: headers,
        rejectUnauthorized: false // 在开发环境中可能需要
      };
      
      // 确定使用http还是https
      const protocol = urlObj.protocol === 'https:' ? require('https') : require('http');
    
      // 创建请求
      const req = protocol.request(options, (res) => {
        // 检查状态码
        if (res.statusCode !== 200) {
          let errorData = '';
          res.on('data', chunk => {
            errorData += chunk.toString();
          });
          res.on('end', () => {
            let errorMessage = `OpenAI API请求失败 (${res.statusCode})`;
            try {
              const parsedError = JSON.parse(errorData);
              errorMessage += `: ${JSON.stringify(parsedError)}`;
            } catch (e) {
              errorMessage += `: ${errorData}`;
            }
            if (spinner) spinner.fail(`❌ ${errorMessage}`);
            reject(new Error(errorMessage));
          });
          return;
        }
        
        let fullContent = '';
        let buffer = '';
        
        // 处理数据
        res.on('data', (chunk) => {
          // 将新的数据添加到缓冲区
          const data = chunk.toString();
          buffer += data;
          
          // 尝试从缓冲区中提取完整的SSE消息
          const messages = buffer.split('\n\n');
          
          // 处理除了最后一个可能不完整的消息之外的所有消息
          for (let i = 0; i < messages.length - 1; i++) {
            const message = messages[i].trim();
            if (!message) continue; // 跳过空消息
            
            // 处理SSE格式的消息
            if (message.startsWith('data: ')) {
              const content = message.substring(6); // 移除 'data: ' 前缀
              
              // 跳过[DONE]消息
              if (content === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(content);
                if (parsed.choices && 
                    parsed.choices[0] && 
                    parsed.choices[0].delta && 
                    parsed.choices[0].delta.content) {
                  const contentPart = parsed.choices[0].delta.content;
                  fullContent += contentPart;
                  
                  // 直接输出内容增量到控制台
                  process.stdout.write(contentPart);
                }
              } catch (err) {
                // 忽略解析错误，但在调试模式下输出
                if (process.argv.includes('--debug')) {
                  console.error(`解析错误: ${err.message} for content: ${content}`);
                }
              }
            }
          }
          
          // 保留最后一个可能不完整的消息
          buffer = messages[messages.length - 1];
        });
        
        // 处理响应结束
        res.on('end', () => {
          // 处理缓冲区中可能剩余的内容
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ') && line.substring(6) !== '[DONE]') {
                try {
                  const parsed = JSON.parse(line.substring(6));
                  if (parsed.choices && 
                      parsed.choices[0] && 
                      parsed.choices[0].delta && 
                      parsed.choices[0].delta.content) {
                    const contentPart = parsed.choices[0].delta.content;
                    fullContent += contentPart;
                    
                    // 直接输出内容增量到控制台
                    process.stdout.write(contentPart);
                  }
                } catch (err) {
                  // 忽略解析错误
                }
              }
            }
          }
          
          // 确保输出后有换行符
          console.log(); // 强制添加换行符
          
          if (spinner) spinner.stop('✅ AI响应已结束');
          resolve(fullContent);
        });
      });
      
      // 处理请求错误
      req.on('error', (error) => {
        if (spinner) spinner.fail(`❌ OpenAI API网络错误: ${error.message}`);
        reject(error);
      });
      
      // 发送请求体
      req.write(JSON.stringify(data));
      req.end();
    } catch (error) {
      if (spinner) spinner.fail(`❌ OpenAI API错误: ${error.message}`);
      reject(error);
    }
  });
}

// 从智谱AI获取响应
async function getZhipuResponse(apiKey, prompt, modelName, apiBaseURL, spinner = null, temperature = null, maxTokens = null, enableThinking = false) {
  // 验证参数
  if (!apiKey) throw new Error('未设置智谱AI API密钥');
  if (!apiBaseURL) throw new Error('未设置API基础URL，请使用 --set-api-url 配置');

  // 构造请求头和URL
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const url = `${apiBaseURL}/chat/completions`;

  // 构造请求体
  const data = {
    model: modelName || 'glm-4',
    messages: [
      { role: 'system', content: '你是一位专业的工作总结助手，擅长将Git提交记录整理成清晰的工作报告。' },
      { role: 'user', content: prompt }
    ],
    stream: true // 启用流式传输
  };

  // 只在参数存在时添加
  if (temperature !== null && temperature !== undefined) {
    data.temperature = temperature;
  }
  if (maxTokens !== null && maxTokens !== undefined) {
    data.max_tokens = maxTokens;
  }

  // 如果启用深度思考模式，添加 thinking 参数
  if (enableThinking) {
    data.thinking = {
      type: 'enabled'
    };
  }

  // 打印请求内容
  console.log(colorize('\n📨 发送给智谱AI的请求:', 'cyan'));
  console.log(colorize(`📌 API端点: ${url}`, 'dim'));
  console.log(colorize(`🤖 使用模型: ${data.model}`, 'dim'));
  if (enableThinking) {
    console.log(colorize(`🧠 深度思考模式: 已启用`, 'cyan'));
  }
  if (data.temperature !== undefined) {
    console.log(colorize(`🌡️ 温度: ${data.temperature}`, 'dim'));
  }
  if (data.max_tokens !== undefined) {
    console.log(colorize(`🔢 最大Token: ${data.max_tokens}`, 'dim'));
  }
  console.log(colorize('📄 系统角色: ' + data.messages[0].content, 'dim'));
  console.log(colorize('💬 提示内容预览: ' + data.messages[1].content.substring(0, 150) + '...', 'dim'));

  if (spinner) spinner.update('🔄 正在向智谱AI发送请求...\n');

  return new Promise((resolve, reject) => {
    try {
      // 解析URL以获取主机名和路径
      const urlObj = new URL(url);

      // 准备请求选项
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        headers: headers,
        rejectUnauthorized: false
      };

      // 确定使用http还是https
      const protocol = urlObj.protocol === 'https:' ? require('https') : require('http');

      // 创建请求
      const req = protocol.request(options, (res) => {
        // 检查状态码
        if (res.statusCode !== 200) {
          let errorData = '';
          res.on('data', chunk => {
            errorData += chunk.toString();
          });
          res.on('end', () => {
            let errorMessage = `智谱AI API请求失败 (${res.statusCode})`;
            try {
              const parsedError = JSON.parse(errorData);
              errorMessage += `: ${JSON.stringify(parsedError)}`;
            } catch (e) {
              errorMessage += `: ${errorData}`;
            }
            if (spinner) spinner.fail(`❌ ${errorMessage}`);
            reject(new Error(errorMessage));
          });
          return;
        }

        let fullContent = '';
        let reasoningContent = '';
        let buffer = '';
        let isReasoningPhase = enableThinking; // 如果启用深度思考，先处理思考内容

        // 处理数据
        res.on('data', (chunk) => {
          const data = chunk.toString();
          buffer += data;

          // 尝试从缓冲区中提取完整的SSE消息
          const messages = buffer.split('\n\n');

          // 处理除了最后一个可能不完整的消息之外的所有消息
          for (let i = 0; i < messages.length - 1; i++) {
            const message = messages[i].trim();
            if (!message) continue;

            if (message.startsWith('data: ')) {
              const content = message.substring(6);
              if (content === '[DONE]') continue;

              try {
                const parsed = JSON.parse(content);
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                  const delta = parsed.choices[0].delta;

                  // 处理深度思考内容（reasoning_content）
                  if (delta.reasoning_content) {
                    if (isReasoningPhase) {
                      // 显示思考过程
                      process.stdout.write(colorize(delta.reasoning_content, 'dim'));
                      reasoningContent += delta.reasoning_content;
                    }
                  }

                  // 处理主要内容（content）
                  if (delta.content) {
                    // 如果从思考阶段切换到内容阶段，输出分隔符
                    if (isReasoningPhase && delta.content) {
                      isReasoningPhase = false;
                      console.log(colorize('\n\n--- 深度思考完成，开始生成总结 ---\n', 'cyan'));
                    }
                    process.stdout.write(delta.content);
                    fullContent += delta.content;
                  }
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }

          buffer = messages[messages.length - 1];
        });

        res.on('end', () => {
          // 处理缓冲区中剩余的消息
          if (buffer.trim()) {
            const message = buffer.trim();
            if (message.startsWith('data: ')) {
              const content = message.substring(6);
              if (content !== '[DONE]') {
                try {
                  const parsed = JSON.parse(content);
                  if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                    const delta = parsed.choices[0].delta;
                    if (delta.reasoning_content && isReasoningPhase) {
                      process.stdout.write(colorize(delta.reasoning_content, 'dim'));
                      reasoningContent += delta.reasoning_content;
                    }
                    if (delta.content) {
                      if (isReasoningPhase) {
                        isReasoningPhase = false;
                        console.log(colorize('\n\n--- 深度思考完成，开始生成总结 ---\n', 'cyan'));
                      }
                      process.stdout.write(delta.content);
                      fullContent += delta.content;
                    }
                  }
                } catch (e) {
                  // 忽略解析错误
                }
              }
            }
          }
          console.log('\n');
          resolve(fullContent);
        });

        res.on('error', (error) => {
          if (spinner) spinner.fail(`❌ 智谱AI API响应错误: ${error.message}`);
          reject(error);
        });
      });

      req.on('error', (error) => {
        if (spinner) spinner.fail(`❌ 智谱AI API请求错误: ${error.message}`);
        reject(error);
      });

      req.write(JSON.stringify(data));
      req.end();
    } catch (error) {
      if (spinner) spinner.fail(`❌ 智谱AI API错误: ${error.message}`);
      reject(error);
    }
  });
}

// 从DeepSeek获取响应
async function getDeepSeekResponse(apiKey, prompt, modelName, apiBaseURL, spinner = null, temperature = null, maxTokens = null) {
  // 验证参数
  if (!apiKey) throw new Error('未设置DeepSeek API密钥');

  // 构造请求头和URL
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const baseURL = apiBaseURL || 'https://api.deepseek.com';
  const url = `${baseURL}/chat/completions`;

  // 构造请求体
  const data = {
    model: modelName || 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是一位专业的工作总结助手，擅长将Git提交记录整理成清晰的工作报告。' },
      { role: 'user', content: prompt }
    ],
    stream: true // 启用流式传输
  };

  // 只在参数存在时添加
  if (temperature !== null && temperature !== undefined) {
    data.temperature = temperature;
  }
  if (maxTokens !== null && maxTokens !== undefined) {
    data.max_tokens = maxTokens;
  }

  // 打印请求内容
  console.log(colorize('\n📨 发送给AI的请求:', 'cyan'));
  console.log(colorize(`📌 API提供商: ${apiBaseURL}`, 'dim'));
  console.log(colorize(`🤖 使用模型: ${data.model}`, 'dim'));
  if (data.temperature !== undefined) {
    console.log(colorize(`🌡️ 温度: ${data.temperature}`, 'dim'));
  }
  if (data.max_tokens !== undefined) {
    console.log(colorize(`🔢 最大Token: ${data.max_tokens}`, 'dim'));
  }
  console.log(colorize('📄 系统角色: ' + data.messages[0].content, 'dim'));
  console.log(colorize('💬 提示内容预览: ' + data.messages[1].content.substring(0, 150) + '...', 'dim'));

  if (spinner) spinner.update('🔄 正在向AI发送请求...\n');

  return new Promise((resolve, reject) => {
    try {
      // 解析URL以获取主机名和路径
      const urlObj = new URL(url);
      
      // 准备请求选项
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        headers: headers,
        rejectUnauthorized: false // 在开发环境中可能需要
      };
      
      // 确定使用http还是https
      const protocol = urlObj.protocol === 'https:' ? require('https') : require('http');
      
      // 创建请求
      const req = protocol.request(options, (res) => {
        // 检查状态码
        if (res.statusCode !== 200) {
          let errorData = '';
          res.on('data', chunk => {
            errorData += chunk.toString();
          });
          res.on('end', () => {
            let errorMessage = `DeepSeek API请求失败 (${res.statusCode})`;
            try {
              const parsedError = JSON.parse(errorData);
              errorMessage += `: ${JSON.stringify(parsedError)}`;
            } catch (e) {
              errorMessage += `: ${errorData}`;
            }
            if (spinner) spinner.fail(`❌ ${errorMessage}`);
            reject(new Error(errorMessage));
          });
          return;
        }
        
        let fullContent = '';
        let buffer = '';
        
        // 处理数据
        res.on('data', (chunk) => {
          // 将新的数据添加到缓冲区
          const data = chunk.toString();
          buffer += data;
          
          // 尝试从缓冲区中提取完整的SSE消息
          const messages = buffer.split('\n\n');
          
          // 处理除了最后一个可能不完整的消息之外的所有消息
          for (let i = 0; i < messages.length - 1; i++) {
            const message = messages[i].trim();
            if (!message) continue; // 跳过空消息
            
            // 处理SSE格式的消息
            if (message.startsWith('data: ')) {
              const content = message.substring(6); // 移除 'data: ' 前缀
              
              // 跳过[DONE]消息
              if (content === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(content);
                if (parsed.choices && 
                    parsed.choices[0] && 
                    parsed.choices[0].delta && 
                    parsed.choices[0].delta.content) {
                  const contentPart = parsed.choices[0].delta.content;
                  fullContent += contentPart;
                  
                  // 直接输出内容增量到控制台
                  process.stdout.write(contentPart);
                }
              } catch (err) {
                // 忽略解析错误，但在调试模式下输出
                if (process.argv.includes('--debug')) {
                  console.error(`解析错误: ${err.message} for content: ${content}`);
                }
              }
            }
          }
          
          // 保留最后一个可能不完整的消息
          buffer = messages[messages.length - 1];
        });
        
        // 处理响应结束
        res.on('end', () => {
          // 处理缓冲区中可能剩余的内容
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ') && line.substring(6) !== '[DONE]') {
                try {
                  const parsed = JSON.parse(line.substring(6));
                  if (parsed.choices && 
                      parsed.choices[0] && 
                      parsed.choices[0].delta && 
                      parsed.choices[0].delta.content) {
                    const contentPart = parsed.choices[0].delta.content;
                    fullContent += contentPart;
                    
                    // 直接输出内容增量到控制台
                    process.stdout.write(contentPart);
                  }
                } catch (err) {
                  // 忽略解析错误
                }
              }
            }
          }
          
          // 确保输出后有换行符
          console.log(); // 强制添加换行符
          
          if (spinner) spinner.stop('✅ AI响应已结束');
          resolve(fullContent);
        });
      });
      
      // 处理请求错误
      req.on('error', (error) => {
        if (spinner) spinner.fail(`❌ DeepSeek API网络错误: ${error.message}`);
        reject(error);
      });
      
      // 发送请求体
      req.write(JSON.stringify(data));
      req.end();
    } catch (error) {
      if (spinner) spinner.fail(`❌ DeepSeek API错误: ${error.message}`);
      reject(error);
    }
  });
}

// 从多个仓库获取日志
async function getLogsFromMultipleRepos(author, since, until, options) {
  const config = loadConfig();
  
  // 检查是否有配置的仓库
  if (!config.repositories || Object.keys(config.repositories).length === 0) {
    console.log(colorize('⚠️ 未配置任何仓库，请使用 --add-repo="别名" --path="/仓库路径" 添加仓库', 'yellow'));
    return null;
  }
  
  const spinner = createSpinner();
  spinner.start(`🔍 正在从 ${Object.keys(config.repositories).length} 个仓库获取提交记录...`);
  
  // 用于保存所有仓库的日志
  let allLogs = '';
  let logCount = 0;
  let repos = 0;
  
  // 遍历所有仓库
  for (const [alias, repoPath] of Object.entries(config.repositories)) {
    try {
      // 检查仓库路径是否有效
      spinner.update(`🔍 正在检查仓库 ${alias} (${repoPath})...`);
        execSync(`git -C "${repoPath}" rev-parse --is-inside-work-tree`, { stdio: 'ignore' });
      
      // 构建Git命令（author 现在是可选的）
      let command = `git -C "${repoPath}" log --since="${since}" --until="${until}" --date=format:"%Y-%m-%d %H:%M:%S"`;

      // 如果指定了 author，则添加过滤器
      if (author && author.trim()) {
        command = `git -C "${repoPath}" log --author="${author}" --since="${since}" --until="${until}" --date=format:"%Y-%m-%d %H:%M:%S"`;
      }
      
      // 添加选项
      if (options.noMerges) {
        command += ' --no-merges';
      }
      
      // 添加格式选项
      if (options.simpleMode) {
        command += ` --pretty=format:"${alias} | %ad | %s%n%b%n"`;
      } else {
        command += ` --pretty=format:"${alias} | %ad | %h | %s%n%b%n"`;
      }
      
      // 执行命令
      spinner.update(`🔍 正在获取仓库 ${alias} 的提交记录...`);
      const repoLogs = execSync(command, { encoding: 'utf-8' });
      
      // 检查是否有日志，如果有则添加到结果
      if (repoLogs.trim()) {
        const repoCommitCount = (repoLogs.match(/\n\n/g) || []).length + 1;
        logCount += repoCommitCount;
        repos++;
        
        if (allLogs) allLogs += '\n\n';
        allLogs += repoLogs;
      }
    } catch (error) {
      spinner.update(`⚠️ 处理仓库 ${alias} 时出错: ${error.message}`);
    }
  }
  
  // 更新spinner显示结果
  if (logCount > 0) {
    spinner.stop(`✅ 从仓库 ${repos > 1 ? `${repos} 个仓库` : Object.keys(config.repositories)[0]} 获取到 ${logCount} 条提交`);
  } else {
    const authorText = author ? author : '所有作者';
    spinner.stop(`📭 未找到 ${authorText} 在 ${since} 至 ${until} 期间的提交记录`);
  }
  
  return allLogs;
}

// 设置prompt模板
function setPromptTemplate(template) {
  const config = loadConfig();
  config.prompt_template = template;
  return saveConfig(config);
}

// 重置prompt模板到默认值
function resetPromptTemplate() {
  const config = loadConfig();
  config.prompt_template = DEFAULT_CONFIG.prompt_template;
  const result = saveConfig(config);
  
  if (result) {
    // 显示默认模板内容
    console.log('\n' + colorize('默认模板内容:', 'green'));
    console.log('===========================================');
    console.log(DEFAULT_CONFIG.prompt_template);
    console.log('===========================================\n');
    
    // 再次读取配置文件，确保保存成功
    try {
      const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (savedConfig.prompt_template === DEFAULT_CONFIG.prompt_template) {
        return true;
      } else {
        console.error(colorize('警告: 默认模板保存不完整，尝试直接写入...', 'yellow'));
        // 直接重写配置文件
        const fixedConfig = {...savedConfig, prompt_template: DEFAULT_CONFIG.prompt_template};
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(fixedConfig, null, 2), 'utf-8');
      }
    } catch (error) {
      console.error(colorize(`验证保存失败: ${error.message}`, 'red'));
      return false;
    }
  }
  
  return result;
}

// 检测是否是通过npx临时运行并添加相应提示
function showNpxInfo() {
  if (isRunningWithNpx) {
    console.log(colorize('\n💡 提示: 您正在通过npx临时运行g2log。', 'cyan'));
    console.log(colorize('要全局安装以便更快地使用，请运行：', 'cyan'));
    console.log(colorize('npm install -g g2log\n', 'green'));
  }
}

// 检查配置文件状态
function checkConfig(silent = false) {
  try {
    // 检查配置文件是否存在
    if (!fs.existsSync(CONFIG_PATH)) {
      if (!silent) console.log(colorize('⚠️ 检测到配置缺失: 配置文件不存在', 'red'));
      return {
        needsConfig: true,
        missingConfig: ['api_key'],
        reason: '配置文件不存在',
        currentConfig: null
      };
    }
    
    // 尝试加载配置
    const config = loadConfig();
    const missingConfig = [];
    
    // 检查关键配置是否存在（default_author 现在是可选的）
    if (!config.api_key) {
      missingConfig.push('api_key');
    }

    // default_author 现在是可选的，不再强制要求
    
    // 设置默认时间范围（如果不存在）
    if (!config.default_since) {
      config.default_since = '7 days ago';
    }
    
    if (!config.default_until) {
      config.default_until = 'today';
    }
    
    // 若没有设置仓库配置，添加一个空对象
    if (!config.repositories) {
      config.repositories = {};
    }
    
    // 若有缺失配置，返回需要配置的状态
    if (missingConfig.length > 0) {
      if (!silent) {
        console.log(colorize(`⚠️ 检测到配置缺失: ${missingConfig.join(', ')}`, 'red'));
      }
      return {
        needsConfig: true,
        missingConfig,
        reason: '必要配置项缺失',
        currentConfig: config
      };
    }
    
    // 所有必要配置都存在
    return {
      needsConfig: false,
      missingConfig: [],
      reason: '配置完整',
      currentConfig: config
    };
  } catch (error) {
    if (!silent) {
      console.error(colorize(`❌ 配置检查错误: ${error.message}`, 'red'));
    }
    return {
      needsConfig: true,
      missingConfig: ['api_key'],
      reason: `配置文件解析错误: ${error.message}`,
      currentConfig: null
    };
  }
}

// 设置交互式配置向导
async function setupConfigInteractive() {
  const spinner = createSpinner();
  console.log(colorize('\n🛠️  Git日志工具配置向导', 'bright'));
  console.log(colorize('=' .repeat(30), 'bright'));
  console.log();

  // 创建readline接口
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // 转换问题为Promise
  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  try {
    // 初始化配置
    let config = {};
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        console.log(colorize('ℹ️  检测到现有配置，将在其基础上进行修改。', 'blue'));
      } else {
        console.log(colorize('ℹ️  未检测到配置文件，将创建新配置。', 'blue'));
        config = {
          repositories: {},
          prompt_template: `请根据下面的Git提交记录，用3-5句话简洁地总结工作内容。

以下是Git提交记录:

{log_content}

要求：
1. 按项目、日期和作者组织内容
2. 每个项目每天每个作者的工作内容用3-5句话概括
3. 使用清晰、专业但不晦涩的语言
4. 突出重要的功能开发、问题修复和优化改进
5. 适合放入工作日报的简洁描述
6. 输出格式为：【日期】：
                  【项目名称】 - 【作者】 - 【工作内容概述】
                  【项目名称】 - 【作者】 - 【工作内容概述】
7. 回复不要出现多余的内容，非必要不要用markdown格式`
        };
      }
    } catch (error) {
      console.log(colorize('⚠️  读取配置文件时出错，将创建新配置。', 'yellow'));
      config = {
        repositories: {},
        prompt_template: `请根据下面的Git提交记录，用3-5句话简洁地总结工作内容。

以下是Git提交记录:

{log_content}

要求：
1. 按项目、日期和作者组织内容
2. 每个项目每天每个作者的工作内容用3-5句话概括
3. 使用清晰、专业但不晦涩的语言
4. 突出重要的功能开发、问题修复和优化改进
5. 适合放入工作日报的简洁描述
6. 输出格式为：【日期】：
                  【项目名称】 - 【作者】 - 【工作内容概述】
                  【项目名称】 - 【作者】 - 【工作内容概述】
7. 回复不要出现多余的内容，非必要不要用markdown格式`
      };
    }

    // 步骤1: 设置API提供商
    console.log(colorize('\n📡 步骤1: 设置API提供商', 'yellow'));
    console.log(colorize('  (仅作为一个备注,示例：openai, deepseek, xxx)', 'cyan'));
    let apiProvider = config.api_provider || '';
    
    const providerInput = await question(colorize(`  请选择API提供商 [${apiProvider ? apiProvider : 'openai'}]: `, 'green'));
    if (providerInput.trim() !== '') {
      apiProvider = providerInput.trim();
    } else if (apiProvider === '') {
      apiProvider = 'openai'; // 默认值
    }
    
    // 保存用户输入的提供商名称，不做验证
    config.api_provider = apiProvider.toLowerCase();
    console.log(colorize(`  ✅ API提供商已设置为: ${config.api_provider}`, 'green'));

    // 步骤2: 设置API基础URL
    console.log(colorize('\n🔗 步骤2: 设置API基础URL', 'yellow'));
    console.log(colorize('  (示例: https://api.openai.com, https://api.deepseek.com 或其他API服务地址)', 'cyan'));
    
    // 根据提供商设置默认值
    let defaultBaseURL = config.api_base_url || '';
    if (!defaultBaseURL) {
      if (config.api_provider === 'openai') {
        defaultBaseURL = 'https://api.openai.com';
      } else if (config.api_provider === 'deepseek' || config.api_provider === 'ds') {
        defaultBaseURL = 'https://api.deepseek.com';
      }
    }
    
    const baseURLInput = await question(colorize(`  请输入API基础URL [${defaultBaseURL}]: `, 'green'));
    config.api_base_url = baseURLInput.trim() || defaultBaseURL;
    console.log(colorize(`  ✅ API基础URL已设置为: ${config.api_base_url}`, 'green'));

    // 步骤3: 设置AI模型
    console.log(colorize('\n🤖 步骤3: 设置AI模型', 'yellow'));
    
    // 根据提供商显示不同的模型示例
    const modelExamples = config.api_provider === 'openai' ? 
      'gpt-3.5-turbo, gpt-4, gpt-4-turbo' : 
      'deepseek-chat, deepseek-coder, deepseek-v3';
    console.log(colorize(`  (常用模型示例: ${modelExamples})`, 'cyan'));
    
    // 根据提供商设置默认模型
    let defaultModel = config.ai_model || '';
    if (!defaultModel) {
      if (config.api_provider === 'openai') {
        defaultModel = 'gpt-3.5-turbo';
      } else if (config.api_provider === 'deepseek' || config.api_provider === 'ds') {
        defaultModel = 'deepseek-chat';
      }
    }
    
    const modelInput = await question(colorize(`  请输入AI模型名称 [${defaultModel}]: `, 'green'));
    config.ai_model = modelInput.trim() || defaultModel;
    console.log(colorize(`  ✅ AI模型已设置为: ${config.ai_model}`, 'green'));

    // 步骤4: 设置API密钥
    console.log(colorize('\n🔑 步骤4: 设置API密钥', 'yellow'));
    console.log(colorize('  (格式示例: sk-abcdefg123456789... 密钥会安全存储在本地配置文件中)', 'cyan'));
    const existingKey = config.api_key || '';
    const keyInput = await question(colorize(`  请输入API密钥${existingKey ? ' [已配置，按Enter保留]' : ''}: `, 'green'));
    if (keyInput.trim() !== '') {
      config.api_key = keyInput.trim();
      console.log(colorize('  ✅ API密钥已更新', 'green'));
    } else if (!existingKey) {
      console.log(colorize('  ⚠️ 警告: 未设置API密钥，某些功能可能无法使用。', 'yellow'));
    } else {
      console.log(colorize('  ℹ️ API密钥保持不变', 'blue'));
    }

    // 步骤5: 设置默认作者（可选）
    console.log(colorize('\n👤 步骤5: 设置默认作者（可选）', 'yellow'));
    console.log(colorize('  (示例: 张三, user@example.com, 或Git提交时使用的用户名)', 'cyan'));
    console.log(colorize('  (留空则不过滤，获取所有作者的提交记录)', 'cyan'));
    const existingAuthor = config.default_author || '';
    const authorInput = await question(colorize(`  请输入默认作者名称 [${existingAuthor || '留空'}] (可选，按Enter跳过): `, 'green'));
    if (authorInput.trim() !== '') {
      config.default_author = authorInput.trim();
      console.log(colorize(`  ✅ 默认作者已设置为: ${config.default_author}`, 'green'));
    } else {
      config.default_author = '';
      console.log(colorize(`  ℹ️ 未设置默认作者，将获取所有作者的提交`, 'blue'));
    }

    // 步骤6: 设置默认时间范围（可选）
    console.log(colorize('\n🕒 步骤6: 设置默认时间范围（可选）', 'yellow'));
    console.log(colorize('  (支持格式: "7 days ago", "1 week ago", "yesterday", "2023-01-01", "last monday")', 'cyan'));
    
    // 获取当前的默认值
    const defaultSince = config.default_since || '7 days ago';
    const defaultUntil = config.default_until || 'today';
    
    const sinceInput = await question(colorize(`  请输入默认起始时间 [${defaultSince}]: `, 'green'));
    config.default_since = sinceInput.trim() || defaultSince;
    
    const untilInput = await question(colorize(`  请输入默认结束时间 [${defaultUntil}]: `, 'green'));
    config.default_until = untilInput.trim() || defaultUntil;
    
    console.log(colorize(`  ✅ 默认时间范围已设置为: ${config.default_since} 至 ${config.default_until}`, 'green'));

    // 步骤7: 仓库配置（可选）
    console.log(colorize('\n📂 步骤7: 仓库配置（可选）', 'yellow'));
    console.log(colorize('  (仓库别名示例: frontend, backend, main-project)', 'cyan'));
    
    // 根据操作系统提供路径示例
    const repoPathExample = process.platform === 'win32' ? 
      'C:\\项目\\前端仓库' : 
      '/Users/用户名/projects/前端仓库';
    console.log(colorize(`  (仓库路径示例: ${repoPathExample})`, 'cyan'));
    
    // 显示当前配置的仓库
    const repos = config.repositories || {};
    if (Object.keys(repos).length > 0) {
      console.log(colorize('  当前配置的仓库:', 'cyan'));
      let index = 1;
      for (const [name, path] of Object.entries(repos)) {
        console.log(colorize(`  ${index++}. ${name}: ${path}`, 'reset'));
      }
    } else {
      console.log(colorize('  当前没有配置的仓库', 'cyan'));
    }
    
    // 询问是否添加仓库
    let addRepo = true;
    while (addRepo) {
      const addRepoInput = await question(colorize('  是否添加仓库配置？(y/n): ', 'green'));
      if (addRepoInput.toLowerCase() === 'y' || addRepoInput.toLowerCase() === 'yes') {
        // 获取仓库别名
        const repoName = await question(colorize('  请输入仓库别名（如 frontend）: ', 'green'));
        if (!repoName.trim()) {
          console.log(colorize('  ❌ 仓库别名不能为空', 'red'));
          continue;
        }
        
        // 获取仓库路径，添加示例提示
        console.log(colorize(`  (请输入Git仓库的绝对路径，示例: ${repoPathExample})`, 'cyan'));
        const repoPath = await question(colorize('  请输入仓库路径（绝对路径）: ', 'green'));
        if (!repoPath.trim()) {
          console.log(colorize('  ❌ 仓库路径不能为空', 'red'));
          continue;
        }
        
        // 验证路径是否为有效的Git仓库
        try {
          const pathSpinner = spinner.start('  🔍 正在验证仓库路径...');
          execSync(`git -C "${repoPath}" rev-parse --is-inside-work-tree`, { stdio: 'ignore' });
          pathSpinner.stop('  ✅ 仓库路径有效');
          
          // 添加仓库配置
          if (!config.repositories) config.repositories = {};
          config.repositories[repoName.trim()] = repoPath.trim();
          console.log(colorize(`  ✅ 已添加仓库: ${repoName.trim()} -> ${repoPath.trim()}`, 'green'));
        } catch (error) {
          console.log(colorize(`  ❌ 路径 "${repoPath}" 不是有效的Git仓库`, 'red'));
        }
      } else {
        addRepo = false;
      }
    }

    // 保存配置
    const configDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    console.log(colorize(`\n✅ 配置已保存到: ${CONFIG_PATH}`, 'bright'));
    console.log(colorize('现在您可以使用g2log工具了！默认会从当前时间查询过去7天的记录。', 'bright'));
    console.log(colorize('使用 --since 和 --until 参数可以指定不同的时间范围。', 'bright'));
    
  } catch (error) {
    console.error(colorize(`\n❌ 配置过程出错: ${error.message}`, 'red'));
  } finally {
    rl.close();
  }
}

// 主函数
async function getGitLogs() {
  const args = parseArgs();

  // 显示帮助信息
  if (args['help']) {
    showHelp();
    return;
  }

  // 显示版本信息
  if (args['version']) {
    const packageJson = require('./package.json');
    console.log(`g2log version ${packageJson.version}`);
    return;
  }

  // 删除配置文件
  if (args['uninstall']) {
    const spinner = ora('正在删除配置文件...').start();
    const success = removeConfigFile();
    if (success) {
      spinner.succeed('配置文件已删除，如需完全卸载请运行: npm uninstall -g g2log');
    } else {
      spinner.fail('配置文件删除失败，可能文件不存在或无权限访问');
    }
    return;
  }

  try {
    const spinner = createSpinner();
    
    // 检查是否要显示自定义配置向导
    if (args.config) {
      console.log(colorize('🔧 启动配置向导...', 'cyan'));
      await setupConfigInteractive();
      return;
    }
    
    // 配置检查与向导（仅当不是特定的配置命令时）
    if (!args['set-api-key'] && !args['set-default-author'] && !args['add-repo'] && 
        !args['fix-config'] && !args['remove-repo'] && !args['list-repos'] && 
        !args['set-prompt-template'] && !args['reset-prompt-template'] &&
        !args['skip-config-check'] && !args['uninstall']) {
      
      // 检查配置状态
      const configStatus = checkConfig();
      
      // 如果配置缺失
      if (configStatus.needsConfig) {
        if (isRunningWithNpx || !fs.existsSync(CONFIG_PATH)) {
          // 对于NPX运行或首次使用（无配置文件），显示提示并询问是否配置
          console.log(colorize('\n⚠️ 检测到配置缺失: ' + configStatus.reason, 'yellow'));

          // 创建readline接口进行简单询问
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          const question = (query) => new Promise((resolve) => rl.question(query, resolve));
          const answer = await question(colorize('❓ 是否现在进行配置？(y/n): ', 'cyan'));
          rl.close();

          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            // 启动配置向导
            await setupConfigInteractive();
          }
        }
      }
    }
    
    // 加载配置（在配置检查和可能的设置之后）
    const config = loadConfig();
    
    // 修复配置文件
    if (args['fix-config']) {
      const fixSpinner = spinner.start('🔧 正在修复配置文件...');
      if (fixConfigFile()) {
        fixSpinner.stop('✅ 配置文件已修复');
      } else {
        fixSpinner.fail('❌ 配置文件修复失败');
      }
      return;
    }
    
    // 配置管理
    if (args['set-api-key']) {
      const keySpinner = spinner.start('🔑 正在设置API密钥...');
      if (setApiKey(args['set-api-key'])) {
        keySpinner.stop('✅ API密钥设置成功');
      } else {
        keySpinner.fail('❌ API密钥设置失败');
      }
      return;
    }
    
    if (args['set-api-provider']) {
      const providerSpinner = spinner.start('🎨 正在设置API提供商...');
      if (setAPIProvider(args['set-api-provider'])) {
        providerSpinner.stop(`✅ API提供商已设置为: ${args['set-api-provider']}`);
      } else {
        providerSpinner.fail('❌ API提供商设置失败');
      }
      return;
    }
    
    if (args['set-api-url']) {
      const urlSpinner = spinner.start('🔗 正在设置API基础URL...');
      if (setAPIBaseURL(args['set-api-url'])) {
        urlSpinner.stop(`✅ API基础URL已设置为: ${args['set-api-url']}`);
      } else {
        urlSpinner.fail('❌ API基础URL设置失败');
      }
      return;
    }

    if (args['enable-thinking']) {
      const thinkingSpinner = spinner.start('🧠 正在启用深度思考模式...');
      if (setThinkingMode(true)) {
        thinkingSpinner.stop('✅ 深度思考模式已启用 (仅智谱AI支持)');
      } else {
        thinkingSpinner.fail('❌ 深度思考模式设置失败');
      }
      return;
    }

    if (args['disable-thinking']) {
      const thinkingSpinner = spinner.start('🧠 正在禁用深度思考模式...');
      if (setThinkingMode(false)) {
        thinkingSpinner.stop('✅ 深度思考模式已禁用');
      } else {
        thinkingSpinner.fail('❌ 深度思考模式设置失败');
      }
      return;
    }

    if (args['set-ai-model']) {
      const modelSpinner = spinner.start('🤖 正在设置AI模型...');
      if (setAIModel(args['set-ai-model'])) {
        modelSpinner.stop(`✅ AI模型已设置为: ${args['set-ai-model']}`);
      } else {
        modelSpinner.fail('❌ AI模型设置失败');
      }
      return;
    }
    
    if (args['set-default-author']) {
      const authorSpinner = spinner.start('👤 正在设置默认作者...');
      if (setDefaultAuthor(args['set-default-author'])) {
        authorSpinner.stop(`✅ 默认作者已设置为: ${args['set-default-author']}`);
      } else {
        authorSpinner.fail('❌ 默认作者设置失败');
      }
      return;
    }
    
    if (args['set-time-range']) {
      const timeSpinner = spinner.start('🕒 正在设置默认时间范围...');
      if (setDefaultTimeRange(args.since, args.until)) {
        timeSpinner.stop(`✅ 默认时间范围已设置为: ${args.since || '(未更改)'} 至 ${args.until || '(未更改)'}`);
      } else {
        timeSpinner.fail('❌ 默认时间范围设置失败');
      }
      return;
    }
    
    if (args['add-repo'] && args.path) {
      const repoSpinner = spinner.start(`🔖 正在添加仓库配置: ${args['add-repo']} -> ${args.path}`);
      if (addRepository(args['add-repo'], args.path)) {
        repoSpinner.stop('✅ 仓库配置已添加');
      } else {
        repoSpinner.fail('❌ 仓库配置添加失败');
      }
      return;
    }
    
    if (args['remove-repo']) {
      const repoSpinner = spinner.start(`🗑️ 正在删除仓库配置: ${args['remove-repo']}`);
      if (removeRepository(args['remove-repo'])) {
        repoSpinner.stop('✅ 仓库配置已删除');
      } else {
        repoSpinner.fail('❌ 仓库配置删除失败或不存在');
      }
      return;
    }
    
    if (args['list-repos']) {
      const repos = listRepositories();
      console.log(`\n${colorize('配置的仓库:', 'bright')}\n`);
      
      if (Object.keys(repos).length === 0) {
        console.log(colorize('  没有配置任何仓库', 'yellow'));
      } else {
        for (const [alias, repoPath] of Object.entries(repos)) {
          console.log(`  ${colorize(alias, 'green')}: ${repoPath}`);
        }
      }
      
      console.log('');
      return;
    }
    
    // 重置prompt模板
    if (args['reset-prompt-template']) {
      const promptSpinner = spinner.start('🔄 正在重置prompt模板...');
      if (resetPromptTemplate()) {
        promptSpinner.stop('✅ Prompt模板已重置为默认值');
      } else {
        promptSpinner.fail('❌ Prompt模板重置失败');
      }
      return;
    }
    
    // 添加设置prompt模板的功能
    if (args['set-prompt-template']) {
      const templatePath = args['set-prompt-template'];
      try {
        const promptSpinner = spinner.start(`📄 正在读取prompt模板文件: ${templatePath}`);
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        if (setPromptTemplate(templateContent)) {
          promptSpinner.stop(`✅ Prompt模板已更新`);
        } else {
          promptSpinner.fail(`❌ Prompt模板更新失败`);
        }
        return;
      } catch (error) {
        console.error(colorize(`读取模板文件失败: ${error.message}`, 'red'));
        process.exit(1);
      }
    }

    // 搜索并添加仓库
    if (args.find) {
      const count = await findAndAddRepositories();
      process.exit(count > 0 ? 0 : 1);
    }

    // 显示NPX运行信息
    showNpxInfo();
    
    // 使用参数值或默认配置（author 现在是可选的）
    const useLocalRepo = args.local === true;
    const author = args.author || config.default_author || '';  // 支持命令行参数，可为空
    const since = args.since || config.default_since;
    const until = args.until || config.default_until;

    // 其他参数从配置文件获取
    const simpleMode = true; // 总是使用简单模式
    const aiSummary = true;  // 总是使用AI总结
    const outputFile = args.output;

    // author 现在是可选的，不再强制验证
    
    // 多仓库处理 - 如果不是--local模式，尝试处理配置中的所有仓库
    if (!useLocalRepo) {
      const multiRepoOptions = { 
        noMerges: true,
        simpleMode: true 
      };
      const multiRepoLogs = await getLogsFromMultipleRepos(author, since, until, multiRepoOptions);
      
      // 如果有多仓库日志结果
      if (multiRepoLogs) {
        if (multiRepoLogs.trim() === '') {
          console.log(colorize(`📭 在所有配置的仓库中未找到 ${author} 在 ${since} 至 ${until} 期间的提交记录。`, 'yellow'));
          return;
        }
        
        // 生成AI总结
        try {
          const summarySpinner = spinner.start('🧠 正在总结所有仓库的提交记录...');
          
          // 直接调用带spinner参数的summarizeWithAI函数
          const aiResult = await summarizeWithAI(multiRepoLogs, author, since, until, summarySpinner);
          
          // 如果指定了输出文件，保存AI总结结果
          if (outputFile) {
            const fileSpinner = spinner.start(`💾 正在保存多仓库AI总结到文件: ${outputFile}`);
            fs.writeFileSync(outputFile, `# 📊 ${author} 的多仓库工作总结 (${since} 至 ${until})\n\n${aiResult}`, 'utf-8');
            fileSpinner.stop(`✅ 多仓库AI总结已保存到文件: ${outputFile}`);
          }
          return;
        } catch (error) {
          console.error(colorize(`❌ AI总结失败: ${error.message}`, 'red'));
        }
        return;
      }
    }
    
    // 单仓库处理逻辑 - 当使用local模式或没有配置多个仓库时
    // 使用 findGitRepository 自动向上搜索 Git 仓库
    let repoPath;
    if (useLocalRepo) {
      repoPath = findGitRepository(process.cwd());
    } else {
      repoPath = Object.values(config.repositories)[0] || findGitRepository(process.cwd());
    }
    
    // 检查仓库路径是否有效
    if (!repoPath) {
      console.error(colorize(`❌ 错误: 未找到 Git 仓库。已从当前目录向上搜索到根目录。`, 'red'));
      console.error(colorize(`💡 提示: 请确保你在 Git 仓库内运行此命令，或使用 --add-repo 添加仓库路径`, 'yellow'));
      process.exit(1);
    }

    try {
      const pathSpinner = spinner.start(`🔍 检查仓库路径: ${repoPath}`);
      execSync(`git -C "${repoPath}" rev-parse --is-inside-work-tree`, { stdio: 'ignore' });
      pathSpinner.stop(`✅ 仓库路径有效: ${repoPath}`);
    } catch (error) {
      console.error(colorize(`❌ 错误: 指定的路径 "${repoPath}" 不是有效的Git仓库`, 'red'));
      process.exit(1);
    }
    
    // 获取简化格式的日志
    const authorText = author ? author : '所有作者';
    const logSpinner = spinner.start(`🔍 正在获取 ${authorText} 在 ${since} 至 ${until} 期间的提交记录...`);

    // 构建Git命令（author 现在是可选的）
    let simpleCommand = `git -C "${repoPath}" log --since="${since}" --until="${until}" --pretty=format:"%ad: %s%n%b%n" --date=format:"%Y-%m-%d %H:%M:%S" --no-merges`;
    if (author && author.trim()) {
      simpleCommand = `git -C "${repoPath}" log --author="${author}" --since="${since}" --until="${until}" --pretty=format:"%ad: %s%n%b%n" --date=format:"%Y-%m-%d %H:%M:%S" --no-merges`;
    }
    
    try {
      const result = execSync(simpleCommand, { encoding: 'utf-8' });
      logSpinner.stop(`✅ 找到提交记录`);
      
      if (!result.trim()) {
        const message = `📭 在指定时间范围内没有找到 ${authorText} 的提交记录。`;
        console.log(colorize(message, 'yellow'));
        
        if (outputFile) {
          fs.writeFileSync(outputFile, message, 'utf-8');
          console.log(colorize(`💾 结果已保存到文件: ${outputFile}`, 'green'));
        }
        
        return;
      }
      
      // 生成AI总结
      try {
        const summarySpinner = spinner.start('🧠 正在总结提交记录...');
        
        // 直接调用带spinner参数的summarizeWithAI函数
        const aiSummaryResult = await summarizeWithAI(result, author, since, until, summarySpinner);

        // 如果指定了 --html 或 --open，生成HTML并保存
        if (args['html'] || args['open']) {
          const summaryTitle = author ? `${author} 的工作总结` : '团队工作总结';
          generateHtmlAndSave(aiSummaryResult, summaryTitle, author, since, until);

          // 在终端显示格式化的输出（带颜色）
          console.log('\n');
          console.log(formatMarkdown(aiSummaryResult));
          return;
        }

        // 默认保存为markdown文件（以日期命名）
        const summaryTitle = author ? `${author} 的工作总结` : '团队工作总结';
        let defaultFileName;
        let saveToConfigDir = false;

        if (outputFile) {
          // 如果用户指定了输出文件，使用用户指定的文件名
          defaultFileName = outputFile;
        } else {
          // 生成详细的文件名：工作总结_{作者}_{起始日期}_to_{结束日期}.md
          const authorName = author || '团队';

          // 将日期格式化为 YYYY-MM-DD
          const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr; // 如果无法解析，返回原字符串
            return date.toISOString().split('T')[0];
          };

          const sinceDate = formatDate(since);
          const untilDate = formatDate(until);

          const filename = `工作总结_${authorName}_${sinceDate}_to_${untilDate}.md`;
          defaultFileName = path.join(CONFIG_DIR, filename);
          saveToConfigDir = true;
        }

        const fileSpinner = spinner.start(`💾 正在保存AI总结到文件: ${defaultFileName}`);
        fs.writeFileSync(defaultFileName, `# ${summaryTitle} (${since} 至 ${until})\n\n${aiSummaryResult}`, 'utf-8');

        if (saveToConfigDir) {
          fileSpinner.stop(`✅ AI总结已保存到: ${defaultFileName}`);
        } else {
          fileSpinner.stop(`✅ AI总结已保存到文件: ${defaultFileName}`);
        }

        // 在终端显示格式化的输出（带颜色）
        console.log('\n');
        console.log(formatMarkdown(aiSummaryResult));
        return;
      } catch (error) {
        console.error(colorize(`❌ AI总结失败: ${error.message}`, 'red'));
        // 如果AI总结失败，输出原始日志
        console.log(`\n📋 ${authorText} 的Git提交日志 (${since} 至 ${until})\n`);
        console.log(result);

        // 如果指定了输出文件，保存结果
        if (outputFile) {
          const fileSpinner = spinner.start(`💾 正在保存结果到文件: ${outputFile}`);
          const summaryTitle = author ? `${author} 的Git提交日志` : 'Git提交日志';
          const outputContent = `# ${summaryTitle} (${since} 至 ${until})\n\n${result}`;
          fs.writeFileSync(outputFile, outputContent, 'utf-8');
          fileSpinner.stop(`✅ 结果已保存到文件: ${outputFile}`);
        }
      }
    } catch (error) {
      logSpinner.fail(`❌ 获取提交记录失败: ${error.message}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(colorize('❌ 执行出错:', 'red'), error.message);
    process.exit(1);
  }
}

// 执行主函数
getGitLogs();

// 如果直接调用setupConfigInteractive进行测试（需要注释掉主函数调用）
// setupConfigInteractive(['api_key', 'default_author', 'repositories'])
//   .then(() => console.log('配置测试已完成'));

// 如果需要测试checkConfig（需要注释掉主函数调用）
// console.log(checkConfig());

// 重置prompt模板为默认值
function resetPromptTemplate() {
  try {
    const config = loadConfig();
    if (config.prompt_template) {
      delete config.prompt_template;
      return saveConfig(config);
    }
    return true; // 如果没有设置自定义模板，则视为重置成功
  } catch (error) {
    console.error(`❌ 重置prompt模板失败: ${error.message}`);
    return false;
  }
}

// 删除配置文件
function removeConfigFile() {
  try {
    if (fs.existsSync(CONFIG_DIR)) {
      fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
      return true;
    }
    return false; // 目录不存在
  } catch (error) {
    console.error(`❌ 删除配置目录失败: ${error.message}`);
    return false;
  }
}

// 设置API提供商
function setAPIProvider(provider) {
  try {
    const config = loadConfig();
    config.api_provider = provider;
    return saveConfig(config);
  } catch (error) {
    console.error(`❌ 设置API提供商失败: ${error.message}`);
    return false;
  }
}