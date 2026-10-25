# 智能饮品配置机（AI Drink Machine）

纯前端、零后端即可运行的 AI 现调饮品小程序原型，分**个人版（用户端）**与**商用版（主后台）**两套界面。
聊天式描述口味 → 按四格原料库现货现场调配 → 3D 高脚杯风味占比 → 微信收款（商用）/ 免付款（个人）。
默认零 Key、离线可开：AI 能力在无服务端时走内置合规规则本地兜底，配上可选后端或密钥后自动切换真实大模型与出图。

> 当前线上版本 **v27**：单击麦克风语音录入、再单击发送、双击取消；每条 AI 回复自动中文女声朗读，新提问打断旧朗读；商用版进入前需注册/登录；库存「诚实闸门」——无货如实拒单，不凭空变出原料。

---

## 目录结构

```
drink-machine/
├─ frontend/                     # ★ 当前主力产品：零后端纯静态前端
│  ├─ personal/                  # 个人版（用户端）
│  │  ├─ index.html              # 页面结构（双击即可打开运行）
│  │  ├─ style.css               # 样式
│  │  ├─ app.js                  # 全部交互逻辑
│  │  ├─ grid.html / grid.css / grid.js  # 四格原料库（与主程序同源 localStorage 互通）
│  │  └─ images/                 # 图片素材（饮品图、背景、收款码等）
│  └─ commercial/                # 商用版（主后台）
│     ├─ index.html / style.css / app.js
│     ├─ board.html / board.css / board.js  # 商用原料库四格看板
│     └─ images/
├─ wechat-miniprogram/           # 微信小程序版骨架（早期方案，参考）
├─ backend-optional/             # 可选 Node 后端（当前前端不依赖，留作接真 AI / 真支付）
│  ├─ server-orchestration.js    # 主编排服务（文本+出图+支付聚合）
│  ├─ text-ai-proxy.js           # 文本大模型中转（Kimi / 豆包 / DeepSeek）
│  ├─ image-server.js            # 豆包 Seedream 出图服务
│  ├─ payment-server.js          # 微信支付 / 支付宝服务端
│  └─ *.example.json             # 配置模板（复制后填 Key，真实配置勿提交）
├─ tools/patches/                # 历次演进补丁脚本（口味/高脚杯/原料库/库存闸门/语音/登录）
├─ docs/                         # 架构图、高保真原型、账本等设计文档
├─ assets/                       # 参考出图、PPT 素材、线上二维码
├─ .gitignore
├─ LICENSE
└─ SECURITY-NOTICE.md            # ★ 公开仓库前必读
```

## 本地运行

前端零依赖、无需构建：

- 个人版：直接双击 `frontend/personal/index.html`
- 商用版：直接双击 `frontend/commercial/index.html`
- 四格原料库：个人版打开 `frontend/personal/grid.html`，商用版打开 `frontend/commercial/board.html`
  （需与对应主程序**同源**打开，浏览器本地存储 `localStorage` 才会互通；部署到同一静态站点域名下即可）

> `index.html / style.css / app.js / images/` 必须保持同级目录结构，图片才能正常加载。
> 单文件版本由平台部署时自动内联，源码仓库按标准的 HTML+CSS+JS+assets 拆分。

## 部署到静态托管（与现网一致）

整套前端是纯静态文件，可直接部署到任意静态托管：

- **Coze Pages / Cloudflare Pages / Vercel / Netlify / GitHub Pages**：把 `frontend/personal` 或 `frontend/commercial` 作为站点根目录上传即可。
- 现网地址：
  - 商用版：https://ytcvgmjfp2.page.coze.site
  - 个人版：https://wxxpm2kyyj.page.coze.site

## 接入真实 AI / 支付（可选）

前端在没有后端时用内置规则兜底，机器不停。需要真实大模型理解、真实 AI 出图或真实支付时，
参考 `backend-optional/` 下各 `*.md` 说明，复制对应的 `*.example.json` 为真实配置并通过环境变量注入密钥：

- 文本：Kimi K3（默认）/ 火山豆包 / DeepSeek，见 `backend-optional/text-config.example.json`
- 出图：火山方舟豆包 Seedream，见 `backend-optional/image-config.example.json`
- 支付：微信支付 V3 / 支付宝，见 `backend-optional/payment-config.example.json`

**密钥只走环境变量或本地配置文件，绝不写进前端、绝不提交仓库。**

## 数据与安全提示

- 登录账户、四格原料库、订单账本均保存在浏览器 `localStorage`，无服务端数据库。
- 公开仓库前请先阅读 **[SECURITY-NOTICE.md](SECURITY-NOTICE.md)**（内含真实收款码等需自行确认的素材）。

## 许可

MIT License，详见 [LICENSE](LICENSE)。
