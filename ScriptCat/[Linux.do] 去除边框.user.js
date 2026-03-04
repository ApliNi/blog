// ==UserScript==
// @name         [Linux.do] 去除边框
// @namespace    http://tampermonkey.net/
// @version      1.0
// @match        *://linux.do/*
// @match        *://idcflare.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const style = document.createElement('style');
    style.textContent = /*css*/`
        /* 标头 */
        .d-header {
            box-shadow: none !important;
            border-bottom: none !important;
        }
        /* 侧边栏 */
        .sidebar-wrapper .sidebar-container {
            border-right: none !important;
        }
        /* 主页 */
        .topic-list .topic-list-data {
            border-bottom: 20px solid transparent;
        }
        .post-menu-area {
            margin: 0 !important;
        }
        .sidebar-section-wrapper {
            border-bottom: none !important;
        }
        .topic-list .link-bottom-line {
            opacity: 0.7;
        }
        /* 话题 */
        .topic-post {
            margin-bottom: 30px;
        }
        .topic-avatar, .topic-body, .topic-map.--op, tbody, .topic-status-info, .topic-timer-info {
            border-top: none !important;
        }
        tr {
            border-color: transparent !important;
        }
        .post-links-container .post-links {
            margin-top: 0 !important;
            padding-top: 0 !important;
            border-top: none !important;
        }
        .topic-map {
            border-bottom: none !important;
        }
    `;
    document.head.appendChild(style);
})();

