
// 将 Node 项目 **潦草的** 转换为 Deno 项目

// 使用方法:
// node toDeno.mjs [目录]
//   - 目录: 要转换的项目路径, 默认为当前目录

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// 用户输入
const runPath = path.resolve(process.argv[2] || './');
console.log(`runPath: ${runPath}`);

// node 核心模块列表
const nodeModeList = {
	'fs': true,
	'path': true,
	'os': true,
	'child_process': true,
	'events': true,
	'util': true,
	'http': true,
	'https': true,
	'url': true,
	'querystring': true,
	'zlib': true,
	'dgram': true,
	'stream': true,
	'net': true,
	'crypto': true,
	'cluster': true,
	'assert': true,
	'buffer': true,
	'vm': true,
	'os': true,
	'process': true,
	'v8': true,
	'worker_threads': true,
	'perf_hooks': true,
	'http2': true,
	'tls': true,
};

// npm 模块列表
const npmModeMap = JSON.parse(readFileSync(path.join(runPath, './package.json'))).dependencies;

// 遍历目录下的所有文件和文件夹
const on = async (rootPath) => {
	const files = readdirSync(rootPath);
	for(const file of files){
		
		// 判断这是文件还是目录
		const filePath = path.join(rootPath, file);
		if(!statSync(filePath).isFile()){
			// 排除 node_modules 目录
			if(filePath.endsWith('node_modules')){
				continue;
			}
			await on(filePath);
			continue;
		}

		// 判断文件后缀名
		if(path.extname(filePath) !== '.js'){
			continue;
		}

		console.log(`处理文件: ${filePath}`);

		let matchCount = 0;
		
		// 读取文件内容
		const content = readFileSync(filePath);
		const lines = content.toString().split('\n');
		for(let i = 0; i < lines.length; i++){
			
			const reg = [
				/(?<=\s*import\s*.*\s*from\s*['"])(?<mod>.+)(?=['"])/,
				/(?<=import\s*['"`])(?<mod>.+)(?=['"`])/,
				/(?<=import\s*\(\s*['"`])(?<mod>.+)(?=['"`])\)/,
			];

			for(let r of reg){
				const newLi = lines[i].replace(r, (_, mod) => {

					if(mod.startsWith('.')){
						return mod;
					}

					const modSplit = mod.split('/');

					if(nodeModeList[modSplit[0]] !== undefined){
						matchCount ++;
						return `node:${mod}`;
					}

					if(npmModeMap[modSplit[0]] !== undefined){
						matchCount ++;
						return `npm:${mod}`;
					}

					return mod;
				});

				if(newLi !== lines[i]){
					console.log(`  - 替换: ${lines[i]} -> ${newLi}`);
					lines[i] = newLi;
					break;
				}
			}
		}
		// 写入文件
		const newContent = lines.join('\n');
		writeFileSync(filePath, newContent);
		console.log(`  - 匹配到 ${matchCount} 个模块`);
		
	}
};
on(runPath);
