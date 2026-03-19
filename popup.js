document.addEventListener('DOMContentLoaded', function() {
    let autoCheck = document.getElementById('autoCheck');
    let dropdownValue = document.getElementById('dropdownValue');
    let autoClickZone = document.getElementById('autoClickZone');
    let zoneKeywords = document.getElementById('zoneKeywords');

    // 讀取已儲存的設定
    chrome.storage.sync.get(['autoCheck', 'dropdownValue', 'autoClickZone', 'zoneKeywords'], function(data) {
        if (data.autoCheck !== undefined) autoCheck.checked = data.autoCheck;
        if (data.dropdownValue !== undefined) dropdownValue.value = data.dropdownValue;
        if (data.autoClickZone !== undefined) autoClickZone.checked = data.autoClickZone;
        if (data.zoneKeywords !== undefined) zoneKeywords.value = data.zoneKeywords;
    });

    // 監聽變更並儲存，同時發送訊息給網頁
    function saveAndNotify() {
        let settings = {
            autoCheck: autoCheck.checked,
            dropdownValue: dropdownValue.value,
            autoClickZone: autoClickZone.checked,
            zoneKeywords: zoneKeywords.value
        };

        chrome.storage.sync.set(settings, function() {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "fillForm", settings: settings });
                }
            });
        });
    }

    autoCheck.addEventListener('change', saveAndNotify);
    dropdownValue.addEventListener('change', saveAndNotify);
    autoClickZone.addEventListener('change', saveAndNotify);
    zoneKeywords.addEventListener('input', saveAndNotify); // 輸入文字時自動儲存
});
