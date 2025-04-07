# Git用户日志工具发布指南

本文档提供了将Git用户日志工具发布到npm的步骤。

## 准备工作

1. 确保你有一个npm账号，如果没有，请在[npmjs.com](https://www.npmjs.com)注册

2. 登录到npm：
   ```bash
   npm login
   ```

3. 更新package.json中的以下字段：
   - `version`: 每次发布前增加版本号
   - `author`: 填写你的名字和邮箱
   - `repository.url`: 更新为你的GitHub仓库地址
   - `bugs.url`: 更新为你的GitHub仓库issues地址
   - `homepage`: 更新为你的GitHub仓库主页

## 发布步骤

1. 确保所有代码变更已提交并推送到GitHub

2. 确保所有文件都有正确的执行权限：
   ```bash
   chmod +x git-user-log.js
   chmod +x install.js
   ```

3. 检查是否所有必要的文件都会被包含在发布中：
   ```bash
   npm pack
   ```
   这将创建一个tar包而不实际发布。检查生成的.tgz文件内容，确保包含所有必要的文件，并且没有不需要的文件。

4. 选择版本更新类型并发布：
   ```bash
   # 补丁版本更新 (修复bug等小变更)
   npm version patch

   # 次要版本更新 (添加新功能，但向后兼容)
   npm version minor

   # 主要版本更新 (重大变更，可能不向后兼容)
   npm version major
   ```

5. 发布到npm：
   ```bash
   npm publish
   ```

   发布成功后，用户可以通过以下方式使用：
   - 全局安装: `npm install -g g2log`
   - 直接运行: `npx g2log [选项]`

6. 发布成功后，为该版本创建一个GitHub release：
   ```bash
   git push --tags
   ```
   然后在GitHub上创建对应的release。

## 更新已发布的包

1. 进行代码修改

2. 更新版本号：
   ```bash
   npm version patch  # 或minor或major
   ```

3. 再次发布：
   ```bash
   npm publish
   ```

## 撤回发布

如果发现发布的版本有严重问题，可以在发布后24小时内撤回：

```bash
npm unpublish g2log@x.y.z  # 替换x.y.z为要撤回的版本号
```

## 本地测试

在正式发布前，可以使用以下命令进行本地测试：

```bash
# 在本地创建全局链接
./local-install.sh

# 测试命令
g2log --help

# 完成测试后，移除本地链接
npm unlink g2log
```

## NPX测试

发布前测试npx调用：

```bash
# 先打包但不发布
npm pack

# 使用本地包进行测试
npx -p ./g2log-x.y.z.tgz g2log --help
``` 