#!/bin/sh

# 配置部分
INTERFACES="phy0-sta0 br-wan br-wan6"
STAT_FILE="./traffic_stats.txt"


# 字节转换为易读格式
formatBytes() {
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

# 初始化总流量变量
nowRx=0
nowTx=0
interfaceStatsText=""

# 遍历所有指定网口获取流量统计
for iface in $INTERFACES; do
    # 检查网口是否存在
    if [ -d "/sys/class/net/$iface" ]; then
        rx_bytes=$(cat /sys/class/net/$iface/statistics/rx_bytes 2>/dev/null || echo 0)
        tx_bytes=$(cat /sys/class/net/$iface/statistics/tx_bytes 2>/dev/null || echo 0)
        nowRx=$((nowRx + rx_bytes))
        nowTx=$((nowTx + tx_bytes))
        interfaceStatsText="$interfaceStatsText  - $iface: 下行: $(formatBytes $rx_bytes), 上行: $(formatBytes $tx_bytes)\n"
    fi
done

sysStartTime=$(grep btime /proc/stat | awk '{print $2}')
timestamp=$(date +%s)
lastSysStartTime=0
lastTimestamp=0
lastRx=0
lastTx=0
totalRx=0
totalTx=0

# 如果存在状态文件，则读取
if [ -f "$STAT_FILE" ]; then
	lastSysStartTime=$(cut -d',' -f1 "$STAT_FILE" 2>/dev/null || echo 0)
    lastTimestamp=$(cut -d',' -f2 "$STAT_FILE" 2>/dev/null || echo 0)
    lastRx=$(cut -d',' -f3 "$STAT_FILE" 2>/dev/null || echo 0)
    lastTx=$(cut -d',' -f4 "$STAT_FILE" 2>/dev/null || echo 0)
	totalRx=$(cut -d',' -f5 "$STAT_FILE" 2>/dev/null || echo 0)
	totalTx=$(cut -d',' -f6 "$STAT_FILE" 2>/dev/null || echo 0)
fi

# 如果启动时间不一致, 则忽略上次流量
# 如果上次流量大于当前流量, 则忽略上次流量
if [ $lastSysStartTime -ne $sysStartTime ] || [ $lastRx -gt $nowRx ] || [ $lastTx -gt $nowTx ]; then
    lastRx=0
    lastTx=0
fi

# 增加总计流量
totalRx=$((totalRx + nowRx - lastRx))
totalTx=$((totalTx + nowTx - lastTx))

# 覆盖写入新的状态（只保留最后一次）
echo "$sysStartTime,$timestamp,$nowRx,$nowTx,$totalRx,$totalTx" > "$STAT_FILE"

# 增量
rxRate=$((nowRx - lastRx))
txRate=$((nowTx - lastTx))

# 间隔
interval=$((timestamp - lastTimestamp))

# 输出结果
echo ""
echo "日期: $(date "+%Y-%m-%d %H:%M:%S"), 间隔: ${interval}s"

echo ""
echo "网口信息:"
printf "${interfaceStatsText}"

if [ $interval -eq '0' ]; then
    interval=1
fi

echo ""
echo "总计流量:"
echo "  - 下行: $(formatBytes $totalRx), 增量: $(formatBytes $rxRate), 速率: $(formatBytes $((rxRate / interval)))/s"
echo "  - 上行: $(formatBytes $totalTx), 增量: $(formatBytes $txRate), 速率: $(formatBytes $((txRate / interval)))/s"

echo ""
