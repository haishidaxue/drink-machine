# ⚠️ 公开仓库前必读（安全 / 隐私清单）

本仓库代码本身**不含任何硬编码密钥**：所有 API Key、商户号、私钥都通过环境变量或
未纳入版本控制的真实配置文件读取（仓库里只保留 `*.example.json` 模板，`.gitignore` 已排除真实配置与证书）。

但前端图片素材中包含**真实的个人收款信息**，开源前请按需处理：

## 需要你确认的素材

| 文件 | 内容 | 建议 |
| --- | --- | --- |
| `frontend/commercial/images/wxpay.webp` | 微信收款码（商用下单扫码付款用） | 公开仓库建议替换为示例码或删除 |
| `frontend/commercial/images/wxpay-new.png` | 微信收款码（新版） | 同上 |
| `frontend/commercial/images/wxqr-card.png` | 微信收款卡片图 | 同上 |
| `frontend/personal/images/wxpay*.png/.webp`、`wxqr-card.png` | 个人版中同套收款图 | 个人版理论上免付款，确认无引用后可删 |

> 这些收款码是程序「微信收款」功能能真实收款所必需的素材，因此默认随源码保留；
> 如果你要把仓库设为 **Public（公开）**，任何人都能看到并扫码，建议先替换成占位图。
> 仅本地或私有仓库使用则无需处理。

## 快速脱敏（可选）

把上述图片替换成同名占位图即可，代码无需改动（路径不变）。或直接删除文件，
对应收款弹窗将显示破图，但不影响其余功能。

## 后端密钥（本仓库未包含，提醒勿误传）

`backend-optional/` 下服务运行需要以下值，请只放在环境变量或本地配置文件中：

- `ARK_API_KEY`（火山方舟出图）
- `LLM_API_KEY`（Kimi / 豆包 / DeepSeek）
- 微信支付：`WX_APPID / WX_MCHID / WX_SERIAL / WX_APIV3_KEY / WX_APPSECRET` + `certs/apiclient_key.pem`
- 支付宝：`ALI_APPID` + `certs/*.pem`

`.gitignore` 已默认排除 `.env`、`配置.json`、`*.pem`、`certs/`。
