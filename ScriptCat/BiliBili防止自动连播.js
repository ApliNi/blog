// ==UserScript==
// @name         BiliBili 防止自动连播
// @namespace    aplini.BiliBili.防止自动连播
// @version      0.1.0
// @description  阻止普通视频的自动连播, 不影响视频合集
// @author       ApliNi
// @match        https://www.bilibili.com/video/*
// ==/UserScript==

(function() {
    setInterval(() => {
        document.querySelector('#bilibili-player div.bpx-player-ending-wrap div.bpx-player-ending-related-item-cancel')?.click();
    }, 4000);
})();
