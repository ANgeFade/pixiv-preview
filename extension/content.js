// Pixiv 原图预览 - 极速版

(function () {
    'use strict';

    console.log('🎨 Pixiv 原图预览增强扩展已加载');

    // 检测是否在作品详情页
    function isArtworkPage() {
        return window.location.pathname.match(/^\/(?:[a-z]{2}\/)?artworks\/\d+/);
    }

    // 如果在作品详情页，禁用预览
    if (isArtworkPage()) {
        console.log('📄 作品详情页，预览功能已禁用');
        return;
    }

    // 创建预览容器
    const previewContainer = document.createElement('div');
    previewContainer.className = 'pixiv-preview-container';
    document.body.appendChild(previewContainer);

    // 创建信息显示
    const infoContainer = document.createElement('div');
    infoContainer.className = 'pixiv-preview-info';
    document.body.appendChild(infoContainer);

    // 缓存原图URL
    const urlCache = new Map();

    /**
     * 从URL提取作品信息
     */
    function extractInfo(url) {
        const match = url.match(/\/(\d+)_p(\d+)(?:_master\d+|_square\d+|_custom\d+)?\.(?:jpg|png|jpeg)/);
        if (match) {
            return { id: match[1], page: parseInt(match[2]) };
        }
        return null;
    }

    /**
     * 从父级链接获取ID
     */
    function getIdFromParent(img) {
        const parent = img.closest('a[href*="/artworks/"]');
        if (parent) {
            const match = parent.href.match(/\/artworks\/(\d+)/);
            if (match) return match[1];
        }
        return null;
    }

    /**
     * 构建原图URL
     */
    function buildOriginalUrl(thumbnailUrl, artworkId, page = 0) {
        const dateMatch = thumbnailUrl.match(/\/img\/(\d{4}\/\d{2}\/\d{2}\/\d{2}\/\d{2}\/\d{2})\//);
        if (!dateMatch) return null;

        const datePath = dateMatch[1];
        const base = `https://i.pximg.net/img-original/img/${datePath}/${artworkId}_p${page}`;

        return [
            `${base}.jpg`,
            `${base}.png`
        ];
    }

    /**
     * 显示预览
     */
    function showPreview(urls, info) {
        previewContainer.innerHTML = '<div class="pixiv-preview-loading">⏳ 加载中...</div>';
        previewContainer.style.display = 'block';

        infoContainer.textContent = info;
        infoContainer.style.display = 'block';

        const img = new Image();

        img.onload = function () {
            previewContainer.innerHTML = '';
            previewContainer.appendChild(img);
        };

        img.onerror = function () {
            // JPG失败，尝试PNG
            if (urls.length > 1) {
                img.src = urls[1];
                urls.shift();
            } else {
                previewContainer.innerHTML = '<div class="pixiv-preview-loading">❌ 加载失败</div>';
                setTimeout(hidePreview, 1000);
            }
        };

        // 直接设置URL，浏览器会自动通过declarativeNetRequest添加Referer
        img.src = urls[0];
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
     * 更新位置
     */
    function updatePosition(e) {
        const padding = 20;
        const rect = previewContainer.getBoundingClientRect();

        let left = e.clientX + padding;
        let top = e.clientY + padding;

        if (left + rect.width > window.innerWidth) {
            left = e.clientX - rect.width - padding;
        }

        if (top + rect.height > window.innerHeight) {
            top = e.clientY - rect.height - padding;
        }

        left = Math.max(padding, left);
        top = Math.max(padding, top);

        previewContainer.style.left = left + 'px';
        previewContainer.style.top = top + 'px';
    }

    /**
     * 处理图片
     */
    function processImage(img) {
        if (img.dataset.pixivProcessed) return;

        const imgSrc = img.src || img.dataset.src;
        if (!imgSrc || !imgSrc.includes('i.pximg.net')) return;
        if (imgSrc.includes('user-profile')) return; // 跳过头像

        img.dataset.pixivProcessed = 'true';

        // 获取作品ID
        let artworkId = getIdFromParent(img);
        const info = extractInfo(imgSrc);

        if (!artworkId && info) {
            artworkId = info.id;
        }

        if (!artworkId) return;

        const page = info ? info.page : 0;
        const cacheKey = `${artworkId}_${page}`;

        // 构建原图URL
        const urls = buildOriginalUrl(imgSrc, artworkId, page);
        if (!urls) return;

        urlCache.set(cacheKey, urls);

        // 鼠标事件 - 无延迟！
        let isHovering = false;

        img.addEventListener('mouseenter', function (e) {
            isHovering = true;
            const cachedUrls = urlCache.get(cacheKey);
            if (cachedUrls) {
                showPreview([...cachedUrls], `🎨 ID: ${artworkId} | P${page + 1}`);
                updatePosition(e);
            }
        });

        img.addEventListener('mousemove', function (e) {
            if (isHovering && previewContainer.style.display === 'block') {
                updatePosition(e);
            }
        });

        img.addEventListener('mouseleave', function () {
            isHovering = false;
            hidePreview();
        });
    }

    /**
     * 观察DOM
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

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 处理已存在的图片
    setTimeout(() => {
        document.querySelectorAll('img').forEach(processImage);
        console.log('✨ Pixiv 原图预览就绪！（极速模式）');
    }, 500);

})();
