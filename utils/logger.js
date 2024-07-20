
import { createWriteStream } from 'fs';

const config = {
	logFile: true,
	logFilePath: './data/latest.log',
};

const writeStream = config.logFile ? createWriteStream(config.logFilePath, {
	flags: 'a',	// 追加模式, 如果文件不存在则创建新文件
	encoding: 'utf8',
}) : {
	write: () => {},
};

export const logger = {

	_getTime(){
		const time = new Date();
		return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
	},

	_objectParse: (list, hierarchy = 1) => list.map(obj => {

		try{
		
			if(obj.trim){	// 这是字符串
				return obj;
			}

			if(obj.length){	// 这是数组
				const strArr = obj.map(item => logger._objectParse([item], hierarchy + 1)[0]);
				const length = strArr.map(li => li.length).reduce((a, b) => a + b, 0);

				if(length <= 80){
					return `[ ${strArr.join(', ')} ]`;
				}

				const indent = ' '.repeat(2 * hierarchy);
				return `[\n${strArr.map(str => str.replace(/^([^\s])/gm, `${indent}$1`)).join(',\n')}\n]`;
			}

			if(obj.constructor === Object){
				const str = JSON.stringify(obj, null, 2 * hierarchy);
				if(str.length <= 80){
					return str.replace(/\s*\n\s*/g, ' ');
				}
				return str;
			}
			
			return obj;
		}catch(err){
			console.error(err);
		}
	}),

	info(...log){
		const text = `[${logger._getTime()} INFO]: ${logger._objectParse(log).join(' ')}`;
		console.log(`\x1B[0m${text}\x1B[0m`);
		writeStream.write(`${text}\n`);
	},

	mark(...log){
		const text = `[${logger._getTime()} MARK]: ${logger._objectParse(log).join(' ')}`;
		console.log(`\x1B[92m${text}\x1B[0m`);
		writeStream.write(`${text}\n`);
	},

	log(...log){
		console.log(...log);
	},

	table(...log){
		console.table(...log);
	},

	warn(...log){
		const text = `[${logger._getTime()} WARN]: ${logger._objectParse(log).join(' ')}`;
		console.log(`\x1B[93m${text}\x1B[0m`);
		writeStream.write(`${text}\n`);
	},

	error(...log){
		const text = `[${logger._getTime()} ERROR]: ${logger._objectParse(log).join(' ')}`;
		console.log(`\x1B[91m${text}\x1B[0m`);
		writeStream.write(`${text}\n`);
	},
};