// Limit the number of times a program can be started per day.
// Use `node Start-Limiter.js [daily limit]` to set the limiter.
// Example (in loop):
// - node main.js && node Start-Limiter.js 100

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
