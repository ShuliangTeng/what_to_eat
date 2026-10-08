# 今天吃什么

两个人用的晚饭决定助手。它帮你们选今天吃什么、排一个可以随时改的一周菜单、看冰箱里有什么，并算出还要买什么。

这不是菜谱应用：没有步骤，也没有图片。晚饭默认两个人。一周菜单是建议，不是必须执行的日程。哪天不做饭、出去吃、改期，都可以。只有明确点过「标记做好了」的菜才会记进做过的记录。跳过某一天不会被当成不爱吃。

界面全部是简体中文。

## 本地运行

需要 Node.js 20 以上。

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

没有配置 Supabase 时，应用会进入**演示模式**。页面顶部会写明：数据只保存在这台设备的浏览器里，换设备或清除缓存就会消失，也不会和另一位家人同步。

## 检查

```bash
npm run lint
npm run typecheck
npm run build
npx tsx scripts/recommend-check.ts
```

## 配置 Supabase

1. 在 [Supabase](https://supabase.com/dashboard) 创建一个项目。
2. 复制 `.env.example` 为 `.env.local`。
3. 填入项目 URL，以及 Publishable key。如果控制台仍显示 anon key，填到 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 即可。
4. 不要把 `service_role` 或 secret key 放进 `.env.local`，更不要加上 `NEXT_PUBLIC_` 前缀。
5. 打开 Supabase 的 SQL Editor，运行 `supabase/migrations/20261008190000_init.sql` 的全部内容。
6. 在 Authentication → Sign In / Providers 里启用 Anonymous。不要把 service role 放进浏览器。
7. 重新运行 `npm run dev`。

打开网站就会进入今天的菜单，不需要邮箱。每台设备有自己的会话，会话放在浏览器不能读取的 Cookie 里。要和另一个人共用，打开「另一台设备」，生成一次性配对码，让对方在自己的手机上输入。配对码大约 10 分钟内有效，用过就作废。一个菜单最多两台设备。

首次进入空的家庭时，应用会写入内置菜库，并生成当周建议。演示模式另外放了一点示例库存，方便直接看到「家里有什么」。正式家庭的冰箱一开始是空的。

## 放到 GitHub

本目录可以单独作为仓库。如果还没有远程仓库：

```bash
git add .
git commit -m "Add the meal planning app"
git branch -M main
git remote add origin https://github.com/ShuliangTeng/what_to_eat.git
git push -u origin main
```

`.env.local` 已被 `.gitignore` 排除。`.env.example` 可以提交，里面没有真实密钥。

## 部署到 Vercel

1. 把 GitHub 仓库导入 [Vercel](https://vercel.com/new)。
2. Framework 选 Next.js，安装命令用 `npm install`。
3. 在项目的 Environment Variables 里添加与 `.env.local` 相同的 `NEXT_PUBLIC_SUPABASE_URL` 和 publishable/anon key。不要添加 service role。
4. 部署完成后打开线上地址，确认直接进入今天的菜单。
5. 在「另一台设备」里生成配对码，用第二台手机加入，确认两边看到同一份菜单。

这份说明没有替你创建项目或完成部署。没有你自己的 Supabase 和 Vercel 账号，就不能声称已经上线。

## 推荐是怎么排的

排序是固定规则，同一份菜库和库存会得到同一份结果，不是随机拼菜名。它会看：

- 主要食材是否已经在家，而且单位能够换算
- 同一周里能不能把刚买的东西用第二次
- 标记了「尽快用」的食材
- 常做菜优先，补充菜库优先级更低
- 你点过「就吃这个」「常吃」会略微加分；反复换掉会略微减分
- 工作日避开费时的菜，一周最多一顿费时的
- 不安排大量油炸
- 荤素搭配，但不要求每天换一种叶子菜
- 若打开福州口味，一周里可以有一两顿福州家常
- 若打开每周新菜，一周给 1 到 2 道可选新菜，并标明这不是默认最爱

添加新菜时，如果菜名和内置模板完全一致，会填一份可编辑的用料草稿，并说明这是本地模板。没有模板时，会请你自己填写，不会假装已经接了 AI。`lib/draft.ts` 里的 `IngredientDrafter` 是以后接真实 AI 的位置。

食材名称只去掉首尾空格后精确比较，不会把「番茄」和「西红柿」并成一样。

购物清单只统计状态为「建议」或「就吃这个」的晚饭。单位相同，或同属重量（克、斤、千克）、同属体积（毫升、升）时，才会扣库存。单位对不上会写明原因，不会偷偷扣。已购买的项目在菜单改动后仍然保留；如果已经放进冰箱，就不会再和库存重复扣一次。

## 限制

- 没有接真正的 AI，未知菜名不能自动生成用料。
- 做完饭不会自动减少冰箱数量。
- 一位用户只能加入一个家庭，每个家庭最多两人。
- 两人同时改同一项时，后保存的会覆盖先保存的。
- 演示数据不能跨设备。
- 仓库里没有真实密钥，也没有已经成功的部署记录。
