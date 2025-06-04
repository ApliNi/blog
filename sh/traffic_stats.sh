#!/bin/sh

# 配置部分
INTERFACES="phy0-sta0 br-wan br-wan6"  # 要监控的网口列表
STAT_FILE="./traffic_stats.txt"  # 只保存最后一次的状态


# 字节转换为易读格式函数
format_bytes() {
    local bytes=$1
    local units="KB MB GB TB PB"
    local unit="B"
    
    for u in $units; do
        if [ $bytes -ge 1024 ]; then
            bytes=$((bytes / 1024))
            unit=$u
        else
            break
        fi
    done
    
    echo "$bytes$unit"
}

# 获取系统启动时间（秒）
get_uptime() {
    cut -d' ' -f1 /proc/uptime | cut -d. -f1
}

uptime=$(get_uptime)
datetime=$(date "+%Y-%m-%d %H:%M:%S")

# 初始化总流量变量
total_rx=0
total_tx=0

# 存储各网口流量的变量
iface_info=""

# 遍历所有指定网口获取流量统计
for iface in $INTERFACES; do
    # 检查网口是否存在
    if [ -d "/sys/class/net/$iface" ]; then
        rx_bytes=$(cat /sys/class/net/$iface/statistics/rx_bytes 2>/dev/null || echo 0)
        tx_bytes=$(cat /sys/class/net/$iface/statistics/tx_bytes 2>/dev/null || echo 0)

        rx_formatted=$(format_bytes $rx_bytes)
        tx_formatted=$(format_bytes $tx_bytes)
        iface_info="$iface_info  - $iface: 下行: $rx_formatted ($rx_bytes), 上行: $tx_formatted ($tx_bytes)\n"

        total_rx=$((total_rx + rx_bytes))
        total_tx=$((total_tx + tx_bytes))
    fi
done

# 默认值
last_rx=0
last_tx=0
last_uptime=0

# 如果存在旧的状态文件，则读取
if [ -f "$STAT_FILE" ]; then
    last_uptime=$(cut -d',' -f1 "$STAT_FILE" 2>/dev/null || echo 0)
    last_rx=$(cut -d',' -f2 "$STAT_FILE" 2>/dev/null || echo 0)
    last_tx=$(cut -d',' -f3 "$STAT_FILE" 2>/dev/null || echo 0)
fi

delta_rx=$((total_rx - last_rx))
delta_tx=$((total_tx - last_tx))
time_diff=$((uptime - last_uptime))

rx_rate=0
tx_rate=0
if [ $time_diff -gt 0 ]; then
    rx_rate=$((delta_rx / time_diff))
    tx_rate=$((delta_tx / time_diff))
fi

# 覆盖写入新的状态（只保留最后一次）
echo "$uptime,$total_rx,$total_tx" > "$STAT_FILE"


# 输出结果
echo ""
echo "日期: ${datetime}, 时间: ${uptime}s, 间隔: ${time_diff}s"

echo ""
echo "网口信息:"
printf "${iface_info}"

echo ""
echo "总计流量:"
echo "  - 下行: $(format_bytes $total_rx), 增量: $(format_bytes $delta_rx), 速率: $(format_bytes $rx_rate)/s"
echo "  - 上行: $(format_bytes $total_tx), 增量: $(format_bytes $delta_tx), 速率: $(format_bytes $tx_rate)/s"

echo ""
