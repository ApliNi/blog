export let miniTime = {
	_c: {
		// 参数
		reso: 10 * 60 * 1000, // 分辨率10分钟
		rbr: 69 * 24 * 6, // 最大69天 // 这里的单位为上方的分辨率
		// 取整模式
		roundingMode: 1, // 0=四舍五入, 1=向下取整, 2=向上取整
	},
	
	/**
	 * 将完整时间戳以指定分辨率和范围缩短
	 * @param {JSON} config 时间格式配置
	 * @param {number} time 当前时间
	 * @returns {number} - 输出缩放后的时间戳
	 */
	compile: (config = {}, time = Date.now()) => {
		config = Object.assign(miniTime._c, config);

		// 将时间戳缩放到指定分辨率
		let zoom = (time % (config.reso * config.rbr)) / config.reso;
		// 取整
		switch(config.roundingMode){
			case 0: // 四舍五入
				zoom = Math.round(zoom);
				break;
			case 1: // 向下取整
				zoom = Math.floor(zoom);
				break;
			case 2: // 向上取整
				zoom = Math.ceil(zoom);
				break;
		}

		return zoom;
	},

	/**
	 * 将缩放后的时间戳还原为标准时间戳
	 * @param {JSON} config 时间格式配置
	 * @param {number} zoomTime 缩放后的时间
	 * @param {number}} time 当前时间
	 * @returns {number} - 标准时间戳
	 */
	decompile: (config, zoomTime, time = Date.now()) => {
		config = Object.assign(miniTime._c, config);
		return Math.floor(time / (config.reso * config.rbr)) * (config.reso * config.rbr) + zoomTime * config.reso;
	},
};
