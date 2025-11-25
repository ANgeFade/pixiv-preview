// 后台脚本 - 处理请求头，绕过防盗链

console.log('🔧 Pixiv 后台脚本启动');

// 注册规则（Manifest V3方式）
chrome.runtime.onInstalled.addListener(() => {
    console.log('✅ Pixiv 原图预览增强扩展已安装');
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchImage') {
        console.log('📥 后台收到下载请求');

        // 使用fetch API获取图片
        fetch(request.url, {
            headers: {
                'Referer': 'https://www.pixiv.net/'
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                // 转换为base64
                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64 = btoa(binary);

                // 检测图片类型
                let mimeType = 'image/jpeg';
                if (request.url.endsWith('.png')) {
                    mimeType = 'image/png';
                }

                // 创建data URL
                const dataUrl = `data:${mimeType};base64,${base64}`;

                console.log('✅ 后台下载成功');
                sendResponse({ success: true, url: dataUrl });
            })
            .catch(error => {
                console.log('❌ 后台下载失败:', error.message);
                sendResponse({ success: false, error: error.message });
            });

        return true; // 保持消息通道开放
    }

    if (request.action === 'checkImage') {
        // 检查图片是否存在
        fetch(request.url, {
            method: 'HEAD',
            headers: {
                'Referer': 'https://www.pixiv.net/'
            }
        })
            .then(response => {
                sendResponse({ exists: response.ok, status: response.status });
            })
            .catch(error => {
                sendResponse({ exists: false, error: error.message });
            });

        return true;
    }
});
