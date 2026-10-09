# I14 真实设备复验包

候选：r100-native-v3-revision-6-internal-rc-20261008。此包包含当前冻结游戏与四个既定重档性能诊断，不含用户存档。性能结果不替代实际审听或用户终验，也不能仅凭运行成功认定设备较弱。

在真实设备解压，安装 Node.js 22 或以上和 Google Chrome。在包目录打开终端：

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm install --prefix .i14-runtime --ignore-scripts --no-audit --no-fund
node tools/qa/run-r100-i14-device.mjs --preflight
```

将 device-template.json 复制为 device.json，填写实际设备及运行条件。关闭其他高负载任务，把 exclusiveWindow 改为 true，然后：

```sh
node tools/qa/run-r100-i14-device.mjs --run --device device.json
```

Chrome 未自动找到时加 `--chrome "完整可执行文件路径"`。四个场景固定种子 20261004、重档、1440×1000 浏览器视口、默认 DPR 1，正常身体、敌人、伤害与时钟，串行各 61.2 秒。它们是开发巡览场景和固定按键路线，不是自然经营出击；不会计入48趟。等待报告生成，把 device-results 下本次完整文件夹返还，包括失败记录，不挑选成功重跑。

若要实际玩、看、听正式入口，可运行：

```sh
node tools/qa/run-r100-i14-device.mjs --play
```

这会打开隔离的 Chrome 临时窗口和可用本机端口（默认5173，已占用时自动顺延）；窗口内是正式主菜单，用户原有存档不进入该窗口。关闭窗口结束。主游戏新档与开发巡览给装不可混称。记录实际播放设备、音量、时长、地点和问题；不要求听满一个人为规定的分钟数。

返回设备规格用于与参考机 M4 Pro／14逻辑核／48GiB／20核GPU 比较。软件降速不算另一台硬件。运行模式的帧、CPU与材料提交预算沿原合同，源 SHA 和原失败均保留。Windows/Linux 的包运行尚待实机验证；本机打包/预检不冒充跨系统验证。
