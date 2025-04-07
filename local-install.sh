#!/bin/bash

# 用于本地测试的安装脚本

echo "开始本地安装测试..."

# 确保脚本有执行权限
chmod +x git-user-log.js
chmod +x install.js

# 执行npm link，创建全局符号链接
npm link

# 检查安装是否成功
if [ $? -eq 0 ]; then
  echo "本地安装测试成功！您现在可以使用 'g2log' 命令了。"
  echo "如需卸载测试版本，请运行 'npm unlink git-user-log'"
else
  echo "安装测试失败，请检查错误信息。"
fi 