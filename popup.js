let watchList = [];

function saveWatchList() {
    chrome.storage.local.set({ watchList });
}

function loadWatchList() {
    chrome.storage.local.get("watchList", (data) => {
        if (data.watchList) {
            watchList = data.watchList;
            updateWatchListUI();
        }
    });
}

function showToast(message) {
    let toast = document.getElementById("toast");
    toast.textContent = message;
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 2000);
}

function updateIcon() {
    let hasUnread = watchList.some(manga => {
        let lastRead = manga.lastReadChapter || "0";
        let latest = manga.latestChapter || "Không rõ";
        return lastRead !== latest;
    });
    chrome.action.setIcon({ path: hasUnread ? "icon_color_64.png" : "icon64.png" });
}

function formatDateTime(updatedAt) {
    if (!updatedAt || updatedAt === "Không rõ") return "Không rõ";
    const date = new Date(updatedAt);
    const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000); // UTC+7
    const year = vietnamTime.getUTCFullYear();
    const month = String(vietnamTime.getUTCMonth() + 1).padStart(2, "0");
    const day = String(vietnamTime.getUTCDate()).padStart(2, "0");
    const hours = String(vietnamTime.getUTCHours()).padStart(2, "0");
    const minutes = String(vietnamTime.getUTCMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function updateWatchListUI() {
    let watchListEl = document.getElementById("watchList");
    watchListEl.innerHTML = "";

    watchList.forEach(manga => {
        let mangaName = manga.name;
        let mangaSlug = manga.slug;
        let lastReadChapter = manga.lastReadChapter || "0";
        let li = document.createElement("li");

        li.textContent = `${mangaName} (Đang tải...)`;

        let removeBtn = document.createElement("span");
        removeBtn.textContent = " -";
        removeBtn.classList.add("remove-btn");
        removeBtn.onclick = (e) => removeFromWatchList(mangaName, e);
        li.appendChild(removeBtn);

        watchListEl.appendChild(li);

        let apiUrl = `https://otruyenapi.com/v1/api/truyen-tranh/${mangaSlug}`;
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data.status === "success" && data.data && data.data.item) {
                    let mangaData = data.data.item;
                    let cdnDomain = data.data.APP_DOMAIN_CDN_IMAGE;
                    li.innerHTML = "";

                    let img = document.createElement("img");
                    img.src = `${cdnDomain}/uploads/comics/${mangaData.thumb_url}`;
                    img.classList.add("manga-thumb");
                    li.appendChild(img);

                    let info = document.createElement("div");
                    let latestChapter = "Không rõ";
                    let latestChapterId = manga.latestChapterId || null;

                    // Debug: Kiểm tra giá trị ban đầu của latestChapterId
                    console.log(`[${mangaName}] Initial latestChapterId:`, latestChapterId);

                    if (Array.isArray(mangaData.chapters) && mangaData.chapters.length > 0 && 
                        Array.isArray(mangaData.chapters[0].server_data) && mangaData.chapters[0].server_data.length > 0) {
                        let serverData = mangaData.chapters[0].server_data;

                        // Lần đầu tiên (chưa có latestChapterId)
                        if (!latestChapterId) {
                            let firstChapterData = serverData[0]; // Chapter đầu tiên
                            latestChapter = firstChapterData.chapter_name;
                            let chapterApiData = firstChapterData.chapter_api_data;
                            latestChapterId = chapterApiData ? chapterApiData.split('/').pop() : "Không rõ";
                            manga.latestChapterId = latestChapterId; // Lưu vào manga object
                            console.log(`[${mangaName}] Lần đầu, lấy chapter đầu tiên:`, latestChapterId);
                        } else {
                            // Nếu đã có latestChapterId, lấy chapter cuối cùng
                            let latestChapterData = serverData[serverData.length - 1]; // Chapter cuối cùng
                            latestChapter = latestChapterData.chapter_name;
                            let chapterApiData = latestChapterData.chapter_api_data;
                            latestChapterId = chapterApiData ? chapterApiData.split('/').pop() : latestChapterId;
                            console.log(`[${mangaName}] Đã có latestChapterId, lấy chapter cuối:`, latestChapterId);
                        }
                    } else {
                        latestChapterId = "Không rõ";
                        console.log(`[${mangaName}] Không có server_data`);
                    }

                    let readStatus = (lastReadChapter === "0" || lastReadChapter === "Chưa đọc") 
                        ? `Đã đọc: 0/${latestChapter}` 
                        : `Đã đọc: ${lastReadChapter}/${latestChapter}`;                    

                    info.innerHTML = `<strong>${mangaData.name || "Không rõ"}</strong><br>
                                    Trạng thái: <span class="status-value">${mangaData.status || "Không rõ"}</span><br>
                                    ${readStatus}<br>                                    
                                    Cập nhật: <span class="updated-value">${formatDateTime(mangaData.updatedAt)}</span><br>
                                    <a href="https://haon2409.github.io/manga-reader/?slug=${mangaSlug}&chapter_id=${latestChapterId}" target="_blank" class="read-btn" data-latest="${latestChapter}">Đọc truyện</a>`;
                    li.appendChild(info);

                    let readBtn = info.querySelector(".read-btn");
                    readBtn.addEventListener("click", (event) => {
                        let latestChapterData = mangaData.chapters[0].server_data[mangaData.chapters[0].server_data.length - 1];
                        latestChapter = latestChapterData.chapter_name;
                        let chapterApiData = latestChapterData.chapter_api_data;
                        latestChapterId = chapterApiData ? chapterApiData.split('/').pop() : "Không rõ";
                        manga.lastReadChapter = latestChapter;
                        manga.latestChapter = latestChapter;
                        manga.latestChapterId = latestChapterId;
                        console.log(`[${mangaName}] Sau khi nhấn đọc: latestChapterId =`, latestChapterId);
                        saveWatchList();
                        updateIcon();
                        updateWatchListUI();
                    });

                    li.appendChild(removeBtn);
                    manga.latestChapter = latestChapter;
                    saveWatchList();
                    updateIcon();
                } else {
                    li.innerHTML = `${mangaName} (Không tìm thấy dữ liệu)`;
                    li.appendChild(removeBtn);
                }
            })
            .catch(error => {
                console.error(`Lỗi khi gọi API cho ${mangaName}:`, error);
                li.innerHTML = `${mangaName} (Lỗi tải dữ liệu)`;
                li.appendChild(removeBtn);
            });
    });
}

