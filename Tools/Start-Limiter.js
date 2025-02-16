
// 限制程序每天启动的次数

// 使用方法 (在 Shell 的循环中):
// <其他程序>
// node Start-Limiter.js [次数]
//   - 次数: 限制程序每天可以启动的次数

const fs = require('fs');

(async () => {

	console.log('');
	
	const dayLimiter = Number(process.argv.slice(2)[0] || 27);
	const filePath = `./Start-Limiter-js.txt`;

	const config = {
		dayId: 0,
		count: 0,
	};
	
	try{
		const [ dayId, count ] = fs.readFileSync(filePath, 'utf8').split(',').map(Number);
		config.dayId = dayId;
		config.count = count;
	}catch(err){
		fs.writeFileSync(filePath, '0,0');
	}

	const nowDayId = new Date().getDate();

	if(config.dayId === nowDayId){
		config.count++;
		fs.writeFileSync(filePath, `${nowDayId},${config.count}`);

		if(config.count >= dayLimiter){

			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			tomorrow.setHours(0, 0, 0, 0);
			const toTomorrow = tomorrow - new Date();

			console.log(`[Start Limiter] day[${nowDayId}] -> "${config.count} / ${dayLimiter}" | Wait ${Math.floor(toTomorrow / 1000)} seconds...`);

			await new Promise(resolve => setTimeout(resolve, toTomorrow + 2000));
		}else{
			console.log(`[Start Limiter] day[${nowDayId}] -> "${config.count} / ${dayLimiter}" | Continue`);
		}
	}else{
		fs.writeFileSync(filePath, `${nowDayId},${1}`);
		console.log(`[Start Limiter] day[${nowDayId}] -> "1 / ${dayLimiter}" | New day`);
	}

	console.log('');

	process.exit(0);
})();
