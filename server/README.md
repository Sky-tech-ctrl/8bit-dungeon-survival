# 账号 / 存档后端

和前端一样是**零依赖**的：只用 Node 内置模块（`http` / `crypto` / `fs` / `path`），
不需要 `npm install`，也不需要注册任何第三方服务。

## 跑起来

```bash
node server/index.js
```

然后打开 <http://localhost:8080/> —— 它同时托管仓库根目录的静态文件，
所以这一条命令就把「游戏 + 后端」一起起来了。前端会自动探测到同源后端并切到
**云端存档**模式（标题界面左下角的圆点会变绿）。

环境变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8080` | 监听端口 |
| `DB_FILE` | `server/db.json` | 数据文件路径 |

```bash
PORT=3000 node server/index.js
DB_FILE=/data/8bit.json node server/index.js
```

## 前端部署在别处时（比如 GitHub Pages）

游戏本身是纯静态的，在 GitHub Pages 上照样能玩，只是存档存在浏览器
localStorage 里。想让它连到你的后端：

在标题界面左下角点**「设置」**，填入后端地址（例如 `http://localhost:8080`）即可。
地址会记在 `localStorage['api_base']`，之后自动连接。

也可以在 `index.html` 里写死：

```html
<script>window.API_BASE = 'https://your-backend.example.com';</script>
```

CORS 已经开好，跨域访问不需要额外配置。

## 接口

除 `/api/health`、`/api/register`、`/api/login` 外，其余接口都需要带
`Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查。前端就是靠它判断「后端在不在」 |
| POST | `/api/register` | `{username, password}` → `{ok, token, username}` |
| POST | `/api/login` | 同上 |
| POST | `/api/logout` | 使当前 token 失效 |
| GET | `/api/me` | 返回当前用户名 |
| GET | `/api/saves` | 10 个槽位的**元信息**（不含快照本体） |
| GET | `/api/saves/:slot` | 取某个槽位的完整存档 |
| PUT | `/api/saves/:slot` | `{name, snapshot}` |
| DELETE | `/api/saves/:slot` | 清空某个槽位 |
| GET/PUT | `/api/notes` | 「游戏心得」纯文本，每账号一份 |

存档列表接口刻意只回元信息 —— 快照可能有几百 KB，
列表页没理由把 10 份全拖下来。

## 关于安全性

这是个玩具项目，但没有理由把密码存成明文：

- 密码用 **scrypt + 每用户随机盐**做哈希，只存哈希
- 比对哈希用 `timingSafeEqual`，不泄漏匹配了几位
- 登录失败时，「用户不存在」和「密码错误」返回同一句话，不给撞库的人做用户名枚举
- 会话是随机 32 字节 token，30 天过期，存服务端
- 静态文件服务做了目录穿越防护（解析后必须仍在仓库根之内）
- `db.json` 用「临时文件 + rename」原子写入，进程被杀不会写坏文件

**但它没有做**：速率限制、HTTPS、验证码、日志审计。
放到公网请套一层反向代理（Nginx / Caddy）并加上 TLS 和限流，
不要让它裸奔。

`db.json` 里存着所有账号和存档，已在 `.gitignore` 中排除，别提交上去。