function addToWatchList(mangaName, mangaSlug) {
    if (!watchList.some(item => item.name === mangaName)) {
        watchList.push({ name: mangaName, slug: mangaSlug, lastReadChapter: "0" });
        saveWatchList();
        updateWatchListUI();
        updateIcon();
        showToast(`Đã thêm "${mangaName}" vào danh sách theo dõi!`);
    }
    searchManga();
}

function removeFromWatchList(mangaName, event) {
    event.stopPropagation();
    const listItem = event.target.closest('li');
    
    // Thêm hiệu ứng slide-out
    listItem.classList.add('slide-out');
    
    // Xóa sau khi hiệu ứng kết thúc
    setTimeout(() => {
        watchList = watchList.filter(manga => manga.name !== mangaName);
        saveWatchList();
        updateIcon();
        
        listItem.remove();
    }, 300);
}

function searchManga() {
    let keyword = document.getElementById("searchBox").value.trim();
    if (!keyword) return;
    fetch(`https://otruyenapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}`)
        .then(response => response.json())
        .then(data => {
            let list = document.getElementById("resultList");
            list.innerHTML = "";
            if (data.status === "success" && data.data && data.data.items) {
                data.data.items.forEach(manga => {
                    let li = document.createElement("li");
                    let img = document.createElement("img");
                    img.src = `https://img.otruyenapi.com/uploads/comics/${manga.thumb_url}`;
                    img.classList.add("manga-thumb");
                    
                    let info = document.createElement("div");
                    info.innerHTML = `<strong>${manga.name || "Không rõ"}</strong><br>
                                      Trạng thái: <span class="status-value">${manga.status || "Không rõ"}</span><br>
                                      Cập nhật: <span class="updated-value">${formatDateTime(manga.updatedAt)}</span>`;
                    
                    li.appendChild(img);
                    li.appendChild(info);
                    
                    if (!watchList.some(item => item.name === manga.name)) {
                        let addBtn = document.createElement("span");
                        addBtn.textContent = " +";
                        addBtn.classList.add("add-btn");
                        addBtn.onclick = () => addToWatchList(manga.name, manga.slug);
                        li.appendChild(addBtn);
                    }
                    
                    list.appendChild(li);
                });
            }
        })
        .catch(error => console.error("Lỗi khi tìm kiếm:", error));
}

document.getElementById("searchBtn").addEventListener("click", searchManga);
document.getElementById("searchBox").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        searchManga();
    }
});

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", function() {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        
        this.classList.add("active");
        document.getElementById(this.dataset.tab).classList.add("active");
        if (this.dataset.tab === "watchlist") updateWatchListUI();
    });
});

loadWatchList();