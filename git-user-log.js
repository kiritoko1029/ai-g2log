#!/usr/bin/env node

/**
 * 获取指定用户和时间范围的Git日志
 * 使用方法: node git-user-log.js [--author="用户名"] [--since="2023-01-01"] [--until="2023-12-31"] [--repo="alias或路径"] [--format="格式"] [--output="文件路径"] [--stats] [--help]
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');

// 控制台颜色
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

// 配置文件路径
const CONFIG_PATH = path.join(os.homedir(), '.git-user-log-config.json');

// 默认配置
const DEFAULT_CONFIG = {
  deepseek_api_key: '',
  default_author: '',
  default_since: 'today',
  default_until: 'today',
  repositories: {}
};

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
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
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(colorize(`保存配置失败: ${error.message}`, 'red'));
    return false;
  }
}

// 设置API密钥
function setApiKey(key) {
  const config = loadConfig();
  config.deepseek_api_key = key;
  return saveConfig(config);
}

// 获取API密钥
function getApiKey() {
  const config = loadConfig();
  return config.deepseek_api_key;
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
function getRepositoryPath(repoIdentifier) {
  if (!repoIdentifier) return process.cwd();
  
  const config = loadConfig();
  if (config.repositories && config.repositories[repoIdentifier]) {
    return config.repositories[repoIdentifier];
  }
  
  // 如果不是别名，就当作路径处理
  return repoIdentifier;
}

// 列出所有配置的仓库
function listRepositories() {
  const config = loadConfig();
  return config.repositories || {};
}

// 彩色输出
function colorize(text, color) {
  return colors[color] + text + colors.reset;
}

// 创建进度显示
function createSpinner() {
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let index = 0;
  let intervalId;
  let message = '';
  
  function start(msg) {
    message = msg || '';
    clearInterval(intervalId);
    index = 0;
    
    intervalId = setInterval(() => {
      process.stdout.write(`\r${colorize(spinnerFrames[index], 'cyan')} ${message}`);
      index = (index + 1) % spinnerFrames.length;
    }, 80);
    
    return {
      stop: (endMsg) => {
        clearInterval(intervalId);
        process.stdout.write(`\r${colorize('✓', 'green')} ${endMsg || message}     \n`);
      },
      update: (msg) => {
        message = msg;
      },
      fail: (errMsg) => {
        clearInterval(intervalId);
        process.stdout.write(`\r${colorize('✗', 'red')} ${errMsg || '失败'}     \n`);
      }
    };
  }
  
  return { start };
}

// 显示帮助信息
function showHelp() {
  console.log(`
${colorize('获取指定用户和时间范围的Git日志', 'bright')}

${colorize('使用方法:', 'yellow')} 
  node git-user-log.js [--author="用户名"] [--since="2023-01-01"] [--until="2023-12-31"] [选项]

${colorize('参数说明:', 'green')}
  --author="用户名"         指定Git提交作者 (如未指定，使用配置文件中的默认值)
  --since="YYYY-MM-DD"     起始日期 (如未指定，使用配置文件中的默认值)
  --until="YYYY-MM-DD"     结束日期 (如未指定，使用配置文件中的默认值)
  --repo="alias或路径"      Git仓库路径或别名，默认为当前目录

${colorize('配置管理:', 'magenta')}
  --set-api-key="KEY"      设置DeepSeek API密钥
  --set-default-author="NAME"  设置默认作者
  --set-time-range --since="DATE" --until="DATE"  设置默认时间范围
  --add-repo="ALIAS" --path="/path/to/repo"  添加仓库配置
  --remove-repo="ALIAS"    删除仓库配置
  --list-repos             列出所有配置的仓库

${colorize('输出选项:', 'cyan')}
  --format="格式"           自定义输出格式，默认为详细格式
  --brief                  使用简洁格式 (仅显示哈希、作者、日期和提交信息)
  --simple                 使用极简格式 (仅显示日期和提交信息)
  --output="文件路径"        将输出保存到指定文件
  --stats                  包含文件修改统计信息
  --patch                  显示每个提交的具体更改 (补丁)
  --no-merges              排除合并提交
  --max-count=N            限制显示的提交数量
  --branches               显示每个提交所属的分支
  --tags                   显示提交相关的标签
  --no-color               禁用彩色输出
  --ai-summary             使用AI总结提交记录 (3-5句话)
  --help                   显示帮助信息

${colorize('示例:', 'magenta')}
  # 使用配置中的默认值生成今日工作总结
  node git-user-log.js --ai-summary
  
  # 查询特定用户在特定时间的提交
  node git-user-log.js --author="张三" --since="2023-01-01" --until="2023-12-31"
  
  # 使用仓库别名
  node git-user-log.js --repo="frontend" --ai-summary
  
  # 设置配置
  node git-user-log.js --set-default-author="张三"
  node git-user-log.js --add-repo="frontend" --path="/path/to/frontend-project"
`);
  process.exit(0);
}

// 解析命令行参数
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const parts = arg.substring(2).split('=');
      const key = parts[0];
      if (parts.length > 1) {
        // 有值的参数 (--key=value)
        const value = parts.slice(1).join('=').replace(/^["'](.*)["']$/, '$1'); // 移除可能的引号
        args[key] = value;
      } else {
        // 无值的参数 (--flag)
        args[key] = true;
      }
    }
  });
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

// 调用DeepSeek API进行提交日志总结
function summarizeWithAI(logContent, author, since, until) {
  return new Promise((resolve, reject) => {
    const apiKey = getApiKey();
    
    if (!apiKey || apiKey === 'your-api-key-here') {
      reject(new Error('未配置DeepSeek API密钥，请使用 --set-api-key="您的密钥" 进行设置'));
      return;
    }
    
    const prompt = `
请根据下面的Git提交记录，用3-5句话简洁地总结一天的工作内容。

这些是${author}在${since}至${until}期间的Git提交记录:

${logContent}

请使用简洁、专业的语言，只需要描述完成了什么工作，不要有多余的格式。不需要包含任何标题、分类或计划。
`;

    const requestData = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that summarizes Git commit logs into concise work summaries.' },
        { role: 'user', content: prompt }
      ],
      stream: false
    });

    const options = {
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const jsonResponse = JSON.parse(data);
            const summary = jsonResponse.choices[0].message.content;
            resolve(summary);
          } catch (error) {
            reject(new Error(`解析API响应失败: ${error.message}`));
          }
        } else {
          reject(new Error(`API请求失败 (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API请求出错: ${error.message}`));
    });

    req.write(requestData);
    req.end();
  });
}

// 主函数
async function getGitLogs() {
  try {
    const spinner = createSpinner();
    const args = parseArgs();
    const config = loadConfig();
    
    // 显示帮助信息
    if (args.help) {
      showHelp();
      return;
    }
    
    // 配置管理
    if (args['set-api-key']) {
      const keySpinner = spinner.start('正在设置API密钥...');
      if (setApiKey(args['set-api-key'])) {
        keySpinner.stop('API密钥设置成功');
      } else {
        keySpinner.fail('API密钥设置失败');
      }
      return;
    }
    
    if (args['set-default-author']) {
      const authorSpinner = spinner.start('正在设置默认作者...');
      if (setDefaultAuthor(args['set-default-author'])) {
        authorSpinner.stop(`默认作者已设置为: ${args['set-default-author']}`);
      } else {
        authorSpinner.fail('默认作者设置失败');
      }
      return;
    }
    
    if (args['set-time-range']) {
      const timeSpinner = spinner.start('正在设置默认时间范围...');
      if (setDefaultTimeRange(args.since, args.until)) {
        timeSpinner.stop(`默认时间范围已设置为: ${args.since || '(未更改)'} 至 ${args.until || '(未更改)'}`);
      } else {
        timeSpinner.fail('默认时间范围设置失败');
      }
      return;
    }
    
    if (args['add-repo'] && args.path) {
      const repoSpinner = spinner.start(`正在添加仓库配置: ${args['add-repo']} -> ${args.path}`);
      if (addRepository(args['add-repo'], args.path)) {
        repoSpinner.stop('仓库配置已添加');
      } else {
        repoSpinner.fail('仓库配置添加失败');
      }
      return;
    }
    
    if (args['remove-repo']) {
      const repoSpinner = spinner.start(`正在删除仓库配置: ${args['remove-repo']}`);
      if (removeRepository(args['remove-repo'])) {
        repoSpinner.stop('仓库配置已删除');
      } else {
        repoSpinner.fail('仓库配置删除失败或不存在');
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
    
    // 使用参数值或默认配置
    const repoArg = args.repo;
    const repoPath = getRepositoryPath(repoArg);
    const author = args.author || config.default_author;
    const since = args.since || config.default_since;
    const until = args.until || config.default_until;
    
    // 其他参数处理
    const briefMode = args.brief;
    const simpleMode = args.simple;
    const includeStats = args.stats;
    const includePatch = args.patch;
    const noMerges = args['no-merges'];
    const maxCount = args['max-count'];
    const showBranches = args.branches;
    const showTags = args.tags;
    const useColor = args['no-color'] !== true;
    const outputFile = args.output;
    const aiSummary = args['ai-summary'];
    
    // 参数验证
    if (!author) {
      console.error(colorize('错误: 未指定作者且配置文件中无默认作者。请使用 --author="用户名" 或设置默认作者', 'red'));
      process.exit(1);
    }
    
    // 检查仓库路径是否有效
    try {
      const pathSpinner = spinner.start(`检查仓库路径: ${repoPath}`);
      execSync(`git -C "${repoPath}" rev-parse --is-inside-work-tree`, { stdio: 'ignore' });
      pathSpinner.stop(`仓库路径有效: ${repoPath}`);
    } catch (error) {
      console.error(colorize(`错误: 指定的路径 "${repoPath}" 不是有效的Git仓库`, 'red'));
      process.exit(1);
    }
    
    // 如果使用AI总结，建议使用简洁模式
    if (aiSummary && !simpleMode) {
      console.log(colorize('提示: 使用AI总结功能时，建议添加 --simple 参数以获得最佳结果', 'yellow'));
    }
    
    // 如果使用极简模式，直接输出简化的日志
    if (simpleMode && !includeStats && !includePatch && !showBranches && !showTags) {
      const logSpinner = spinner.start(`正在获取 ${author} 在 ${since} 至 ${until} 期间的提交记录...`);
      const simpleCommand = `git -C "${repoPath}" log --author="${author}" --since="${since}" --until="${until}" --pretty=format:"%ad: %s%n%b%n" --date=format:"%Y-%m-%d %H:%M:%S"${noMerges ? ' --no-merges' : ''}${maxCount ? ` --max-count=${maxCount}` : ''}`;
      
      try {
        const result = execSync(simpleCommand, { encoding: 'utf-8' });
        logSpinner.stop(`找到提交记录`);
        
        if (!result.trim()) {
          const message = `在指定时间范围内没有找到 ${author} 的提交记录。`;
          console.log(colorize(message, 'yellow'));
          
          if (outputFile) {
            fs.writeFileSync(outputFile, message, 'utf-8');
            console.log(colorize(`结果已保存到文件: ${outputFile}`, 'green'));
          }
          
          return;
        }
        
        // 如果需要AI总结
        let aiSummaryResult = '';
        if (aiSummary) {
          try {
            const summarySpinner = spinner.start('正在使用AI总结提交记录...');
            aiSummaryResult = await summarizeWithAI(result, author, since, until);
            summarySpinner.stop('AI总结完成');
            
            // 输出AI总结结果
            console.log(`\n${colorize(`${author} 的工作总结 (${since} 至 ${until})`, 'bright')}\n${colorize('='.repeat((`${author} 的工作总结 (${since} 至 ${until})`).length), 'bright')}\n`);
            console.log(aiSummaryResult);
            
            // 如果指定了输出文件，保存AI总结结果
            if (outputFile) {
              const fileSpinner = spinner.start(`正在保存AI总结到文件: ${outputFile}`);
              fs.writeFileSync(outputFile, `# ${author} 的工作总结 (${since} 至 ${until})\n\n${aiSummaryResult}`, 'utf-8');
              fileSpinner.stop(`AI总结已保存到文件: ${outputFile}`);
              return;
            }
          } catch (error) {
            console.error(colorize(`AI总结失败: ${error.message}`, 'red'));
            // 如果AI总结失败，继续输出原始日志
          }
        }
        
        // 如果不需要AI总结或者AI总结失败，输出原始日志
        if (!aiSummary || !aiSummaryResult) {
          // 输出结果
          console.log(`\n${author} 的Git提交日志 (${since} 至 ${until})\n`);
          console.log(result);
          
          // 如果指定了输出文件，保存结果
          if (outputFile && !aiSummaryResult) {
            const fileSpinner = spinner.start(`正在保存结果到文件: ${outputFile}`);
            const outputContent = `# ${author} 的Git提交日志 (${since} 至 ${until})\n\n${result}`;
            fs.writeFileSync(outputFile, outputContent, 'utf-8');
            fileSpinner.stop(`结果已保存到文件: ${outputFile}`);
          }
        }
        
        return;
      } catch (error) {
        logSpinner.fail(`获取提交记录失败: ${error.message}`);
        process.exit(1);
      }
    }
    
    // 默认或自定义格式
    let format = args.format;
    if (!format) {
      if (simpleMode) {
        format = '%ad: %s';
      } else if (briefMode) {
        format = '%h - %an (%ad): %s';
      } else {
        format = '%H%n作者: %an <%ae>%n日期: %ad%n标题: %s%n%n%b';
      }
    }
    
    // 构建git命令
    let gitCommand = `git -C "${repoPath}" log --author="${author}" --since="${since}" --until="${until}" --pretty=format:"${format}" --date=format:"%Y-%m-%d %H:%M:%S"`;
    
    // 添加附加选项
    if (noMerges) {
      gitCommand += ' --no-merges';
    }
    
    if (maxCount) {
      gitCommand += ` --max-count=${maxCount}`;
    }
    
    // 如果需要统计信息，使用较简单的方式获取提交哈希值
    const hashSpinner = spinner.start('正在获取提交哈希...');
    const hashCommand = `git -C "${repoPath}" log --author="${author}" --since="${since}" --until="${until}" --pretty=format:"%H"${noMerges ? ' --no-merges' : ''}${maxCount ? ` --max-count=${maxCount}` : ''}`;
    const commitHashes = execSync(hashCommand, { encoding: 'utf-8' }).split('\n').filter(hash => hash.trim());
    hashSpinner.stop(`找到 ${commitHashes.length} 个提交`);
    
    if (commitHashes.length === 0) {
      const message = `在指定时间范围内没有找到 ${author} 的提交记录。`;
      console.log(colorize(message, 'yellow'));
      
      if (outputFile) {
        fs.writeFileSync(outputFile, message, 'utf-8');
        console.log(colorize(`结果已保存到文件: ${outputFile}`, 'green'));
      }
      
      return;
    }
    
    // 如果需要AI总结但当前不是简洁模式，则需要先获取简洁格式的日志用于AI总结
    let aiSummaryContent = '';
    if (aiSummary && !simpleMode) {
      const aiLogCommand = `git -C "${repoPath}" log --author="${author}" --since="${since}" --until="${until}" --pretty=format:"%ad: %s%n%b%n" --date=format:"%Y-%m-%d %H:%M:%S"${noMerges ? ' --no-merges' : ''}${maxCount ? ` --max-count=${maxCount}` : ''}`;
      aiSummaryContent = execSync(aiLogCommand, { encoding: 'utf-8' });
    }
    
    // 准备输出内容
    let output = '';
    let consoleOutput = '';
    
    // 添加标题
    const title = `${author} 的Git提交日志 (${since} 至 ${until})`;
    output += `# ${title}\n\n`;
    consoleOutput += useColor ? `\n${colorize(title, 'bright')}\n${colorize('='.repeat(title.length), 'bright')}\n\n` : `\n# ${title}\n\n`;
    
    const countInfo = `共找到 ${commitHashes.length} 条提交记录`;
    output += `${countInfo}\n\n`;
    consoleOutput += useColor ? `${colorize(countInfo, 'yellow')}\n\n` : `${countInfo}\n\n`;
    
    // 获取并显示每个提交的详细信息
    for (let i = 0; i < commitHashes.length; i++) {
      const hash = commitHashes[i];
      const commitNumber = i + 1;
      
      // 提交标题
      const commitTitle = simpleMode 
        ? `提交 ${commitNumber}/${commitHashes.length}` 
        : `提交 ${commitNumber}/${commitHashes.length}: ${hash.substring(0, 8)}`;
      
      output += `## ${commitTitle}\n\n`;
      consoleOutput += useColor 
        ? `\n${colorize(commitTitle, 'bright')}\n${colorize('-'.repeat(commitTitle.length), 'bright')}\n\n` 
        : `\n## ${commitTitle}\n\n`;
      
      // 基于模式获取不同级别的提交信息
      if (simpleMode) {
        // 仅获取简化信息（日期和提交消息）
        const simpleDetailsSpinner = spinner.start(`正在获取提交 ${commitNumber} 的基本信息...`);
        const simpleDetails = getCommitSimpleDetails(repoPath, hash);
        simpleDetailsSpinner.stop();
        
        output += `${simpleDetails}\n\n`;
        consoleOutput += useColor
          ? simpleDetails.split('\n').map((line, index) => {
              // 着色第一行（日期）
              if (index === 0) {
                return colorize(line, 'green');
              } else {
                return line;
              }
            }).join('\n') + '\n\n'
          : simpleDetails + '\n\n';
          
        // 如果是简洁模式且需要AI总结，收集内容
        if (aiSummary && i === 0) {
          aiSummaryContent = output;
        }
      } else {
        // 获取标准提交详情
        const detailsSpinner = spinner.start(`正在获取提交 ${hash.substring(0, 8)} 的详细信息...`);
        const { details, branches, tags } = getCommitDetails(repoPath, hash);
        detailsSpinner.stop();
        
        // 输出基本提交信息
        output += `${details}\n`;
        consoleOutput += useColor 
          ? details.split('\n').map(line => {
              if (line.startsWith('commit ')) {
                return colorize(line, 'yellow');
              } else if (line.startsWith('Author: ')) {
                return colorize(line, 'green');
              } else if (line.startsWith('Date: ') || line.startsWith('AuthorDate: ') || line.startsWith('CommitDate: ')) {
                return colorize(line, 'cyan');
              } else {
                return line;
              }
            }).join('\n') + '\n'
          : details + '\n';
        
        // 显示分支信息
        if (showBranches) {
          const branchesInfo = `所属分支: ${branches}`;
          output += `${branchesInfo}\n`;
          consoleOutput += useColor 
            ? `${colorize('所属分支:', 'magenta')} ${branches}\n` 
            : `${branchesInfo}\n`;
        }
        
        // 显示标签信息
        if (showTags) {
          const tagsInfo = `相关标签: ${tags}`;
          output += `${tagsInfo}\n`;
          consoleOutput += useColor 
            ? `${colorize('相关标签:', 'magenta')} ${tags}\n` 
            : `${tagsInfo}\n`;
        }
      }
      
      // 添加额外的换行
      output += '\n';
      consoleOutput += '\n';
      
      // 添加统计信息
      if (includeStats) {
        const statsSpinner = spinner.start(`正在获取提交 ${hash.substring(0, 8)} 的文件统计信息...`);
        const stats = getCommitStats(repoPath, hash);
        statsSpinner.stop();
        
        const statsTitle = '文件修改统计';
        output += `### ${statsTitle}\n\n${stats}\n\n`;
        consoleOutput += useColor 
          ? `${colorize(statsTitle, 'cyan')}\n\n${stats}\n\n` 
          : `### ${statsTitle}\n\n${stats}\n\n`;
      }
      
      // 添加补丁信息
      if (includePatch) {
        const patchSpinner = spinner.start(`正在获取提交 ${hash.substring(0, 8)} 的代码变更...`);
        const patch = getCommitPatch(repoPath, hash);
        patchSpinner.stop();
        
        const patchTitle = '代码变更';
        output += `### ${patchTitle}\n\n\`\`\`diff\n${patch}\n\`\`\`\n\n`;
        consoleOutput += useColor 
          ? `${colorize(patchTitle, 'cyan')}\n\n\`\`\`diff\n${colorizePatch(patch, useColor)}\n\`\`\`\n\n` 
          : `### ${patchTitle}\n\n\`\`\`diff\n${patch}\n\`\`\`\n\n`;
      }
      
      // 添加分隔线
      if (i < commitHashes.length - 1) {
        output += '---\n\n';
        consoleOutput += useColor 
          ? colorize('---------------------------------------------------\n\n', 'dim') 
          : '---\n\n';
      }
    }
    
    // 如果需要，添加汇总统计
    if (includeStats) {
      try {
        const summarySpinner = spinner.start('正在生成汇总统计...');
        const summaryCommand = `git -C "${repoPath}" log --author="${author}" --since="${since}" --until="${until}" --numstat${noMerges ? ' --no-merges' : ''}${maxCount ? ` --max-count=${maxCount}` : ''} | grep -v '^commit' | grep -v '^Author:' | grep -v '^Date:' | grep -v '^$' | awk '{ files += 1; inserted += $1; deleted += $2 } END { print "文件修改总数:", files, "\\n添加行数:", inserted, "\\n删除行数:", deleted }'`;
        const summary = execSync(summaryCommand, { encoding: 'utf-8' });
        summarySpinner.stop('汇总统计完成');
        
        const summaryTitle = '汇总统计';
        output += `## ${summaryTitle}\n\n` + summary + '\n';
        consoleOutput += useColor ? `\n${colorize(summaryTitle, 'bright')}\n${colorize('-'.repeat(summaryTitle.length), 'bright')}\n\n` : `\n## ${summaryTitle}\n\n`;
        
        // 为控制台添加彩色统计
        if (useColor) {
          const lines = summary.split('\n');
          lines.forEach(line => {
            if (line.includes('文件修改总数:')) {
              consoleOutput += line.replace(/文件修改总数: (\d+)/, `文件修改总数: ${colorize('$1', 'cyan')}`) + '\n';
            } else if (line.includes('添加行数:')) {
              consoleOutput += line.replace(/添加行数: (\d+)/, `添加行数: ${colorize('$1', 'green')}`) + '\n';
            } else if (line.includes('删除行数:')) {
              consoleOutput += line.replace(/删除行数: (\d+)/, `删除行数: ${colorize('$1', 'red')}`) + '\n';
            } else {
              consoleOutput += line + '\n';
            }
          });
        } else {
          consoleOutput += summary + '\n';
        }
      } catch (error) {
        const errorMsg = '无法生成汇总统计';
        output += `## ${errorMsg}\n\n`;
        consoleOutput += useColor ? `\n${colorize(errorMsg, 'red')}\n\n` : `\n## ${errorMsg}\n\n`;
      }
    }
    
    // 如果需要AI总结
    if (aiSummary && aiSummaryContent) {
      try {
        const summarySpinner = spinner.start('正在使用AI总结提交记录...');
        const aiResult = await summarizeWithAI(aiSummaryContent, author, since, until);
        summarySpinner.stop('AI总结完成');
        
        // 输出AI总结结果
        console.log(`\n${colorize('AI总结工作日报', 'bright')}\n${colorize('='.repeat('AI总结工作日报'.length), 'bright')}\n`);
        console.log(aiResult);
        
        // 如果指定了输出文件，保存AI总结结果
        if (outputFile) {
          const fileSpinner = spinner.start(`正在保存AI总结到文件: ${outputFile}`);
          fs.writeFileSync(outputFile, aiResult, 'utf-8');
          fileSpinner.stop(`AI总结已保存到文件: ${outputFile}`);
          return;
        }
      } catch (error) {
        console.error(colorize(`AI总结失败: ${error.message}`, 'red'));
        // 如果AI总结失败，输出原始日志
        console.log(consoleOutput);
      }
    } else {
      // 输出结果
      console.log(consoleOutput);
    }
    
    // 如果指定了输出文件且没有使用AI总结，保存原始结果
    if (outputFile && !aiSummary) {
      const fileSpinner = spinner.start(`正在保存结果到文件: ${outputFile}`);
      fs.writeFileSync(outputFile, output, 'utf-8');
      fileSpinner.stop(`结果已保存到文件: ${outputFile}`);
    }
  } catch (error) {
    console.error(colorize('执行出错:', 'red'), error.message);
    process.exit(1);
  }
}

// 执行主函数
getGitLogs();