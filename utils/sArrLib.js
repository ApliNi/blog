// sArr 是前后没有括号的字符串格式的数组, 使用逗号分隔数据, 其数据和长度保存在一个普通数组里
// Arr[字符串, 长度]

// // 创建 sArrObj
// let sArr = sArrLib.new(100);
// // 输出: ['null,null,null,...共100位...null', 100]

// // 添加一个数据
// sArr = sArrLib.push(sArr, 100);
// // 输出: ['null,null,null,...共101位...null,100', 101]

// // 删除第一个数据
// sArr = sArrLib.shift(sArr);
// // 输出: ['null,null,...共100位...null,100', 100]

// // 删除第一位并添加一个数据
// sArr = sArrLib.moveLeft(sArr, 200);
// // 输出: ['null,...共100位...null,100,200', 100]

// // 转换为普通数组
// arr = sArrLib.toArray(sArr);
// // 输出: [null, ...共100位...null, 100, 200]

export let sArrLib = {

	// 往最后添加一个元素
	push: (sArrObj, data) => {
		// 添加数据并修改长度
		sArrObj[0] = sArrObj[0] +','+ data;
		sArrObj[1] = Number(sArrObj[1]) +1;
	},

	// 删除第一个元素
	shift: (sArrObj) => {
		sArrObj[0] = sArrObj[0].slice(sArrObj[0].indexOf(',') + 1);
		sArrObj[1] = Number(sArrObj[1]) -1;
	},

	// 添加一个元素并删除第一个元素
	moveLeft: (sArrObj, data) => {
		// 删除第一个数据
		sArrObj[0] = sArrObj[0].slice(sArrObj[0].indexOf(',') + 1);
		// 添加一个数据
		sArrObj[0] = sArrObj[0] +','+ data;
	},

	// 新建一个指定长度的 sArrObj
	new: (length, fillData = null) => {
		return [
			JSON.stringify(new Array(length).fill(fillData)).slice(1, -1),
			length,
		];
	},

	// 转换为普通数据
	toArray: (sArrObj) => JSON.parse('['+ sArrObj +']'),

};
