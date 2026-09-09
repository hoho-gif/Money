const GAS_URL = "https://script.google.com/macros/s/AKfycbzSMlNS_DBTP7FzoU_yFuLE7AC0R--o7e20wnxxwB_sAEjvKjeK6DWIKExjq5Dmhglf-g/exec";
const gpsButton = document.getElementById("gpsButton");
const shopInput = document.getElementById("shop");
const shopGroup = document.getElementById("shopGroup");
const shopCandidates = document.getElementById("shopCandidates");
const categorySelect = document.getElementById("category");
const categoryGroup = document.getElementById("categoryGroup");
const expenseForm = document.getElementById("expenseForm");
const submitButton = document.getElementById("submitButton");
const message = document.getElementById("message");
const amountInput = document.getElementById("amount");
const typeSelect = document.getElementById("type");
const mapWrapper = document.getElementById("mapWrapper");
const mapSearchButton = document.getElementById("mapSearchButton");

let map = null;
let marker = null;

amountInput.addEventListener("input", () => {
    amountInput.value = amountInput.value.replace(/[^0-9]/g, "");
});

typeSelect.addEventListener("change", updateShopVisibility);
updateShopVisibility();

function updateShopVisibility() {
    const isCharge = typeSelect.value === "charge";
    shopGroup.style.display = isCharge ? "none" : "block";
    shopInput.required = !isCharge;
    if (isCharge) {
        shopInput.value = "";
        shopCandidates.style.display = "none";
        mapWrapper.style.display = "none";
    }
    categoryGroup.style.display = isCharge ? "none" : "block";
    categorySelect.required = !isCharge;
    if (isCharge) {
        categorySelect.value = "";
    }
}

gpsButton.addEventListener("click", () => {
    if (typeSelect.value === "charge") {
        return;
    }
    if (!navigator.geolocation) {
        showMessage("このブラウザではGPSを利用できません。", "error");
        return;
    }
    gpsButton.disabled = true;
    gpsButton.textContent = "取得中…";
    navigator.geolocation.getCurrentPosition(
        position => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            showMap(latitude, longitude);
            findShop(latitude, longitude);
        },
        error => {
            console.error(error);
            showMessage("現在地を取得できませんでした。", "error");
            resetGpsButton();
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
});

function showMap(latitude, longitude) {
    mapWrapper.style.display = "block";

    if (!map) {
        map = L.map("shopMap").setView([latitude, longitude], 17);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }).addTo(map);

        marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);

        map.on("click", event => {
            marker.setLatLng(event.latlng);
        });
    } else {
        map.setView([latitude, longitude], 17);
        marker.setLatLng([latitude, longitude]);
        // 地図のサイズがdisplay:noneの間に変わっていることがあるため再計算する
        setTimeout(() => map.invalidateSize(), 100);
    }
}

mapSearchButton.addEventListener("click", () => {
    if (!marker) {
        return;
    }
    const position = marker.getLatLng();
    mapSearchButton.disabled = true;
    mapSearchButton.textContent = "検索中…";
    findShopFromMap(position.lat, position.lng);
});

async function findShopFromMap(latitude, longitude) {
    try {
        await runFindShop(latitude, longitude);
    } finally {
        mapSearchButton.disabled = false;
        mapSearchButton.textContent = "この位置で店舗を検索";
    }
}

async function findShop(latitude, longitude) {
    try {
        await runFindShop(latitude, longitude);
    } finally {
        resetGpsButton();
    }
}

async function runFindShop(latitude, longitude) {
    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "findShop",
                latitude: latitude,
                longitude: longitude
            })
        });
        const result = await response.json();
        console.log(result);
        if (!result.success) {
            throw new Error(result.message || "店舗検索に失敗しました。");
        }
        displayShopCandidates(result.shops);
    } catch (error) {
        console.error(error);
        showMessage("店舗を検索できませんでした。", "error");
    }
}

function displayShopCandidates(shops) {
    shopCandidates.innerHTML = "";
    shopCandidates.style.display = "block";
    shops.forEach(shop => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "shop-candidate";
        button.innerHTML = `
            <div class="shop-name">${escapeHTML(shop.name)}</div>
            <div class="shop-distance">約 ${Math.round(shop.distance)} m</div>
        `;
        button.addEventListener("click", () => {
            shopInput.value = shop.name;
            shopCandidates.style.display = "none";
        });
        shopCandidates.appendChild(button);
    });
}

expenseForm.addEventListener("submit", async event => {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = "登録中…";
    const data = {
        action: "saveExpense",
        date: new Date().toISOString(),
        type: document.getElementById("type").value,
        amount: document.getElementById("amount").value,
        payment: document.getElementById("payment").value,
        shop: document.getElementById("shop").value,
        category: document.getElementById("category").value,
        memo: document.getElementById("memo").value
    };
    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || "登録に失敗しました。");
        }
        showMessage("登録しました！", "success");
        expenseForm.reset();
        document.getElementById("type").value = "expense";
        shopCandidates.style.display = "none";
        mapWrapper.style.display = "none";
        updateShopVisibility();
    } catch (error) {
        console.error(error);
        showMessage("登録できませんでした。", "error");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "登録";
    }
});

function resetGpsButton() {
    gpsButton.disabled = false;
    gpsButton.textContent = "📍 現在地";
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = "message " + type;
    setTimeout(() => {
        message.className = "message";
    }, 4000);
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}