// Consumption traffic
// Example:
// - node Traffic-Consumer.js 1

const speed = Number(process.argv[2] || 1);	// (MB/s)
const Thread = Math.ceil(speed / 2.5);
// https://speed.cloudflare.com/__down?bytes=25000000
// https://issuepcdn.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_7.44.5.2.exe
const url = `https://issuepcdn.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_7.44.5.2.exe`;

let totalTraffic = 0;
let sleepTime = 100;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const on = async (name) => {
	try{
		const res = await fetch(url);
		const reader = res.body.getReader();
		const read = async () => {
			const { done, value } = await reader.read();
			if(done) return on(name);
			totalTraffic += value.byteLength;
			await sleep(sleepTime);
			read();
		}
		read();
	}catch(err){
		console.error(`[Fetch] [${name}] ${err}`);
		on(name);
	}
};

(async () => {

	let settledTraffic = 0;
	let totalStatTime = 0;
	let nowStatTime = performance.now();
	let step = 4;
	let averageSpeedArr = [];
	
	setInterval(() => {
		const nowTime = performance.now();
		const totalSpeed = (totalTraffic / (nowTime - totalStatTime) * 1000) / 1024 / 1024;
		const nowSpeed = ((totalTraffic - settledTraffic) / (nowTime - nowStatTime) * 1000) / 1024 / 1024;
		settledTraffic = totalTraffic;
		nowStatTime = nowTime;
		averageSpeedArr.push(nowSpeed);
		averageSpeedArr = averageSpeedArr.slice(-17);
		const averageSpeed = averageSpeedArr.reduce((a, b) => a + b, 0) / averageSpeedArr.length;
	
		let adjust = 0 - (speed - averageSpeed) * step;
		sleepTime = Math.max(0, sleepTime + adjust);
		
		console.log(`[Download] ${(totalTraffic / 1024 / 1024).toFixed(2)} MB -- ${totalSpeed.toFixed(2)} / ${averageSpeed.toFixed(2)} / ${nowSpeed.toFixed(2)} MB/s -- Sleep ${Math.floor(sleepTime)}ms (Adjust ${adjust.toFixed(2)})`);
	}, 100);

	for(let i = 1; i <= Thread; i++){
		const name = `${i}`.padStart(Thread.toString().length, '0');
		on(name);
		await sleep(270);
	}

	totalStatTime = performance.now();
})();
