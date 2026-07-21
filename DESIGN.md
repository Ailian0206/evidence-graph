# Evidence Graph Design Direction

## Visual thesis

Neutral Product Studio：以矿物白和纸灰承载作品集与研究工具，近黑文字负责层级，森林绿只用于主要动作和验证状态，朱红用于错误与反驳。界面必须清晰、安静、可扫描，不使用编辑式衬线、渐变、装饰光斑或模板化卡片墙。

## Typography

- 中文优先使用 `PingFang SC`、`Microsoft YaHei` 与系统无衬线；英文使用同一字体栈。
- 首页 `Ailian` 是唯一品牌级标题；公共页标题与工具页标题使用固定字号，不随 viewport 连续缩放。
- 正文为 14–16px，辅助信息不低于 12px；只有图谱画布节点允许 10–11px。
- 数量、日期、成本和表格数字使用等宽数字；所有文字 letter spacing 为 0。

## Density

- 公共页面 section 以 48–64px 垂直间距为主，移动端为 36–48px。
- 工具页面使用 8–24px 间距，控件高度为 40–44px，不用缩小字号换取密度。
- 首页首屏必须露出下一段作品内容；登录、空状态和错误页不保留 72–112px 的无任务空白。

## Components

- 页面 section 不包装为浮动卡片；卡片只用于重复项目、模态框和真实工具边界。
- 圆角不超过 6px，不使用胶囊标签；选中、引用和分区不用左侧装饰线。
- 熟悉命令使用 lucide 图标并提供 `aria-label` 与 `title`；模式使用 segmented control，二进制筛选使用 checkbox。
- Evidence Graph 图谱继续作为真实产品视觉，画布可保持深色，但页面框架保持浅色。

## Accessibility

- 中文路由完整使用中文，英文路由提供一一对应翻译；品牌名和技术名可保留英文。
- 提供 skip link、active navigation、可见 `:focus-visible`、移动菜单 Esc 关闭和至少 40×40px 触控目标。
- hover 同时提供 focus-visible；reduced motion 关闭非必要动画。
- 390×844、1024×768、1440×1000 均不得出现横向溢出、裁切、重叠或动态布局跳动。
