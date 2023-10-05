
# MCID 网站数据库的实现和优化, 查询耗时从 1s 到 50ms

本文从零开始实现一个好的查询效果, 然后再优化它的性能.
其中还包含对应用的一次重构, 最终结果可能还有优化空间, 希望能提供一些有用的思路.

**索引**
1. [功能实现](#最开始的实现) - 查询耗时从 4 毫秒增加到 124 毫秒
2. [功能增强](#功能增强) - 查询耗时从 124 毫秒增加到 1 秒
3. [查询性能优化](#优化) - 查询耗时从 1 秒降低到 50 毫秒
   1. [SQL 语句优化](#sql-语句优化)
   2. [拆分 SQL 语句, 按需运行](#拆分-sql-语句-按需运行)
   3. [使用索引](#索引)
   4. [使用 FTS5 实现全文搜索](#模糊查询全文搜索-fts5)
   5. [数据库配置调整](#数据库配置)

最近写了一个查询 MC(Minecraft) 物品的网站 ([MCID](https://mcid.ipacel.cc/)),
它收录了 MC 里多个版本中个语言的所有物品名称.
一共有 1670 种物品的 137 种语言, 去重后还剩 207487 条文本.
本文需要实现和优化的这 207487 条文本的精准查询/模糊查询和排序.

我使用 Node.js 和 SQLite 数据库完成这个应用.
使用的 SQLite 库是 [`node-sqlite3`](https://www.npmjs.com/package/better-sqlite3?activeTab=readme)
之后研究了很久认为这个库有一些问题,
于是切换到 [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3?activeTab=readme)
一切正常!


## 最开始的实现
一开始的数据库设计是简单的, 用一张表完成数据的存储:

| id (数值) | lang (数值) | type (数值) | itemID (字符串) | itemName (字符串) |
|---------|-----------|-----------|--------------|----------------|
| 1       | 1 (zh_cn) | 1 (item)  | apple        | 苹果             |
| 1       | 1 (zh_cn) | 2 (block) | air          | 空气             |
| 2       | 2 (zh_hk) | 1 (item)  | apple        | 蘋果             |
| 2       | 3 (en_au) | 1 (item)  | apple        | Apple          |
| ...     | ...       | ...       | ...          | ...            |

*(目前 lang 和 type 中的值存储在外部的 JSON 文件里. 使用时会直接读取到内存)*

查询它也是特别的简单:
```roomsql
-- 输出 * (所有列的数据) 从数据表 dataTable 中查询 
SELECT * FROM dataTable
-- 限定 type = 1 的同时 itemID 或 itemName = apple
WHERE type = 1 AND (itemID = 'apple' OR itemName = 'apple')
-- 返回最多 64 条数据
LIMIT 64;

-- 结果: 1 行返回, 耗时 4ms
```

它的缺点很明显, 只能查询 itemID 或 itemName 完全匹配的数据, 我们需要实现一个模糊查询:
```roomsql
SELECT * FROM dataTable
-- 限定 type = 1 的同时 itemID 或 itemName 中包含 'apple', 不区分大小写
WHERE
    type = 1
    AND (
        itemID LIKE '%apple%' COLLATE NOCASE
        OR itemName LIKE '%apple%' COLLATE NOCASE
    )
LIMIT 64;

-- 结果: 28 行返回, 耗时 40ms
```

> 使用 [`LIKE`](https://www.runoob.com/sqlite/sqlite-like-clause.html)
> 实现了字符串的模糊匹配, 现在它可以匹配到所有包含 `apple` 的物品, 且不区分大小写.

不过导入了更多数据后就会发现这个语句输出的开头都是一些完全不相关的东西,
那几个匹配度高的数据只是掺杂在其中 (实际导入的数据没有上面表格那么规整, 它们是杂乱的, 上下几个数据没有关联性)
我们还需要对数据进行排序.

```roomsql
SELECT * FROM dataTable
WHERE
    type = 1
    AND (
        itemID LIKE '%apple%' COLLATE NOCASE
        OR itemName LIKE '%apple%' COLLATE NOCASE
    )
ORDER BY -- 排序
    -- 为每个语句 (WHEN xxx) 设置一个权重数值 (THEN 0), 数值越小排序时越靠前
    CASE
        WHEN itemID LIKE 'apple' COLLATE NOCASE THEN 0
        WHEN itemName LIKE 'apple' COLLATE NOCASE THEN 1
        -- 由于下划线 `_` 是 LIKE 语句中用来匹配单个字符的方法, 想要查询它就要进行转义
        -- 在 LIKE 后面使用 ESCAPE '\' 可以规定用于转义的字符为反斜杠
        WHEN itemID LIKE 'apple\_%' ESCAPE '\' COLLATE NOCASE THEN 2
        WHEN itemID LIKE '%\_apple\_%' ESCAPE '\' COLLATE NOCASE THEN 3
        WHEN itemID LIKE '%\_apple' ESCAPE '\' COLLATE NOCASE THEN 4
        WHEN itemName LIKE 'apple %' COLLATE NOCASE THEN 5
        WHEN itemName LIKE '% apple %' COLLATE NOCASE THEN 6
        WHEN itemName LIKE '% apple' COLLATE NOCASE THEN 7
        -- 其余结果的数值最大, 会排在最底部
        ELSE 8
    END
LIMIT 64;

-- 结果: 28 行返回，耗时 124ms
```

> 使用 [`ORDER BY`](https://www.runoob.com/sqlite/sqlite-order-by.html)
排序, 在链接中可能看不到 `CASE` 这样的方法, 但上面的代码中有这部分的解释

效果不错, 在排序中使用了一个简单粗暴的分词方法,
它能优先显示 itemID 和 itemName 中与 apple 完全相等的数据,
然后是被空格或者下划线分开的 apple, 最后才是包含在其他单词里的 apple.

对数据库有一定了解的人可能会提到 [索引](https://www.runoob.com/sqlite/sqlite-index.html)
可惜的是, 由于在 LIKE 中使用了以 `%` 开头或结尾的查询条件, 数据库只会进行全表扫描.
在我的测试中, 即使创建了尽可能足够的索引, 查询耗时却几乎没有变化. 还需要从其他方向优化.



## 功能增强
124ms 的查询耗时看上去也不是不能接受, 对于一个正在更新的应用, 这甚至没有评价的机会.
应用还没上线, 我已开始为它添加更多功能, 并计划为未来的更新做好准备.

数据库的体积增长到了 43MB, 同时为了一些新的功能,
我对数据表进行了拆分, 并且将之前存放在 JSON 中的数据也放进了数据库.
现在我们要优化的数据库变成了这样:

**`data` 表**

| id | Lang | Type | key | Name   | VerMin | VerMax |
|----|------|------|-----|--------|--------|--------|
| 1  | 47   | 3    | 126 | 130742 | 393    | 764    |

*所有的数据都放在了单独的表中, data 表只存储了其他表中数据的 id.
其中的 Key 和 Name 就是之前例子中的 itemID 和 itemName.*

**其他表大致都是这样**

| id | dataName |
|----|----------|
| 1  | xxxxx    |

*并且为这些"其他表"中的数据创建了唯一索引, 如果有两个相同名称, 它便可以复用一个 id.
在之前, 一部分较小的数据已经通过外部的 JSON 实现复用了.*

<details><summary>如果你对这个数据库里都装了些什么感兴趣, 可以打开看看</summary>

#### 简单的描述一下这些表里都是什么

`data` 表:
- Lang: 这条数据的语言. 指向 lang 表中的 id, lang 表存放着每个语言代码的 id.
- Type: 这条数据的类型, 比如它是 `item`, 还是 `block`. 指向 mcType 表中的 id.
- Key: 这条数据在 MC 中的命名空间ID, 命名空间ID是一个唯一的字符串,
  仅由英文/数字和下划线组成. 指向 mcKey 表中的 id.
- Name: 这条数据对应的语言文本. 指向 mcName 表中的 id.
- VerMin: 这条数据在 MC 中最早出现的版本. 对应 mcVer 表中的 pid.
- VerMax: 这条数据在 MC 中出现的最新版本. 对应 mcVer 表中的 pid.
- Info [未实现]: 这条数据的简介信息文本. 对应 mcInfo 表中的 id.
- Config [未实现]: 这条数据的其他特殊配置. 对应 mcConfig 表中的 id,
  mcConfig 表中存放了可供索引的常用配置和不需要索引的 JSON 字符串格式的配置信息.

</details>


#### 实现, 开始变得复杂
现在的查询语句有一些变化, 但主要的部分依然和上面的一样:
```roomsql
SELECT
    -- {表名}.{列名}, 如果使用表连接, 就会接触这种格式
    data.id,
    lang.lang,
    mcType.type,
    mcKey.key,
    mcName.name,
    -- 由于这两个列都叫 var, 所以用别名进行区分. 这两个表会在 FROM 中提到
    mcVerMin.ver AS VerMin,
    mcVerMax.ver AS VerMax
FROM
    data
    -- 表连接: 像这样使用 JOIN, 然后告诉数据库哪些列中的数据是相关联的
    JOIN lang   ON data.Lang    = lang.id
    JOIN mcType ON data.Type    = mcType.id
    JOIN mcKey  ON data.key     = mcKey.id
    JOIN mcName ON data.Name    = mcName.id
    -- 这里为同一个表创建了两个别名, 就相当于在使用两个名称不同但内容相同的表
    JOIN mcVer AS mcVerMin  ON data.VerMin  = mcVerMin.pid
    JOIN mcVer AS mcVerMax  ON data.VerMax  = mcVerMax.pid
WHERE
    (lang.lang = 'zh_cn' AND mcKey.key LIKE '%apple%' ESCAPE '\' COLLATE NOCASE)
    OR mcName.name LIKE '%apple%' ESCAPE '\' COLLATE NOCASE
ORDER BY
    CASE
        WHEN (lang.lang = 'zh_cn' AND mcKey.key LIKE 'apple' ESCAPE '\' COLLATE NOCASE)         THEN 0
        WHEN (lang.lang = 'zh_cn' AND mcKey.key LIKE 'apple\_%' ESCAPE '\' COLLATE NOCASE)      THEN 1
        WHEN (lang.lang = 'zh_cn' AND mcKey.key LIKE '%\_apple' ESCAPE '\' COLLATE NOCASE)      THEN 2
        WHEN (lang.lang = 'zh_cn' AND mcKey.key LIKE '%\_apple\_%' ESCAPE '\' COLLATE NOCASE)   THEN 3
        WHEN mcName.name LIKE 'apple' ESCAPE '\' COLLATE NOCASE        THEN 4
        WHEN mcName.name LIKE 'apple %' ESCAPE '\' COLLATE NOCASE      THEN 5
        WHEN mcName.name LIKE '% apple' ESCAPE '\' COLLATE NOCASE      THEN 6
        WHEN mcName.name LIKE '% apple %' ESCAPE '\' COLLATE NOCASE    THEN 7
        ELSE 8
    END
LIMIT 64;

-- 结果: 44 行返回, 耗时 417ms
```

*现在看到的这段代码其实是写文章时改动过的, 最原始的代码有错误, 使查询耗时达到了 600ms*

**查询结果 (前几行)**

*其中 `各种数据的ID...` 包括 `langID, typeID, keyID, nameID`, 是 4 个列而不是 1 个列, 这里省略了它*

| id     | lang  | type | key                    | name  | VerMin | VerMax | 各种数据的ID... |
|--------|-------|------|------------------------|-------|--------|--------|------------|
| 107348 | zh_cn | item | apple                  | 苹果    | 1.13   | 1.20.1 | ...        |
| 107430 | zh_cn | item | enchanted_golden_apple | 附魔金苹果 | 1.13   | 1.20.1 | ...        |
| 107456 | zh_cn | item | golden_apple           | 金苹果   | 1.13   | 1.20.1 | ...        |
| 19380  | en_au | item | apple                  | Apple | 1.13   | 1.20.1 | ...        |
| 20457  | en_ca | item | apple                  | Apple | 1.13   | 1.20.1 | ...        |

效果比之前的更好了, 对比之前将一部分数据放在 JSON 里的方案,
它省去了用代码将 Lang 和 Type 的 id 转换成文本的步骤.

> 但还没完, 到现在整个查询过程只进行了一半.
如果这样的数据直接渲染到前端就会显得有些冗余 (比如出现了两个其他部分相同, 仅语言不同的数据),
我希望将这些数据合并一下, 计算出有多少 type 和 key 相同且多余的数据, 并将数量显示在 zh_cn (用户使用的语言) 这条数据里面.

我在这个问题上研究了很久, 最后发现不要局限在本不算熟悉的 SQL 语言里就能得到更简单的方法和更好的效果.
用代码处理数据库的输出:

```js
// 遍历数据库输出的每一行数据
result.forEach((li) => {
    // 获取这个数据在缓存中的 index
    const index = `${li.type}.${li.key}`;

    if(temp.key[index]){
        // 这是一个相同 index 但不同语言的结果
        // 为这些数据创建一个名为 diffLangs (差异语言数量) 的列
        if(temp.key[index].diffLangs === undefined){
            temp.key[index].diffLangs = 0;
        }
        // 增加差异语言数量
        temp.key[index].diffLangs ++;
    }else{
        // 如果不存在这个数据. 添加这个数据, 并跳过第一次差异语言添加 (跳过自己这条数据)
        temp.key[index] = li;
    }
});
```

**现在得到了一张更好的表 (同样省略了后面的数据)**

| id     | lang  | type | key                    | name  | VerMin | VerMax | diffLangs | 各种数据的ID... |
|--------|-------|------|------------------------|-------|--------|--------|-----------|------------|
| 107348 | zh_cn | item | apple                  | 苹果    | 1.13   | 1.20.1 | 8         | ...        |
| 107430 | zh_cn | item | enchanted_golden_apple | 附魔金苹果 | 1.13   | 1.20.1 | 12        | ...        |
| 107456 | zh_cn | item | golden_apple           | 金苹果   | 1.13   | 1.20.1 | 8         | ...        |

经过处理的数据多了一个 `diffLangs` (差异语言数量) 列, 同时结果数量从 44 行降到了 13 行.

> 快结束了, 但应用仍可改进... 在 MC 的不同版本中, 一个物品的语言可能被多次改动.
比如 1.13 版本的 `爬行者` 在 1.14 版本被改成了 `苦力怕`.
而这个程序目前只能输出与用户输入相匹配的数据, 这样, 用户并不知道自己输入的 `爬行者` 已被弃用.

解决方案也简单粗暴, 将这个表中的 lang, type, key 放入数据库查询一遍, 得到每个物品在此语言下的的所有其他名称和版本即可.
我用代码生成 SQL 语句片段, 然后拼接到完整的查询语句中.

```js
// 获取多个连续的查询语句片段
const sql_splice_var = values.map((li) => `
    (
        lang.lang = ${li.lang}        -- 语言相同
        AND mcType.type = ${li.type}  -- type 相同
        AND mcKey.key = ${li.key}     -- key  相同
        AND mcKey.key != ${li.name}   -- 名称不同, 也就是排除已被查询出来的名称
    )`
).join('OR');
```

将生成的 SQL 片段添加到完整的查询语句里:
```roomsql
SELECT
    mcType.type,
    mcKey.key,
    mcName.name,
    mcVerMin.ver AS VerMin,
    mcVerMax.ver AS VerMax
FROM
    data
    JOIN mcKey	ON data.key = mcKey.id
    JOIN mcName	ON data.Name = mcName.id
    JOIN mcVer AS mcVerMin	ON data.VerMin = mcVerMin.pid
    JOIN mcVer AS mcVerMax	ON data.VerMax = mcVerMax.pid
WHERE
    -- 上面生成的片段在这里拼接
    ${sql_splice_var}
LIMIT 512;
```

这段 SQL 代码获取了这个物品在此语言下的别名 (已弃用的名称).
但可惜中文下 apple 相关的那 3 个物品并没有改过名称,
这里我使用 `creeper` (苦力怕) 的查询结果来演示这条语句的输出:

```roomsql
-- 进行拼接的查询字段, 这里选择了 3 条数据
(lang.lang='zh_cn' AND mcType.type='entity' AND mcKey.key='creeper' AND mcName.name!='苦力怕')
OR (lang.lang='zh_cn' AND mcType.type='item' AND mcKey.key='creeper_head' AND mcName.name!='苦力怕的头')
OR (lang.lang='zh_cn' AND mcType.type='block' AND mcKey.key='creeper_wall_head' AND mcName.name!='墙上的苦力怕头颅')
```

*别名查询结果*

| Type   | key               | name     | VerMin | VerMax |
|--------|-------------------|----------|--------|--------|
| item   | creeper_head      | 爬行者的头    | 1.13   | 1.13.1 |
| block  | creeper_wall_head | 墙上的爬行者头颅 | 1.13   | 1.13.1 |
| block  | creeper_wall_head | 墙上的苦力怕的头 | 1.17   | 1.20.2 |
| entity | creeper           | 爬行者      | 1.13   | 1.13.1 |



再对结果进行最后一次处理:

```js
result2.forEach((li) => {
    const tempKey = `${li.type}.${li.key}`;
    // 为这些数据创建一个名为 alias (别名) 的列
    if(temp.key[tempKey].alias === undefined){
        temp.key[tempKey].alias = [];
    }
    // 为这个数据添加一个差异语言
    temp.key[tempKey].alias.push({
        name: li.name,
        VerMin: li.VerMin,
        VerMax: li.VerMax,
    });
});
```

## 优化

至此, 我们得到了完美的查询结果, 这些代码生成的数据与 [实际效果](https://mcid.ipacel.cc/?l=zh_cn&q=%E8%8B%A6%E5%8A%9B%E6%80%95)
无异. 但与此同时也得到了接近 1 秒的查询耗时. 接下来逐步优化它.

### SQL 语句优化

**## 尽可能使用 ID 代替直接查询字符串**

上面代码中查询的数据全都是原始数据, 并且原始数据直接使用在了其他查询语句中, 这是危险且低效的做法.
我认为, 如果需要拼接 SQL 语句, 那拼接的数据中只应该有 ID 或完全已知的安全的数据,
并且需要准备好数据的转义, 不能在拼接后出现语法错误.

我们可以像这样, 在不影响获取原始数据的同时得到 ID:
```roomsql
SELECT
    data.Lang AS langID,
    data.Type AS typeID,
    data.key AS keyID,
    data.Name AS nameID,
    ...
```

然后也可以在其他代码中使用 ID 代替原始字符串. 虽然这些代码会更安全, 但处理更小的数据也能提高性能:
```js
// 遍历数据库输出的每一行数据
result.forEach((li) => {
    // 获取这个数据在缓存中的 index
    const index = `${li.typeID}.${li.keyID}`;
    ...
```
```js
// 获取多个连续的查询语句片段
const sql_splice_var = values.map((li) => `
    (
        -- 只查询一张表中的数据还可以通过联合索引来优化速度
        data.Lang = ${li.Lang}        -- 语言相同
        AND data.Type = ${li.Type}    -- type 相同
        AND data.key = ${li.key}      -- key  相同
        AND data.Name! = ${li.Name}   -- 名称不同, 也就是排除已被查询出来的名称
    )`
).join('OR');
```

这会让数据变得抽象, 可能不方便调试. 但在测试时可以通过一样的方法同时返回这些 ID 对应的数据来参考.

### 拆分 SQL 语句, 按需运行

我将查询字符串的部分和查询 ID 的部分完全分离了出来, 并且根据查询字符串的结果来定制后续的 SQL 语句.
同时性能优化也变成了两部分: 优化查询字符串 和 优化查询 ID.

实现它的代码就像这样:
```js
// KEY 分词匹配
const ID_MATCH_key = (await AsyncDB.all(
    `SELECT id FROM mcKey_FTS WHERE key MATCH $inp ORDER BY rank LIMIT 128;`,
    {inp: `"${inp_MATCH}"`})
).map((i) => i.id).join(',');

// 名称分词匹配
const ID_MATCH_name = (await AsyncDB.all(
    `SELECT id FROM mcName_FTS WHERE name MATCH $inp ORDER BY rank LIMIT 64;`,
    {inp: `"${inp_MATCH}"`})
).map((i) => i.id).join(',');

// KEY 全表搜索
const ID_LIKE_key = (await AsyncDB.all(`
    SELECT id FROM mcKey WHERE
        key LIKE $inp ESCAPE '\\' COLLATE NOCASE
        ${ID_MATCH_key.length === 0 ?'': `AND id NOT IN (${ID_MATCH_key})`}
    LIMIT 64;
`, {inp: `%${inp_LIKE}%`})).map((i) => i.id).join(',');

// 名称全表搜索
const ID_LIKE_name = (await AsyncDB.all(`
    SELECT id FROM mcName WHERE
        name LIKE $inp ESCAPE '\\' COLLATE NOCASE
        ${ID_MATCH_name.length === 0 ?'': `AND id NOT IN (${ID_MATCH_name})`}
    LIMIT 64;
`, {inp: `%${inp_LIKE}%`})).map((i) => i.id).join(',');

// 如果所有前置查询都为空, 就不进行接下来的查询
if([ID_MATCH_key, ID_MATCH_name, ID_LIKE_key, ID_LIKE_name].every((v) => v.length === 0)){
    return [];
}

// 完全使用id查询数据
const WHERE_ARR = [];
if(ID_MATCH_key.length !== 0)	WHERE_ARR.push(`(data.Lang = ${inp_langID} AND data.key IN (${ID_MATCH_key}))`);
if(ID_MATCH_name.length !== 0)	WHERE_ARR.push(`data.Name IN (${ID_MATCH_name})`);
if(ID_LIKE_key.length !== 0)	WHERE_ARR.push(`(data.Lang = ${inp_langID} AND data.key IN (${ID_LIKE_key}))`);
if(ID_LIKE_name.length !== 0)	WHERE_ARR.push(`data.Name IN (${ID_LIKE_name})`);
// WHERE_ARR.join(' OR ')

let i = 0;
const ORDER_S = `
    ${ID_MATCH_key.length === 0 ?'':	`WHEN (data.Lang = ${inp_langID} AND data.key IN (${ID_MATCH_key})) THEN ${i++}`}
    ${ID_MATCH_name.length === 0 ?'':	`WHEN (data.Lang = ${inp_langID} AND data.Name IN (${ID_MATCH_name})) THEN ${i++}`}
    ${ID_LIKE_key.length === 0 ?'':		`WHEN (data.Lang = ${inp_langID} AND data.key IN (${ID_LIKE_key})) THEN ${i++}`}
    ${ID_LIKE_name.length === 0 ?'':	`WHEN (data.Lang = ${inp_langID} AND data.Name IN (${ID_LIKE_name})) THEN ${i++}`}
    ELSE ${i}
`;
```

*代码中有些表名后面带有 `_FTS`, 这是一种模糊查询优化方式, 会在接下来的 FTS5 部分说到*

现在我们得到了 `WHERE_ARR` 和 `ORDER_S` 这两个变量, 它们分别对应查询部分和排序部分.
这两个子句中只包含数据 ID, 可以在不连接其他表的情况下直接在 data 表中运算.


### 索引

**## 普通索引**: 
```roomsql
CREATE INDEX IF NOT EXISTS idx_lang ON lang (lang);
```
注意: 在查询数据时普通索引只对数据左侧部分完全确定的情况有效,
比如上述索引对查询语句 `SELECT * FROM lang WHERE lang = 'zh_cn';`
和 `SELECT * FROM lang WHERE lang LIKE 'zh_%';` 有效,
但对 `SELECT * FROM lang WHERE lang LIKE '%_cn';` 无效.

这个项目里的所有 "其他表" 都有普通索引, 而它们的数据唯一性确认通过代码完成了.

**## 唯一索引**: 唯一索引在创建索引的同时可以保证索引覆盖范围内的数据唯一性:
```roomsql
CREATE UNIQUE INDEX IF NOT EXISTS idx_lang ON lang (lang);
```

**## 联合索引**: 用于优化同时查询一个表中多个字段的索引, 同时也可以添加 `UNIQUE` 使其保证索引覆盖的整个行的唯一性:
```roomsql
CREATE INDEX IF NOT EXISTS idx_data ON data (Lang, Key, Name);
```
注意: 联合索引的顺序需要与查询的顺序一致, 否则可能发挥不出最好的效果甚至完全无效.
比如上述索引对查询语句 `SELECT * FROM data WHERE Lang = ? AND Type = ? AND Key = ? AND Name = ?;` 有效,
但对 `SELECT * FROM data WHERE Type = ? AND Key = ? AND Name = ?;` 无效.
但如果查询语句是 `SELECT * FROM data WHERE Lang = ? AND Type = ? AND Key = ?;`, 它应该有效.


### 模糊查询/全文搜索 [FTS5](https://www.sqlite.org/fts5.html)

https://www.sqlite.org/fts5.html

FTS5 会创建一些新的数据, 通过这些新的数据可以实现自动的分词查询, 而不需要 `LIKE '%_apple_%'`.
这在本次性能优化中起到了很大的作用, 查询耗时第一次从 600ms 降低到 200ms.

**创建一个普通的数据表**
```roomsql
-- MC 物品名称表
CREATE TABLE IF NOT EXISTS "mcName" (
    "id"		INTEGER NOT NULL,
    "name"		TEXT NOT NULL UNIQUE,

    PRIMARY KEY ("id" AUTOINCREMENT)
);
```

**创建 FTS5 虚拟表 (它与普通数据表相似, 但缺少很多功能)**
```roomsql
CREATE VIRTUAL TABLE IF NOT EXISTS mcName_FTS USING FTS5(id, name);
```

创建它时会生成 6 个数据表, 所以最好用 STF 后缀对表进行区分...

虚拟表并不会自动与普通表同步数据, 也就是说, 现在它起不到任何作用.
我们需要将整个普通表中的数据复制到虚拟表才能通过虚拟表查询.
这一部分可以通过外部的代码实现, 在增删改普通表时多写一句让其同步到虚拟表.
但数据库中有更简单的方法: 触发器.

触发器相当于事件监听器, 它可以监听一个表有什么改动, 然后执行自定义的语句:
```roomsql
-- 监听 mcName 表添加数据
CREATE TRIGGER IF NOT EXISTS syncTrigger_INSERT_mcName_FTS AFTER INSERT ON mcName FOR EACH ROW BEGIN
    -- 将数据插入到虚拟表 mcName_FTS
    INSERT INTO mcName_FTS (id, name) VALUES (NEW.id, NEW.name);
END;

-- 监听 mcName 表删除数据
CREATE TRIGGER IF NOT EXISTS syncTrigger_DELETE_mcName_FTS AFTER DELETE ON mcName FOR EACH ROW BEGIN
    -- 删除虚拟表 mcName_FTS 中的数据
    DELETE FROM mcName_FTS WHERE id = OLD.id;
END;

-- 监听 mcName 表修改数据
CREATE TRIGGER IF NOT EXISTS syncTrigger_UPDATE_mcName_FTS AFTER UPDATE ON mcName FOR EACH ROW BEGIN
    -- 这里我没有使用 UPDATE 而是将数据删除再重新创建. 仅仅只是因为懒 (不过我也不知道 UPDATE 语句是否对虚拟表有效
    DELETE FROM mcName_FTS WHERE id = OLD.id;
    INSERT INTO mcName_FTS (id, name) VALUES (NEW.id, NEW.name);
END;
```

然后像这样通过虚拟表搜索数据:
```roomsql
SELECT * FROM mcName_FTS WHERE name MATCH '"apple"' ORDER BY rank LIMIT 64;
```

```
-- 结果: 14 行返回, 耗时 3ms
id	name
123999	ʻO Apple Apple
16674	Apple
71549	Äpple
16761	Golden Apple
20139	Gilded Apple
761	Enchanted golden apple
16742	Enchanted Golden Apple
17772	Eden's Apple
19464	Galed Golden Apple
70426	Apple magjepsur Artë
119399	Apple ti wura
17753	Witchcraft'd Golden Apple
20128	Bewitch'd Gilded Apple
83440	Hex'd Eden's Apple
```

这将会查询到所有完全匹配 apple 以及被空格包围或在文本两端的 apple.
如果用它查询 ncKey 中用下划线分隔单词的数据, 它也是有效的.

注意: MATCH 语句有类似 LIKE 的关键词, 使用时需要进行转义.
其中双引号表示这是一个词, 对于用户的输入, 可以删除双引号.
也可以将一个双引号转译为两个双引号: `"apple` -> `MATCH '"""apple"'`.
最后保证这些双引号和单词都包含在一个单引号中就好了.


### 数据库配置

https://www.sqlite.org/pragma.html

SQLite 有比 MySQL 等数据库简单得多的配置, 其中标有星号的是我在这个项目里最终用到的:

**\* 修改页面大小**
```roomsql
PRAGMA page_size = 16384;	-- 页面大小
```
16K 是网络上比较常见的说法, 16K 到 32K 的性能提升不大,
但 page_size 越大对系统的负载越高. 所以得到了这个折中的 16K.

**自动收缩数据库大小**
```roomsql
PRAGMA auto_vacuum = FULL;	-- 自动收缩数据库大小
```
SQLite 默认在删除数据后不会将空间返还给系统, 也就是文件体积和之前一样大.
但 `auto_vacuum = FULL` 并不一定是好的, 根据文档的描述,
它会将文件末尾的数据移动到删改后空出来的部分, 然后截断文件末尾.
这会让数据库中的数据越来越碎, 它可能还会影响性能, 但在客户端或许比较有用.
同时也可以看看 `auto_vacuum = INCREMENTAL`.

**\* WAL模式**
```roomsql
PRAGMA journal_mode = WAL;	-- WAL
```
WAL 模式提供了写数据的并发能力, 并且在大多数时候性能更好.
但听说它不适合处理往数据库中写大体积数据的情况.

如果将其设置为 `OFF`

**关闭同步**
```roomsql
PRAGMA synchronous = OFF;	-- 关闭同步
```
这个不适合用在需要写数据的情况, 因为断电会导致数据库损坏.
但在像此应用需要密集导入数据时可能会更快.
但我测试时没有感觉变快, 可能是建立索引太耗时了吧.

**\* 优化数据库**
```roomsql
PRAGMA optimize;
```
文档上说为实现最佳的长期查询性能, 建议在数据库关闭连接前运行一次这个.
同时长期运行的数据库也可能受益于每几个小时定时运行一次.


## 效果

应用上述优化方案, 数据库的查询耗时从接近 1 秒降低到了测试环境中的 20 毫秒.
部署到服务器上最终得到了 50 毫秒的查询耗时. (可能因为我的主机性能更好一些)

除此之外, 还编写了其他一些代码让常用数据缓存在内存中以加速查询.






