function checkUpdates() {
    chrome.storage.local.get("watchList", (data) => {
        if (!data.watchList || data.watchList.length === 0) return;

        let watchList = data.watchList;
        let hasUnread = false;

        Promise.all(watchList.map(manga => {
            let apiUrl = `https://otruyenapi.com/v1/api/truyen-tranh/${manga.slug}`;
            return fetch(apiUrl)
                .then(response => response.json())
                .then(data => {
                    if (data.status === "success" && data.data && data.data.item) {
                        let mangaData = data.data.item;
                        let latestChapter = "Không rõ";
                        if (Array.isArray(mangaData.chapters) && mangaData.chapters.length > 0 && 
                            Array.isArray(mangaData.chapters[0].server_data) && mangaData.chapters[0].server_data.length > 0) {
                            latestChapter = mangaData.chapters[0].server_data[mangaData.chapters[0].server_data.length - 1].chapter_name;
                        }
                        manga.latestChapter = latestChapter;
                        let lastRead = manga.lastReadChapter || "0";
                        if (lastRead !== latestChapter && latestChapter !== "Không rõ") {
                            hasUnread = true;
                        }
                    }
                })
                .catch(error => console.error(`Lỗi khi kiểm tra ${manga.name}:`, error));
        })).then(() => {
            chrome.storage.local.set({ watchList });
            chrome.action.setIcon({ path: hasUnread ? "icon_color_64.png" : "icon64.png" });
        });
    });
}

// Tạo alarm chạy mỗi giờ
chrome.alarms.create("checkMangaUpdates", {
    periodInMinutes: 60,
    when: Date.now() + 1000 // Chạy lần đầu sau 1 giây
});

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === "checkMangaUpdates") {
        checkUpdates();
    }
});