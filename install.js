#!/usr/bin/env node

/**
 * 安装后帮助脚本
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

// 简单的彩色输出函数
function colorize(text, color) {
  return colors[color] + text + colors.reset;
}

console.log(`
${colorize('Git用户日志工具安装成功！', 'bright')}

${colorize('快速开始:', 'yellow')}

1. 设置API密钥:
   ${colorize('g2log --set-api-key="您的API密钥"', 'green')}

2. 设置默认作者:
   ${colorize('g2log --set-default-author="您的名字"', 'green')}

3. 添加仓库配置:
   ${colorize('g2log --add-repo="项目名称" --path="/path/to/repo"', 'green')}

4. 生成今日工作总结:
   ${colorize('g2log', 'green')}

5. 查看完整帮助:
   ${colorize('g2log --help', 'green')}

${colorize('NPX使用方式:', 'yellow')} 
如果您没有全局安装，也可以使用npx直接运行:
${colorize('npx g2log [选项]', 'green')}

${colorize('配置文件位置:', 'yellow')} ~/.git-user-log-config.json

${colorize('注意:', 'red')} 使用AI总结功能需要有效的API密钥。目前支持DeepSeek API和OpenAI API。

${colorize('更多信息请访问:', 'cyan')} https://github.com/yourusername/git-user-log
`); 