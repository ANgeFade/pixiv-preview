// ==UserScript==
// @name         Pixiv 原图预览增强
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  在Pixiv上将缩略图替换为原图，鼠标悬停显示原图预览
// @author       You
// @match        https://www.pixiv.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      i.pximg.net
// @connect      www.pixiv.net
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // 添加样式
    GM_addStyle(`
        .pixiv-preview-container {
            position: fixed;
            z-index: 999999;
            pointer-events: none;
            border: 3px solid #0096fa;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            background: #fff;
            padding: 4px;
            max-width: 90vw;
            max-height: 90vh;
            display: none;
        }

        .pixiv-preview-container img {
            max-width: 100%;
            max-height: 85vh;
            display: block;
            object-fit: contain;
        }

        .pixiv-preview-loading {
            padding: 20px;
            color: #333;
            font-size: 14px;
        }

        .pixiv-preview-info {
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 999998;
            display: none;
        }
    `);

    // 创建预览容器
    const previewContainer = document.createElement('div');
    previewContainer.className = 'pixiv-preview-container';
    document.body.appendChild(previewContainer);

    // 创建信息显示容器
    const infoContainer = document.createElement('div');
    infoContainer.className = 'pixiv-preview-info';
    document.body.appendChild(infoContainer);

    // 缓存已获取的作品信息
    const artworkCache = new Map();

    /**
     * 从URL中提取作品ID和页码
     * 例如：137823716_p0_square1200.jpg -> {artworkId: '137823716', page: 0}
     */
    function extractArtworkInfo(url) {
        const match = url.match(/\/(\d+)_p(\d+)(?:_master\d+|_square\d+)?\.(?:jpg|png|jpeg)/);
        if (match) {
            return {
                artworkId: match[1],
                page: parseInt(match[2])
            };
        }
        return null;
    }

    /**
     * 从父级链接中提取作品ID
     */
    function getArtworkIdFromParent(img) {
        const parent = img.closest('a[href*="/artworks/"]');
        if (parent) {
            const match = parent.href.match(/\/artworks\/(\d+)/);
            if (match) {
                return match[1];
            }
        }
        return null;
    }

    /**
     * 构建原图URL
     * 基于缩略图URL和作品信息
     */
    function buildOriginalUrl(thumbnailUrl, artworkId, page = 0) {
        // 从缩略图URL中提取日期路径
        // 例如：/img/2025/11/24/02/20/03/
        const dateMatch = thumbnailUrl.match(/\/img\/(\d{4}\/\d{2}\/\d{2}\/\d{2}\/\d{2}\/\d{2})\//);

        if (!dateMatch) {
            console.log('无法从URL提取日期:', thumbnailUrl);
            return null;
        }

        const datePath = dateMatch[1];

        // 构建原图URL（尝试多种格式）
        const baseUrl = `https://i.pximg.net/img-original/img/${datePath}/${artworkId}_p${page}`;

        return {
            png: `${baseUrl}.png`,
            jpg: `${baseUrl}.jpg`,
            jpeg: `${baseUrl}.jpeg`
        };
    }

    /**
     * 尝试获取可用的原图URL
     */
    async function fetchOriginalImageUrl(urls) {
        if (!urls) return null;

        const formats = ['png', 'jpg', 'jpeg'];

        for (let format of formats) {
            const testUrl = urls[format];
            if (!testUrl) continue;

            try {
                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'HEAD',
                        url: testUrl,
                        headers: {
                            'Referer': 'https://www.pixiv.net/'
                        },
                        timeout: 5000,
                        onload: resolve,
                        onerror: reject,
                        ontimeout: reject
                    });
                });

                if (response.status === 200) {
                    console.log('找到原图:', testUrl);
                    return testUrl;
                }
            } catch (e) {
                console.log('尝试格式失败:', format, e);
                continue;
            }
        }

        return null;
    }

    /**
     * 通过Pixiv API获取作品详情（可选，作为后备方案）
     */
    async function fetchArtworkDetails(artworkId) {
        if (artworkCache.has(artworkId)) {
            return artworkCache.get(artworkId);
        }

        try {
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://www.pixiv.net/ajax/illust/${artworkId}`,
                    headers: {
                        'Accept': 'application/json',
                        'Referer': `https://www.pixiv.net/artworks/${artworkId}`
                    },
                    timeout: 10000,
                    onload: resolve,
                    onerror: reject,
                    ontimeout: reject
                });
            });

            if (response.status === 200) {
                const data = JSON.parse(response.responseText);
                if (data.error === false && data.body) {
                    artworkCache.set(artworkId, data.body);
                    return data.body;
                }
            }
        } catch (e) {
            console.log('获取作品详情失败:', artworkId, e);
        }

        return null;
    }

    /**
     * 显示预览
     */
    function showPreview(originalUrl, info = '') {
        previewContainer.innerHTML = '<div class="pixiv-preview-loading">加载原图中...</div>';
        previewContainer.style.display = 'block';

        if (info) {
            infoContainer.textContent = info;
            infoContainer.style.display = 'block';
        }

        const img = new Image();

        img.onload = function () {
            previewContainer.innerHTML = '';
            previewContainer.appendChild(img);
        };

        img.onerror = function () {
            previewContainer.innerHTML = '<div class="pixiv-preview-loading">❌ 原图加载失败</div>';
            setTimeout(() => {
                previewContainer.style.display = 'none';
            }, 1500);
        };

        // 设置referrer以绕过防盗链
        img.referrerPolicy = 'no-referrer';
        img.src = originalUrl;
    }

    /**
     * 隐藏预览
     */
    function hidePreview() {
        previewContainer.style.display = 'none';
        previewContainer.innerHTML = '';
        infoContainer.style.display = 'none';
    }

    /**
     * 更新预览位置
     */
    function updatePreviewPosition(e) {
        const padding = 20;
        const rect = previewContainer.getBoundingClientRect();

        let left = e.clientX + padding;
        let top = e.clientY + padding;

        // 确保预览框不超出视口
        if (left + rect.width > window.innerWidth) {
            left = e.clientX - rect.width - padding;
        }

        if (top + rect.height > window.innerHeight) {
            top = e.clientY - rect.height - padding;
        }

        // 确保不超出左边和上边
        left = Math.max(padding, left);
        top = Math.max(padding, top);

        previewContainer.style.left = left + 'px';
        previewContainer.style.top = top + 'px';
    }

    /**
     * 处理单个图片元素
     */
    async function processImage(img) {
        if (img.dataset.pixivProcessed) return;

        const imgSrc = img.src || img.dataset.src;
        if (!imgSrc || !imgSrc.includes('i.pximg.net')) return;

        img.dataset.pixivProcessed = 'true';

        // 方法1：从父级链接获取作品ID
        let artworkId = getArtworkIdFromParent(img);

        // 方法2：从图片URL提取作品信息
        const artworkInfo = extractArtworkInfo(imgSrc);

        if (!artworkId && artworkInfo) {
            artworkId = artworkInfo.artworkId;
        }

        if (!artworkId) {
            console.log('无法提取作品ID:', imgSrc);
            return;
        }

        const page = artworkInfo ? artworkInfo.page : 0;

        console.log(`找到作品: ID=${artworkId}, Page=${page}`);

        // 构建原图URL
        const originalUrls = buildOriginalUrl(imgSrc, artworkId, page);

        if (!originalUrls) {
            console.log('无法构建原图URL');
            return;
        }

        // 保存原图信息到元素
        img.dataset.artworkId = artworkId;
        img.dataset.page = page;
        img.dataset.originalUrlsPng = originalUrls.png;
        img.dataset.originalUrlsJpg = originalUrls.jpg;

        // 尝试替换为原图（异步）
        fetchOriginalImageUrl(originalUrls).then(finalUrl => {
            if (finalUrl) {
                img.dataset.originalFinalUrl = finalUrl;

                // 预加载原图（可选）
                const tempImg = new Image();
                tempImg.referrerPolicy = 'no-referrer';
                tempImg.onload = function () {
                    // 成功预加载，可以选择直接替换缩略图
                    // img.src = finalUrl; // 取消注释以直接替换
                    console.log('原图已预加载:', artworkId);
                };
                tempImg.src = finalUrl;
            }
        });

        // 添加鼠标悬停事件
        let hoverTimeout;

        img.addEventListener('mouseenter', async function (e) {
            hoverTimeout = setTimeout(async () => {
                const finalUrl = img.dataset.originalFinalUrl;

                if (finalUrl) {
                    showPreview(finalUrl, `作品ID: ${artworkId} (第${page + 1}页)`);
                    updatePreviewPosition(e);
                } else {
                    // 如果还没获取到，实时获取
                    previewContainer.innerHTML = '<div class="pixiv-preview-loading">正在获取原图...</div>';
                    previewContainer.style.display = 'block';
                    updatePreviewPosition(e);

                    const urls = {
                        png: img.dataset.originalUrlsPng,
                        jpg: img.dataset.originalUrlsJpg,
                        jpeg: img.dataset.originalUrlsJpeg
                    };

                    const url = await fetchOriginalImageUrl(urls);
                    if (url) {
                        img.dataset.originalFinalUrl = url;
                        showPreview(url, `作品ID: ${artworkId} (第${page + 1}页)`);
                        updatePreviewPosition(e);
                    } else {
                        previewContainer.innerHTML = '<div class="pixiv-preview-loading">❌ 无法获取原图</div>';
                        setTimeout(hidePreview, 1500);
                    }
                }
            }, 300);
        });

        img.addEventListener('mousemove', function (e) {
            if (previewContainer.style.display === 'block') {
                updatePreviewPosition(e);
            }
        });

        img.addEventListener('mouseleave', function () {
            clearTimeout(hoverTimeout);
            hidePreview();
        });
    }

    /**
     * 观察DOM变化
     */
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) {
                    if (node.tagName === 'IMG') {
                        processImage(node);
                    }

                    const images = node.querySelectorAll('img');
                    images.forEach(processImage);
                }
            });
        });
    });

    // 开始观察
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 处理已存在的图片
    setTimeout(() => {
        document.querySelectorAll('img').forEach(processImage);
        console.log('Pixiv 原图预览增强脚本已加载 v2.0');
    }, 1000);
})();
