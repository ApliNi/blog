
const cfg = {
	// 目标速度 MB/s
	speed: 2,
	// 停止流量 MB
	stop: 15 * 1024,
	// 线程数
	thread: 2,
	// 下载链接
	// https://speed.cloudflare.com/__down?bytes=25000000
	// https://qdcu04.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_7.44.5.2.exe
	url: 'https://issuecdn.baidupcs.com/issue/netdisk/apk/BaiduNetdiskSetup_wap_share.apk',
};

let totalTraffic = 0;
let sleepTime = 100;
let _stop = false;

const sleep = (ms) => ms === 0 ? true : new Promise(resolve => setTimeout(resolve, ms));

const on = async () => {
	try{
		const res = await fetch(cfg.url);
		const reader = res.body.getReader();
		const read = async () => {
			try{
				const { done, value } = await reader.read();
				if(done || _stop) return;
				totalTraffic += value.byteLength;
				await sleep(sleepTime);
				await read();
			}catch(err){
				console.error(`[Reader]`, err);
			}
		}
		await read();
	}catch(err){
		console.error(`[Fetch]`, err);
	}finally{
		if(!_stop) on();
	}
};

(async () => {
	console.log(cfg);
	await sleep(50);

	let settledTraffic = 0;
	let nowStatTime = performance.now();
	const totalStatTime = nowStatTime;
	let averageSpeedArr = [];
	
	const statInterval = setInterval(() => {
		const nowTime = performance.now();
		const nowSpeed = ((totalTraffic - settledTraffic) / (nowTime - nowStatTime) * 1000) / 1024 / 1024;
		const totalSpeed = (totalTraffic / (nowTime - totalStatTime) * 1000) / 1024 / 1024;
		settledTraffic = totalTraffic;
		nowStatTime = nowTime;
		averageSpeedArr.push(nowSpeed);
		averageSpeedArr = averageSpeedArr.slice(-15);
		const averageSpeed = averageSpeedArr.reduce((a, b) => a + b, 0) / averageSpeedArr.length;
	
		const adjust0 = 0 - (cfg.speed - nowSpeed) * 10;
		const adjust1 = 0 - (cfg.speed - averageSpeed) * 20;
		const adjust2 = 0 - (cfg.speed - totalSpeed) * 40;
		sleepTime = Math.max(0, sleepTime + adjust0 + adjust1 + adjust2);

		let totalTrafficDisplay;
		let totalTrafficMB = totalTraffic / 1024 / 1024;
		if(totalTrafficMB < 1024){
			totalTrafficDisplay = `${totalTrafficMB.toFixed(2)} MB`;
		}else if(totalTrafficMB < 1_048_576){
			totalTrafficDisplay = `${(totalTrafficMB / 1024).toFixed(2)} GB`;
		}else if(totalTrafficMB < 1_073_741_824){
			totalTrafficDisplay = `${(totalTrafficMB / 1024 / 1024).toFixed(2)} TB`;
		}else{
			totalTrafficDisplay = `${(totalTrafficMB / 1024 / 1024 / 1024).toFixed(2)} PB`;
		}

		if(totalTrafficMB >= cfg.stop){
			_stop = true;
			clearInterval(statInterval);
			console.log(`[/] Stop at ${cfg.stop} MB`);
			process.exit(0);
		}
		
		// 刷新一行
		process.stdout.write(`\r[/] ${totalTrafficDisplay} -- ${averageSpeed.toFixed(2)} MB/s -- Sleep ${Math.floor(sleepTime)}ms     `);
		// process.stdout.write(`\r[Download] ${totalTrafficDisplay} -- ${totalSpeed.toFixed(2)} / ${averageSpeed.toFixed(2)} / ${nowSpeed.toFixed(2)} MB/s -- Sleep ${Math.floor(sleepTime)}ms`);
		// console.log(`(Adjust ${adjust2.toFixed(2)}, ${adjust1.toFixed(2)}, ${adjust0.toFixed(2)})`);
	}, 150);

	for(let i = cfg.thread; i--;){
		on();
		await sleep(500);
	}
})();
