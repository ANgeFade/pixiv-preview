// Popup 脚本

document.addEventListener('DOMContentLoaded', function () {
    // 清除缓存按钮
    document.getElementById('clearCache').addEventListener('click', function () {
        chrome.storage.local.clear(() => {
            alert('✅ 缓存已清除！');
            updateCacheCount();
        });
    });

    // 更新缓存计数
    function updateCacheCount() {
        chrome.storage.local.get(null, function (items) {
            const count = Object.keys(items).length;
            document.getElementById('cacheCount').textContent = `${count} 张`;
        });
    }

    // 初始化
    updateCacheCount();
});
