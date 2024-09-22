// Consumption traffic
// Example:
// - node Traffic-Consumer.js [Speed Number MB/s, default 1] [Thread Number, default Auto]
// - node Traffic-Consumer.js 4 2

const speed = Number(process.argv[2] || 1);	// (MB/s)
const Thread = Number(process.argv[3] || Math.ceil(speed / 3));
// https://speed.cloudflare.com/__down?bytes=25000000
// https://qdcu04.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_7.44.5.2.exe
const url = `https://qdcu04.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_7.44.5.2.exe`;

let totalTraffic = 0;
let sleepTime = 100;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const on = async () => {
	try{
		const res = await fetch(url);
		const reader = res.body.getReader();
		const read = async () => {
			try{
				const { done, value } = await reader.read();
				if(done){
					on();
					return;
				}
				totalTraffic += value.byteLength;
				await sleep(sleepTime);
				read();
			}catch(err){
				console.error(`[Reader]`, err);
			}
		}
		read();
	}catch(err){
		console.error(`[Fetch]`, err);
		on();
	}
};

(async () => {

	console.log(`Speed ${speed} MB/s -- Thread ${Thread}`);

	let settledTraffic = 0;
	let nowStatTime = performance.now();
	const totalStatTime = nowStatTime;
	let averageSpeedArr = [];

	for(let i = 1; i <= Thread; i++){
		await on();
		await sleep(27);
	}
	
	setInterval(() => {
		const nowTime = performance.now();
		const nowSpeed = ((totalTraffic - settledTraffic) / (nowTime - nowStatTime) * 1000) / 1024 / 1024;
		const totalSpeed = (totalTraffic / (nowTime - totalStatTime) * 1000) / 1024 / 1024;
		settledTraffic = totalTraffic;
		nowStatTime = nowTime;
		averageSpeedArr.push(nowSpeed);
		averageSpeedArr = averageSpeedArr.slice(-15);
		const averageSpeed = averageSpeedArr.reduce((a, b) => a + b, 0) / averageSpeedArr.length;
	
		const adjust0 = 0 - (speed - nowSpeed) * 10;
		const adjust1 = 0 - (speed - averageSpeed) * 20;
		const adjust2 = 0 - (speed - totalSpeed) * 40;
		sleepTime = Math.max(0, sleepTime + adjust0 + adjust1 + adjust2);
		
		console.log(`[Download] ${(totalTraffic / 1024 / 1024).toFixed(2)} MB -- ${totalSpeed.toFixed(2)} / ${averageSpeed.toFixed(2)} / ${nowSpeed.toFixed(2)} MB/s -- Sleep ${Math.floor(sleepTime)}ms (Adjust ${adjust2.toFixed(2)}, ${adjust1.toFixed(2)}, ${adjust0.toFixed(2)})`);
	}, 150);
})();
