document.addEventListener('DOMContentLoaded', function() {
    const enableAutoCheck = document.getElementById('enableAutoCheck');
    const dropdownChoice = document.getElementById('dropdownChoice');

    // 1. 打開面板時，載入之前儲存的設定
    chrome.storage.sync.get(['autoCheck', 'dropdownValue'], function(data) {
        if (data.autoCheck !== undefined) enableAutoCheck.checked = data.autoCheck;
        if (data.dropdownValue !== undefined) dropdownChoice.value = data.dropdownValue;
    });

    // 2. 建立一個「儲存並執行」的共用函數
    function saveAndApply() {
        const settings = {
            autoCheck: enableAutoCheck.checked,
            dropdownValue: dropdownChoice.value
        };

        // 儲存設定到 Chrome
        chrome.storage.sync.set(settings, function() {
            // 找出當前正在瀏覽的網頁頁籤，發送訊息讓它立刻改變網頁內容
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                // 確保有抓到當前頁面，避免報錯
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {action: "fillForm", settings: settings});
                }
            });
        });
    }

    // 3. 監聽變更事件 (只要一改變，立刻觸發存檔並執行！)
    enableAutoCheck.addEventListener('change', saveAndApply);
    dropdownChoice.addEventListener('change', saveAndApply);
});
