# dsh-SAO 市场构建来源

此包从仓库根目录的预构建 startup.js 生成，没有修改原生场景方程、音频或图标。
重建：在仓库根目录运行 `python source/build-market.py`。
原始移植参数、音频与素材哈希见 https://github.com/GXinnnnnn/dsh-SAO/blob/main/SOURCE.md 。

index.js 是实际 Host 入口；client.js 是完整动画的 Web 回退入口。客户端 ctx dispose 会调用同一动画实例的 stop，释放运行中的资源。一次页面加载只播放一次，重新启用不会额外重播。
