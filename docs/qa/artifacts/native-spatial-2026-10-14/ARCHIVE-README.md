# 原生生成证据归档

正常代表结果为1/5；后续共同初始化试验0/5并已精确撤回。展示页见 representative-review/index.html。

为避免把数百万行中间几何与诊断日志铺入代码diff，完整不可变原始证据、二进制快照和捕获bundle封装于 raw-evidence.tar.gz。现有本地原文件保持，不删除。

在本目录运行 `tar -xzkf raw-evidence.tar.gz` 可补齐原路径；`-k` 保留已存在的文件。QA文档及tools中的原路径在解包后有效。src、data和tools生产/验证源码独立按普通文本提交，不藏在此包中。
