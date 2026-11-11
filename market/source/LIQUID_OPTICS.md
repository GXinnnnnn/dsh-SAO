# dsh-SAO 1.0.6 液态玻璃光学升级

这轮实现独立编写，研究开源实现中的光学方法，没有引入这些项目的代码、资源或运行依赖。Three.js / Drei 是成熟的光学参考；其他液态玻璃项目主要作为浏览器效果演示对照。

## 光学与显示

- 现有圆角边界和椭圆角距离场决定真实轮廓、边缘方向及拼接开口。
- 截面采用独立推导的 `h(s)=(1-(1-s)^4)^.25`，其导数在内侧接到平整中心。边缘使用 Snell 折射，折射率 1.5；限制轮廓尖端斜率和最大位移。
- 中心不再整块放大或鼓起；背景内容依然对齐。前景 DOM 文字不参与折射。
- 高光由边缘方向决定。主光采用六次方向瓣，反向仅保留更弱的八次反射瓣；去掉与方向无关的白色 crest 和整圈 Fresnel 染白。反射保留背景色相，使用有上限的混合而非直接叠加白光，减少长顶栏上的泛白框。
- 降低宽肩部的覆盖率，让弯折后的背景承担边缘形态；窄而有方向的反光体现厚度。平整中心、Snell 折射位移和色散上限保持不变。
- 色散仅发生在弧形边缘，总红蓝通道间距不超过 0.85 CSS px。中心最多一次纹理采样，色散带最多三次。
- CSS 继续负责底色、透明度与文字可读性。磨砂玻璃、设置窗口共用玻璃和个人设置保持原有行为。

## 页面归属与性能边界

折射只读取显式传入、当前可见且已校验的本地壁纸。非会话页面、嵌套弹窗、Browser 内容或无法确认背景归属的区域使用当前页面的原生 CSS 背景模糊及细高光。启动动画独立管理自己的透明层，不参与普通窗口玻璃。

保留一个共享 WebGL2 上下文；每个表面最多 180,000 后备像素、最长边 1024、DPR 上限 1.5，最多 12 个表面。因此一次全部变脏的最坏批次仍可能包含约 216 万像素与 12 次 GL→2D 拷贝，这不是总预算只有 18 万像素。静止状态不持续绘制；渲染键缓存和滚动 30Hz 节流保留。

新增完全透明/不透明表面的 CPU 剔除，以及仅边缘表面的中心片元提前退出。复杂边缘比旧版增加最多两次采样；最终表现仍取决于表面数量、尺寸和 GPU。CPU 提交/拷贝时间与 GPU 执行时间需要分别报告。

## 苹果官方设计依据

2026-11-11 阅读 Apple WWDC25 的 [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) 与 [Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/) 正式讲解：以 lensing 集中和弯折背景光，反光随形状与光源方向变化；工具栏应清理额外背景和描边，避免多个玻璃层重复叠加；文字与控件保持在光学层上方。

本插件采用浏览器内独立编写的近似实现，不包含 Apple 原生材质代码，也不宣称与系统 Liquid Glass 像素一致。固定方向光不引入跟随指针的持续动画。当前顶栏按实际 DOM 样式逐层检查，已拼接顶栏不再额外加一圈 CSS 光框；键盘焦点与选中状态仍各自表达交互语义。

## 已检查的上游源码与许可证

2026-11-11 检查以下固定提交的实际实现及 MIT 许可证；未来若复制实现代码，仍须保留相应完整许可证及继承来源。本轮只研究方法，现有 ACG 改编来源的声明继续保留在 `THIRD_PARTY_NOTICES.md`。

| 参考 | 固定源码 | 本轮取舍 |
| --- | --- | --- |
| Three.js | [transmission shader](https://github.com/mrdoob/three.js/blob/b5a9e5730f6122498e187da8f7cdedd4358f5aa0/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js) · [MIT](https://github.com/mrdoob/three.js/blob/b5a9e5730f6122498e187da8f7cdedd4358f5aa0/LICENSE) | 研究 Snell / Fresnel / RGB 折射率；不引入场景缓冲和粗糙度多次采样 |
| Drei | [MeshTransmissionMaterial](https://github.com/pmndrs/drei/blob/bf6f4addf47467d3885de272d94ca5127f6ef68f/src/core/MeshTransmissionMaterial.tsx) · [MIT](https://github.com/pmndrs/drei/blob/bf6f4addf47467d3885de272d94ca5127f6ef68f/LICENSE) | 研究共享输入缓冲和零色散快速路径；不引入 useFrame 和离屏场景 |
| Rdev | [component/filter](https://github.com/rdev/liquid-glass-react/blob/ac48eab18d1f7f444ae30002d240cae29c863a21/src/index.tsx) · [MIT](https://github.com/rdev/liquid-glass-react/blob/ac48eab18d1f7f444ae30002d240cae29c863a21/LICENSE) | 保持前景文字与变形背景分离；使用自己的真实边缘遮罩 |
| Shuding | [liquid-glass.js](https://github.com/shuding/liquid-glass/blob/a2d2e847f793430e3409a52927af815a23f4d372/liquid-glass.js) · [MIT](https://github.com/shuding/liquid-glass/blob/a2d2e847f793430e3409a52927af815a23f4d372/LICENSE) | 研究距离场；避免 CPU 位移贴图的量化与生命周期问题 |
| Dashersw | [container.js](https://github.com/dashersw/liquid-glass-js/blob/78cb6ccb0b9987bb60a88b14ccbd13a9e6e8ab2a/container.js) · [MIT](https://github.com/dashersw/liquid-glass-js/blob/78cb6ccb0b9987bb60a88b14ccbd13a9e6e8ab2a/LICENSE) | 研究边缘距离带；不使用文档截图、连续 RAF 或高采样模糊 |

[Kube 的截面文章](https://kube.io/blog/liquid-glass-css-svg/)提供数学解释，但未找到其仓库的代码许可，因此不复制实现。其 SVG 位移范围说明应以 [MDN 的公式](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap)为准：`scale * (channel - .5)`，范围约为 `±scale/2`。

## 验证

`tests/liquid-optics-browser.test.mjs` 使用真实 WebGL，对照升级前源码的网格/壁纸合成结果，检查中心、边缘、明暗配色、圆角和拼接、透明度端点、缓存、上下文恢复及资源清理。页面归属、启动透明层和设置滚动由已有回归继续保护。像素回读只用于测试，产品运行不读取聊天或 DOM 像素。
