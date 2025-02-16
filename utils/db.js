
import Database from 'better-sqlite3';
import { logger } from './logger.js';

// 监听语句运行完成
let saveData_Lock = false;
async function db_on(sql){
	// console.log(sql);

	// 如果语句中包含写入指令
	if(/DELETE|UPDATE|INSERT/.test(sql)){
		// 定期提交数据
		if(!saveData_Lock){
			saveData_Lock = true;
			setTimeout(async () => {
				sqls.COMMIT.run(); // 提交
				sqls.BEGIN.run(); // 打开一个新的事务
				saveData_Lock = false;
				// console.log(' -- 提交完成');
			}, 7000); // 自动保存时间
		}
	}
};


// 连接数据库
const dbFile = './data/Data.sqlite3';
export let db = new Database(dbFile, {verbose: db_on});


const sqls = {
	COMMIT: db.prepare('COMMIT;'),
	BEGIN: db.prepare('BEGIN;'),
	optimize: db.prepare('PRAGMA optimize;'),
};


// 异步方法
export let AsyncDB = {
	get: (s, v = []) => new Promise(async (resolve) => {
		resolve(db.prepare(s).get(v));
	}),
	all: (s, v = []) => new Promise(async (resolve) => {
		resolve(db.prepare(s).all(v));
	}),
};


// 初始化数据库
await (() => {
	return new Promise(async (resolve) => {

		// 初始化数据库配置
		db.exec(`
			PRAGMA page_size = 16384;	-- 页面大小
			PRAGMA auto_vacuum = FULL;	-- 自动处理碎片
			PRAGMA journal_mode = WAL;	-- WAL 模式 or OFF
		`);

		// 初始化数据表
		db.exec(`

			-- MC 协议版本表
			CREATE TABLE IF NOT EXISTS "config" (
				"key"		TEXT NOT NULL UNIQUE,
				"value"		TEXT NOT NULL,

				PRIMARY KEY ("key")
			);
			CREATE INDEX IF NOT EXISTS idx_config_key ON config (key);

		`);
		// 结束
		resolve();

	});
})();



// 开启事务
sqls.BEGIN.run();
logger.mark('数据库加载完成');


// 关闭事件
process.on('SIGINT', () => {
	logger.warn('强制关闭');
	logger.info('  - 正在关闭数据库');

	sqls.COMMIT.run();
	sqls.optimize.run();
	db.close();
	logger.info('已关闭数据库');
	process.exit(0);
});

// 结束事件
process.on('beforeExit', () => {
	logger.info('运行完成');

	sqls.COMMIT.run();
	sqls.optimize.run();
	db.close();
	logger.info('已关闭数据库');
	process.exit(0);
});
