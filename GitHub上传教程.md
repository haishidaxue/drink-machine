# 上传到 GitHub 教程

仓库文件夹：`drink-machine/`（即本文件夹的上一级）。共两种方式，任选其一。

---

## 方式一：网页直接拖拽上传（最简单，不用装任何东西）

1. 打开 https://github.com 并登录（没有账号先注册，免费）。
2. 右上角 **+ → New repository**。
3. Repository name 填 `drink-machine`；选 **Private（私有）** 或 **Public（公开）**。
   - 若选 Public，先看上级目录的 `SECURITY-NOTICE.md`（收款码素材）。
   - **不要**勾选 “Add a README / .gitignore / license”（本地都已有，避免冲突）。
4. 点 **Create repository**。
5. 在新页面点 **uploading an existing file**（或 “uploading files” 链接）。
6. 把本地 `drink-machine` 文件夹**里面的全部内容**（含 `frontend`、`.gitignore`、`README.md`、`LICENSE` 等）拖进去。
   - 注意：拖的是文件夹**里的内容**，不是外面再套一层。
7. 等文件传完（约 27MB，图片较多，耐心等进度条），下方 Commit message 可写“初始提交”，点 **Commit changes**。
8. 完成，仓库地址形如 `https://github.com/你的用户名/drink-machine`。

> 网页方式一次最多建议传 100 个文件；本仓库约 100 个文件，若提示超限，分几次拖拽提交即可，
> 或改用方式二。单文件需小于 100MB，本仓库最大文件约 3.5MB，无压力。

---

## 方式二：命令行 Git（推荐，便于以后更新）

前置：安装 Git（https://git-scm.com 下载，一路默认安装）。

在 `drink-machine` 文件夹内打开终端（Windows：在文件夹空白处右键 → “在终端中打开”），执行：

```bash
git init
git add .
git commit -m "初始提交：智能饮品配置机 个人版+商用版 v27"
git branch -M main
git remote add origin https://github.com/你的用户名/drink-machine.git
git push -u origin main
```

- 把 `你的用户名` 换成实际的 GitHub 用户名（仓库需先按方式一第 2–4 步在网页上创建空仓库）。
- 第一次 push 会弹浏览器登录授权，按提示登录即可。
- 以后更新代码，只需三条：

```bash
git add .
git commit -m "说明本次改了什么"
git push
```

---

## 用 GitHub Pages 直接在线访问（可选）

仓库上传后可白嫖一个在线网址：

1. 仓库页 **Settings → Pages**。
2. Source 选 **Deploy from a branch**，Branch 选 `main`、目录选 `/root`，保存。
3. 等 1–2 分钟，在同一页面会给出 `https://你的用户名.github.io/drink-machine/`。
4. 因为首页在子目录，访问具体程序用：
   - 个人版：`https://你的用户名.github.io/drink-machine/frontend/personal/index.html`
   - 商用版：`https://你的用户名.github.io/drink-machine/frontend/commercial/index.html`

> 想让某个版本成为打开根路径就出现的首页，可后续在仓库根加一个跳转页，或把对应版本部署到独立仓库。
