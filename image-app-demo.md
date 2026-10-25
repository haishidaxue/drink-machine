# AI 饮品出图 — 接入说明

## 这次改对了什么
- **只画这一杯饮料**：画面里绝不出现人/女生/手（"适合女生、治愈、温柔"这类词只当作风味语气，不画人物）。
- **只用机器里真有的 4 种原料**：东方树叶（乌龙/红茶等茶底）、水溶C、100%橙汁、纯牛奶，外加冰/水。
  - 青柠、柠檬片、薄荷、香草枝、花朵、珍珠、椰果等**一律从提示词剥离**，模型不会再"脑补"。
- **没有气泡技术**：顾客要气泡/苏打/汽水时，文案明确致歉，并自动改推一杯不带气泡、同样清爽的冰橙茶；画面也禁止气泡水。
- 出图模型默认走**火山方舟豆包 Seedream 4.0**（画质好、国内直连）；无 Key 时降级公共出图并同样做净化。
- 文本理解默认走 **Kimi K3**（见 `文本AI后端中转_server.js` / `文本配置.example.json`）。

## 启动
```bash
# 图片后端（默认 8788）
ARK_API_KEY=你的方舟Key PORT=8788 node 图片生成后端_server.js
# 或把 图片配置.example.json 复制为 图片配置.json 填好
```

## 接口
- `GET /health`：`{ ok, seedream:true/false, model, fallback }`
- `POST /api/image/prompt`：只返回净化后的提示词（可审）
- `POST /api/image/generate`：
  ```json
  {"name":"橙香乌龙冰茶","desc":"清爽解腻","mood":"适合女生",
   "ingredients":{"tea":true,"milk":false,"c":true,"orange":true,"ice":true},
   "temp":"cold"}
  ```
  返回 `{ provider:"seedream", url, prompt, seed }`；无 Key 时 `provider:"pollinations", degraded:true, need:["ARK_API_KEY"]`。

## 与前端/小程序同步
- 独立应用：浏览器打开 `AI饮品出图应用.html`（或访问后端 `/AI饮品出图应用.html`），在"设置"里填后端地址即可。
- 小程序原型 `饮料机_高保真原型.html` 的 `IMGAI` 模块默认请求同主机 `:8788`；部署到公网后执行一次
  `IMGAI.useBackend("https://你的域名")`（地址存 localStorage `dm_img_srv`）。

## 还差你给的一样东西
真实豆包高清图需要 **火山方舟 ARK_API_KEY**（当前沙箱里没有）。给我 Key，我就用真实 Seedream 出一批样图并替换降级链路。
> 已用平台直连豆包 Seedream 验证过出图合规性，样图见 `图片/样图_橙香乌龙冰茶.jpg`、`样图_橙香红茶拿铁.jpg`、`样图_热红茶奶茶.jpg`（均无人、无青柠薄荷、无气泡）。
