#!/bin/sh

# 配置部分
INTERFACES="phy0-sta0 br-wan br-wan6"  # 要监控的网口列表
STAT_FILE="./network_stats.log"  # 统计文件路径


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

# 获取当前时间戳
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
        # 读取RX和TX字节数
        rx_bytes=$(cat /sys/class/net/$iface/statistics/rx_bytes 2>/dev/null || echo 0)
        tx_bytes=$(cat /sys/class/net/$iface/statistics/tx_bytes 2>/dev/null || echo 0)
        
        # 保存各网口流量信息
        rx_formatted=$(format_bytes $rx_bytes)
        tx_formatted=$(format_bytes $tx_bytes)
        iface_info="$iface_info  - $iface: 下行: $rx_formatted ($rx_bytes), 上行: $tx_formatted ($tx_bytes)\n"
        
        # 累加到总流量
        total_rx=$((total_rx + rx_bytes))
        total_tx=$((total_tx + tx_bytes))
    fi
done

# 读取上一次的统计结果
last_rx=0
last_tx=0
last_uptime=0

if [ -f "$STAT_FILE" ]; then
    # 读取最后一行有效数据
    last_line=$(grep -E "^[0-9]+,[0-9]+,[0-9]+$" "$STAT_FILE" | tail -n 1)
    if [ -n "$last_line" ]; then
        last_uptime=$(echo "$last_line" | cut -d ',' -f 1)
        last_rx=$(echo "$last_line" | cut -d ',' -f 2)
        last_tx=$(echo "$last_line" | cut -d ',' -f 3)
    fi
fi

# 计算增量（基于系统运行时间差）
delta_rx=$((total_rx - last_rx))
delta_tx=$((total_tx - last_tx))
time_diff=$((uptime - last_uptime))

# 计算速率（字节/秒）
rx_rate=0
tx_rate=0
if [ $time_diff -gt 0 ]; then
    rx_rate=$((delta_rx / time_diff))
    tx_rate=$((delta_tx / time_diff))
fi

# 如果统计文件不存在则创建并写入标题
if [ ! -f "$STAT_FILE" ]; then
    echo "# Uptime(sec),Total_RX(bytes),Total_TX(bytes)" > "$STAT_FILE"
fi

# 检查是否有变化才写入新数据
if [ $delta_rx -ne 0 ] || [ $delta_tx -ne 0 ] || [ $last_uptime -eq 0 ]; then
    echo "$uptime,$total_rx,$total_tx" >> "$STAT_FILE"
fi


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
