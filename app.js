/* =====================================================
   DX TRUST MEDIA LIFESTYLE COX
   COMPLETE MAIN JAVASCRIPT
===================================================== */

/* 1. SUPABASE CONNECTION */

const SUPABASE_URL = "https://oloasnzcnqeakfpwtttc.supabase.co";
const SUPABASE_KEY = "sb_publishable_3Omy4ITAX9HIVvSf4PVQXA_2PKaOxl5";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


/* 2. GLOBAL VARIABLES */

let currentUser = null;
let currentProfile = null;
let selectedStoreProduct = null;
let selectedResellerProduct = null;

const STORAGE_BUCKET = "product-images";
const MAX_PRODUCT_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;


/* 3. COMMON HELPERS */

function getElement(id) {
  return document.getElementById(id);
}

function getValue(id) {
  const element = getElement(id);
  return element ? String(element.value || "").trim() : "";
}

function setText(id, value) {
  const element = getElement(id);
  if (element) element.textContent = value ?? "";
}

function setHTML(id, value) {
  const element = getElement(id);
  if (element) element.innerHTML = value ?? "";
}

function taka(value) {
  return "৳" + Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showMessage(id, message, isError = false) {
  const element = getElement(id);
  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#ff5555" : "#d6a600";
}

function getProductImages(product) {
  let images = [];

  if (Array.isArray(product.image_urls)) {
    images = product.image_urls;
  } else if (typeof product.image_urls === "string") {
    try {
      images = JSON.parse(product.image_urls);
    } catch {
      images = [];
    }
  }

  if (!images.length && product.image_url) {
    images = [product.image_url];
  }

  return images.filter(Boolean);
}

function productImageHTML(product) {
  const images = getProductImages(product);

  if (!images.length) {
    return `<div class="product-no-image">ছবি নেই</div>`;
  }

  const thumbnails = images.map((url, index) => `
    <button
      type="button"
      onclick="showGalleryImage(this)"
      data-image="${escapeHTML(url)}"
      aria-label="ছবি ${index + 1}"
      style="
        width:58px;
        height:58px;
        padding:2px;
        flex:0 0 58px;
        border:2px solid ${index === 0 ? "#d6a600" : "#555"};
        border-radius:7px;
        background:#080808;
        overflow:hidden;
        cursor:pointer;
      "
    >
      <img
        src="${escapeHTML(url)}"
        alt="ছবি ${index + 1}"
        loading="lazy"
        style="width:100%;height:100%;object-fit:cover;border-radius:5px;"
      >
    </button>
  `).join("");

  return `
    <div class="product-gallery" style="width:100%;">

      <img
        class="product-main-image"
        src="${escapeHTML(images[0])}"
        alt="${escapeHTML(product.name)}"
        loading="lazy"
        style="
          width:100%;
          height:190px;
          object-fit:cover;
          border-radius:10px;
          display:block;
        "
      >

      ${
        images.length > 1
          ? `
            <div style="
              display:flex;
              gap:7px;
              overflow-x:auto;
              padding:9px 2px;
              margin-top:5px;
            ">
              ${thumbnails}
            </div>
            <p style="
              text-align:center;
              color:#d6a600;
              font-size:12px;
              margin:2px 0 8px;
            ">${images.length} টি ছবি • ছবি দেখতে চাপ দিন</p>
          `
          : ""
      }

    </div>
  `;
}

function showGalleryImage(button) {
  const gallery = button.closest(".product-gallery");
  if (!gallery) return;

  const mainImage = gallery.querySelector(".product-main-image");
  const imageUrl = button.getAttribute("data-image");

  if (!mainImage || !imageUrl) return;

  mainImage.src = imageUrl;

  gallery.querySelectorAll("button[data-image]").forEach(item => {
    item.style.opacity = "0.65";
    item.style.borderColor = "#555";
  });

  button.style.opacity = "1";
  button.style.borderColor = "#d6a600";
}

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("bn-BD", {
    dateStyle: "short",
    timeStyle: "short"
  });
}


/* 4. PAGE NAVIGATION */

function show(id) {
  const pages = [
    "store",
    "login",
    "resellerAuth",
    "resellerPanel",
    "panel"
  ];

  pages.forEach(page => {
    const element = getElement(page);
    if (element) element.style.display = "none";
  });

  const target = getElement(id);
  if (target) target.style.display = "block";
}

function openLogin() {
  show("login");
}

function closeOrder() {
  const form = getElement("orderForm");
  if (form) form.style.display = "none";

  selectedStoreProduct = null;
}

function showPage(page) {
  const sections = ["dashboard", "products", "orders"];

  sections.forEach(section => {
    const element = getElement(section);
    if (element) element.style.display = "none";
  });

  const target = getElement(page);
  if (target) target.style.display = "block";

  if (page === "dashboard") {
    loadBonusSettings();
    loadAdminWithdrawals();
  }

  if (page === "products") loadProducts();
  if (page === "orders") loadOrders();
}


/* 5. STORE PRODUCTS */

async function loadStoreProducts() {
  const container = getElement("storeProducts");
  if (!container) return;

  container.innerHTML = "পণ্য লোড হচ্ছে...";

  const { data, error } = await db
    .from("products")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    container.innerHTML = "পণ্য লোড করা যায়নি।";
    console.error(error);
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = "এখনো কোনো পণ্য যোগ করা হয়নি।";
    return;
  }

  container.innerHTML = data.map(product => `
    <div class="product-card">
      ${productImageHTML(product)}
      <h3>${escapeHTML(product.name)}</h3>
      <p>${escapeHTML(product.description || "")}</p>
      <h3>${taka(product.price)}</h3>
      <button onclick="selectStoreProduct(${Number(product.id)})">
        অর্ডার করুন
      </button>
    </div>
  `).join("");
}

async function selectStoreProduct(productId) {
  const { data, error } = await db
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (error || !data) {
    alert("পণ্য পাওয়া যায়নি।");
    return;
  }

  selectedStoreProduct = data;

  const form = getElement("orderForm");
  if (form) {
    form.style.display = "block";
    form.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  showMessage("orderMsg", "নির্বাচিত পণ্য: " + data.name);
}


/* 6. CUSTOMER ORDER */

async function placeOrder(event) {
  if (event) event.preventDefault();

  if (!selectedStoreProduct) {
    showMessage("orderMsg", "আগে একটি পণ্য নির্বাচন করুন।", true);
    return;
  }

  const name = getValue("customerName");
  const phone = getValue("customerPhone");
  const address = getValue("customerAddress");
  const quantity = Number(getValue("orderQuantity") || 1);

  if (!name || !phone || !address) {
    showMessage("orderMsg", "সব তথ্য পূরণ করুন।", true);
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    showMessage("orderMsg", "সঠিক পরিমাণ লিখুন।", true);
    return;
  }

  const { error } = await db.from("orders").insert({
    product_id: selectedStoreProduct.id,
    customer_name: name,
    phone,
    address,
    quantity,
    status: "pending"
  });

  if (error) {
    console.error(error);
    showMessage("orderMsg", "অর্ডার করা যায়নি। আবার চেষ্টা করুন।", true);
    return;
  }

  showMessage("orderMsg", "আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে।");

  const form = getElement("orderForm");
  if (form) form.reset();

  selectedStoreProduct = null;
}


/* 7. ADMIN LOGIN */

async function loginAdmin(event) {
  if (event) event.preventDefault();

  const email = getValue("email");
  const password = getValue("password");

  if (!email || !password) {
    showMessage("loginMsg", "ইমেইল ও পাসওয়ার্ড দিন।", true);
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage("loginMsg", error.message, true);
    return;
  }

  currentUser = data.user;
  await verifyAdmin();
}

async function adminLogin(event) {
  return loginAdmin(event);
}


/* 8. RESELLER REGISTRATION */

async function resellerRegister(event) {
  if (event) event.preventDefault();

  const name = getValue("resellerName");
  const email = getValue("resellerEmail");
  const password = getValue("resellerPassword");
  const referralCode = getValue("referralCode").toUpperCase();

  if (!name || !email || !password) {
    showMessage("resellerMsg", "সব তথ্য পূরণ করুন।", true);
    return;
  }

  if (password.length < 6) {
    showMessage("resellerMsg", "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।", true);
    return;
  }

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role: "reseller",
        referral_code: referralCode
      }
    }
  });

  if (error) {
    showMessage("resellerMsg", error.message, true);
    return;
  }

  if (referralCode) {
    localStorage.setItem("pendingReferralCode", referralCode);
  }

  if (!data.session) {
    showMessage(
      "resellerMsg",
      "রেজিস্ট্রেশন হয়েছে। ইমেইল ভেরিফিকেশন করে লগইন করুন।"
    );
    return;
  }

  currentUser = data.user;
  await applyPendingReferralCode();
  await verifyAdmin();
}


/* 9. RESELLER LOGIN */

async function resellerLogin(event) {
  if (event) event.preventDefault();

  const email = getValue("resellerLoginEmail");
  const password = getValue("resellerLoginPassword");

  if (!email || !password) {
    showMessage("resellerMsg", "ইমেইল ও পাসওয়ার্ড দিন।", true);
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage("resellerMsg", error.message, true);
    return;
  }

  currentUser = data.user;
  await applyPendingReferralCode();
  await verifyAdmin();
}


/* 10. REFERRAL CODE APPLY */

async function applyPendingReferralCode() {
  if (!currentUser) return;

  const code = localStorage.getItem("pendingReferralCode");
  if (!code) return;

  const { data: myProfile, error: myError } = await db
    .from("profiles")
    .select("id,referred_by")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (myError || !myProfile || myProfile.referred_by) {
    localStorage.removeItem("pendingReferralCode");
    return;
  }

  const { data: referrer, error: refError } = await db
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  if (refError || !referrer || referrer.id === currentUser.id) {
    localStorage.removeItem("pendingReferralCode");
    return;
  }

  const { error: updateError } = await db
    .from("profiles")
    .update({ referred_by: referrer.id })
    .eq("id", currentUser.id);

  if (!updateError) {
    localStorage.removeItem("pendingReferralCode");
  } else {
    console.error("Referral update:", updateError);
  }
}


/* 11. VERIFY USER ROLE */

async function verifyAdmin() {
  if (!currentUser) return;

  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error || !data) {
    alert("প্রোফাইল পাওয়া যায়নি।");
    return;
  }

  currentProfile = data;

  if (data.role === "admin") {
    show("panel");
    showPage("dashboard");
    setText("adminName", data.full_name || "Admin");
    return;
  }

  if (data.role === "reseller") {
    show("resellerPanel");
    setText("resellerWelcome", "স্বাগতম, " + (data.full_name || "Reseller"));

    await loadResellerSummary();
    await loadResellerProducts();
    await loadResellerOrders();
    await loadResellerWithdrawals();
    return;
  }

  alert("এই অ্যাকাউন্টের অনুমতি নেই।");
  await logout();
}


/* 12. SESSION CHECK */

async function checkSession() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    console.error(error);
    show("store");
    return;
  }

  if (data.session) {
    currentUser = data.session.user;
    await verifyAdmin();
  } else {
    show("store");
    await loadStoreProducts();
  }
}


/* 13. LOGOUT */

async function logout() {
  await db.auth.signOut();

  currentUser = null;
  currentProfile = null;
  selectedStoreProduct = null;
  selectedResellerProduct = null;

  show("store");
  await loadStoreProducts();
}

async function resellerLogout() {
  return logout();
}


/* 14. ADMIN ADD PRODUCT */

async function addProduct(event) {
  if (event) event.preventDefault();

  const name = getValue("productName");
  const description = getValue("productDescription");
  const price = Number(getValue("productPrice"));

  const fileInput = getElement("productImageFile");
  const files = fileInput ? Array.from(fileInput.files || []) : [];

  if (!name || !Number.isFinite(price) || price <= 0) {
    showMessage("productMsg", "পণ্যের নাম ও সঠিক দাম দিন।", true);
    return;
  }

  if (files.length > MAX_PRODUCT_IMAGES) {
    showMessage("productMsg", "সর্বোচ্চ ৫টি ছবি দেওয়া যাবে।", true);
    return;
  }

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      showMessage("productMsg", "শুধু ছবির ফাইল আপলোড করুন।", true);
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      showMessage("productMsg", "প্রতিটি ছবির সাইজ সর্বোচ্চ ৫ MB হতে পারবে।", true);
      return;
    }
  }

  showMessage("productMsg", "পণ্য যোগ করা হচ্ছে...");

  const imageUrls = [];

  for (const file of files) {
    const extension = file.name.split(".").pop().toLowerCase();
    const safeExtension = /^[a-z0-9]+$/.test(extension) ? extension : "jpg";

    const fileName =
      Date.now() + "_" +
      Math.random().toString(36).slice(2) +
      "." + safeExtension;

    const filePath = "products/" + fileName;

    const { error: uploadError } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) {
      console.error(uploadError);
      showMessage("productMsg", "ছবি আপলোড হয়নি। Storage permission পরীক্ষা করুন।", true);
      return;
    }

    const { data: publicData } = db.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    if (publicData && publicData.publicUrl) {
      imageUrls.push(publicData.publicUrl);
    }
  }

  const { error } = await db.from("products").insert({
    name,
    description,
    price,
    image_url: imageUrls[0] || null,
    image_urls: imageUrls
  });

  if (error) {
    console.error(error);
    showMessage("productMsg", "পণ্য যোগ করা যায়নি।", true);
    return;
  }

  showMessage("productMsg", "পণ্য সফলভাবে যোগ হয়েছে!");

  ["productName", "productDescription", "productPrice"].forEach(id => {
    const element = getElement(id);
    if (element) element.value = "";
  });

  if (fileInput) fileInput.value = "";

  await loadProducts();
  await loadStoreProducts();
}


/* 15. ADMIN PRODUCT LIST */

async function loadProducts() {
  const container = getElement("productList");
  if (!container) return;

  container.innerHTML = "পণ্য লোড হচ্ছে...";

  const { data, error } = await db
    .from("products")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    container.innerHTML = "পণ্য লোড করা যায়নি।";
    console.error(error);
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = "কোনো পণ্য নেই।";
    return;
  }

  container.innerHTML = data.map(product => `
    <div class="admin-product-card">
      ${productImageHTML(product)}
      <h3>${escapeHTML(product.name)}</h3>
      <p>${escapeHTML(product.description || "")}</p>
      <strong>${taka(product.price)}</strong>
      <button onclick="deleteProduct(${Number(product.id)})">
        পণ্য মুছুন
      </button>
    </div>
  `).join("");
}


/* 16. DELETE PRODUCT */

async function deleteProduct(id) {
  if (!confirm("আপনি কি এই পণ্যটি মুছে ফেলতে চান?")) return;

  const { error } = await db
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    alert("পণ্য মুছতে সমস্যা হয়েছে।");
    console.error(error);
    return;
  }

  alert("পণ্য মুছে ফেলা হয়েছে।");
  await loadProducts();
  await loadStoreProducts();
}


/* 17. ADMIN ORDERS */

async function loadOrders() {
  const container = getElement("orderList");
  if (!container) return;

  container.innerHTML = "অর্ডার লোড হচ্ছে...";

  const { data, error } = await db
    .from("orders")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    container.innerHTML = "অর্ডার লোড করা যায়নি।";
    console.error(error);
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = "কোনো অর্ডার নেই।";
    return;
  }

  container.innerHTML = data.map(order => `
    <div class="order-card">
      <h3>অর্ডার #${Number(order.id)}</h3>
      <p>কাস্টমার: ${escapeHTML(order.customer_name)}</p>
      <p>ফোন: ${escapeHTML(order.phone)}</p>
      <p>ঠিকানা: ${escapeHTML(order.address)}</p>
      <p>পণ্য ID: ${Number(order.product_id)}</p>
      <p>পরিমাণ: ${Number(order.quantity)}</p>
      <p>অবস্থা: ${escapeHTML(order.status)}</p>
      ${
        order.status !== "completed"
          ? `<button onclick="completeOrder(${Number(order.id)})">সম্পন্ন করুন</button>`
          : `<span>সম্পন্ন হয়েছে</span>`
      }
    </div>
  `).join("");
}


/* 18. COMPLETE ORDER */

async function completeOrder(id) {
  if (!confirm("এই অর্ডারটি সম্পন্ন হয়েছে নিশ্চিত করছেন?")) return;

  const { error } = await db
    .from("orders")
    .update({ status: "completed" })
    .eq("id", id);

  if (error) {
    alert("অর্ডার আপডেট করা যায়নি।");
    console.error(error);
    return;
  }

  alert("অর্ডার সম্পন্ন হয়েছে।");

  await loadOrders();
  await loadAdminReferralReport();
  await loadAdminBonusReport();
}


/* 19. RESELLER SUMMARY */

async function loadResellerSummary() {
  if (!currentUser) return;

  const { data, error } = await db
    .from("profiles")
    .select("full_name,commission_balance,referral_balance,bonus_balance,referral_code")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error || !data) {
    console.error(error);
    return;
  }

  currentProfile = { ...currentProfile, ...data };

  const commission = Number(data.commission_balance || 0);
  const referral = Number(data.referral_balance || 0);
  const bonus = Number(data.bonus_balance || 0);

  setText("resellerEarnings", taka(commission));
  setText("referralEarnings", taka(referral));
  setText("myReferralCode", data.referral_code || "তৈরি হয়নি");
  setText("withdrawableBalance", taka(commission + referral + bonus));
  setText("resellerWelcome", "স্বাগতম, " + (data.full_name || "Reseller"));

  await loadResellerBonusStatus();
}


/* 20. RESELLER BONUS STATUS */

async function loadResellerBonusStatus() {
  const targetElement = getElement("resellerTarget");
  const statusElement = getElement("resellerBonusStatus");

  const { data: settings } = await db
    .from("bonus_settings")
    .select("target_sales,bonus_amount")
    .limit(1)
    .maybeSingle();

  if (settings && targetElement) {
    targetElement.textContent = taka(settings.target_sales);
  }

  const { data, error } = await db.rpc("get_reseller_bonus_status");

  if (error) {
    console.error("Bonus status:", error);
    if (statusElement) statusElement.textContent = "বোনাসের তথ্য পাওয়া যায়নি।";
    return;
  }

  let result = Array.isArray(data) ? data[0] : data;

  if (typeof result === "boolean") {
    if (statusElement) {
      statusElement.textContent = result
        ? "বোনাস অর্জিত হয়েছে।"
        : "বোনাসের লক্ষ্য এখনো পূরণ হয়নি।";
    }
    return;
  }

  if (result && typeof result === "object") {
    const status = result.status ?? result.eligible ?? result.bonus_eligible;

    if (statusElement) {
      statusElement.textContent =
        status === true || status === "true" || status === "completed"
          ? "বোনাস অর্জিত হয়েছে।"
          : "বোনাসের লক্ষ্য এখনো পূরণ হয়নি।";
    }

    if (result.sales_total !== undefined) {
      setText("resellerSales", taka(result.sales_total));
    }
    return;
  }

  if (statusElement) {
    statusElement.textContent = "বোনাসের অবস্থা যাচাই করা হয়েছে।";
  }
}


/* 21. RESELLER PRODUCTS */

async function loadResellerProducts() {
  const container = getElement("resellerProducts");
  if (!container) return;

  container.innerHTML = "পণ্য লোড হচ্ছে...";

  const { data, error } = await db
    .from("products")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    container.innerHTML = "পণ্য লোড করা যায়নি।";
    console.error(error);
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = "কোনো পণ্য নেই।";
    return;
  }

  container.innerHTML = data.map(product => `
    <div class="product-card">
      ${productImageHTML(product)}
      <h3>${escapeHTML(product.name)}</h3>
      <p>${escapeHTML(product.description || "")}</p>
      <h3>${taka(product.price)}</h3>
      <button onclick="selectResellerProduct(${Number(product.id)})">
        এই পণ্য নির্বাচন করুন
      </button>
    </div>
  `).join("");
}

async function selectResellerProduct(id) {
  const { data, error } = await db
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    alert("পণ্য পাওয়া যায়নি।");
    return;
  }

  selectedResellerProduct = data;

  showMessage("resellerOrderMsg", "নির্বাচিত পণ্য: " + data.name);

  const form = getElement("resellerCustomerName");
  if (form) {
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}


/* 22. RESELLER PLACE ORDER */

async function placeResellerOrder(event) {
  if (event) event.preventDefault();

  if (!currentUser) {
    showMessage("resellerOrderMsg", "আগে লগইন করুন।", true);
    return;
  }

  if (!selectedResellerProduct) {
    showMessage("resellerOrderMsg", "আগে পণ্য নির্বাচন করুন।", true);
    return;
  }

  const name = getValue("resellerCustomerName");
  const phone = getValue("resellerCustomerPhone");
  const address = getValue("resellerCustomerAddress");
  const quantity = Number(getValue("resellerQuantity") || 1);

  if (!name || !phone || !address) {
    showMessage("resellerOrderMsg", "সব তথ্য পূরণ করুন।", true);
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    showMessage("resellerOrderMsg", "সঠিক পরিমাণ লিখুন।", true);
    return;
  }

  const { error } = await db.from("orders").insert({
    product_id: selectedResellerProduct.id,
    customer_name: name,
    phone,
    address,
    quantity,
    reseller_id: currentUser.id,
    status: "pending"
  });

  if (error) {
    console.error(error);
    showMessage("resellerOrderMsg", "অর্ডার করা যায়নি।", true);
    return;
  }

  showMessage("resellerOrderMsg", "রিসেলার অর্ডার সফল হয়েছে।");

  [
    "resellerCustomerName",
    "resellerCustomerPhone",
    "resellerCustomerAddress",
    "resellerQuantity"
  ].forEach(id => {
    const element = getElement(id);
    if (element) element.value = "";
  });

  selectedResellerProduct = null;
  await loadResellerOrders();
}


/* 23. RESELLER ORDER HISTORY */

async function loadResellerOrders() {
  if (!currentUser) return;

  const container = getElement("resellerOrderList");
  if (!container) return;

  container.innerHTML = "অর্ডার লোড হচ্ছে...";

  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("reseller_id", currentUser.id)
    .order("id", { ascending: false });

  if (error) {
    container.innerHTML = "অর্ডার লোড করা যায়নি।";
    console.error(error);
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = "আপনার কোনো অর্ডার নেই।";
    return;
  }

  container.innerHTML = data.map(order => `
    <div class="order-card">
      <h3>অর্ডার #${Number(order.id)}</h3>
      <p>কাস্টমার: ${escapeHTML(order.customer_name)}</p>
      <p>ফোন: ${escapeHTML(order.phone)}</p>
      <p>পণ্য ID: ${Number(order.product_id)}</p>
      <p>পরিমাণ: ${Number(order.quantity)}</p>
      <p>অবস্থা: ${escapeHTML(order.status)}</p>
      <p>তারিখ: ${formatDate(order.created_at)}</p>
    </div>
  `).join("");
}


/* 24. REFERRAL LINK */

async function copyReferralLink() {
  if (!currentProfile || !currentProfile.referral_code) {
    showMessage("referralLinkMsg", "রেফারেল কোড পাওয়া যায়নি।", true);
    return;
  }

  const link =
    window.location.origin +
    window.location.pathname +
    "?ref=" +
    encodeURIComponent(currentProfile.referral_code);

  try {
    await navigator.clipboard.writeText(link);
    showMessage("referralLinkMsg", "রেফারেল লিংক কপি হয়েছে!");
  } catch {
    const input = document.createElement("textarea");
    input.value = link;
    document.body.appendChild(input);
    input.select();

    try {
      document.execCommand("copy");
      showMessage("referralLinkMsg", "রেফারেল লিংক কপি হয়েছে!");
    } catch {
      showMessage("referralLinkMsg", link);
    }

    input.remove();
  }
}


/* 25. RESELLER WITHDRAWAL REQUEST */

async function requestWithdrawal(event) {
  if (event) event.preventDefault();

  const amount = Number(getValue("withdrawAmount"));
  const method = getValue("withdrawMethod").toLowerCase();
  const number = getValue("withdrawNumber");

  if (!Number.isFinite(amount) || amount <= 0) {
    showMessage("withdrawMsg", "সঠিক টাকার পরিমাণ দিন।", true);
    return;
  }

  if (!["bkash", "nagad"].includes(method)) {
    showMessage("withdrawMsg", "bKash অথবা Nagad নির্বাচন করুন।", true);
    return;
  }

  if (!number) {
    showMessage("withdrawMsg", "মোবাইল নম্বর দিন।", true);
    return;
  }

  const { error } = await db.rpc("request_withdrawal", {
    p_amount: amount,
    p_payment_method: method,
    p_payment_number: number
  });

  if (error) {
    console.error(error);
    showMessage("withdrawMsg", error.message, true);
    return;
  }

  showMessage("withdrawMsg", "উত্তোলনের আবেদন জমা হয়েছে।");

  const amountInput = getElement("withdrawAmount");
  const numberInput = getElement("withdrawNumber");

  if (amountInput) amountInput.value = "";
  if (numberInput) numberInput.value = "";

  await loadResellerSummary();
  await loadResellerWithdrawals();
}


/* 26. RESELLER WITHDRAWAL HISTORY */

async function loadResellerWithdrawals() {
  if (!currentUser) return;

  const container = getElement("resellerWithdrawalList");
  if (!container) return;

  container.innerHTML = "আবেদন লোড হচ্ছে...";

  const { data, error } = await db
    .from("withdrawal_requests")
    .select("*")
    .eq("reseller_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = "আবেদন লোড করা যায়নি।";
    console.error(error);
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = "কোনো উত্তোলনের আবেদন নেই।";
    return;
  }

  container.innerHTML = data.map(item => `
    <div class="withdrawal-card">
      <h3>আবেদন ID: ${Number(item.id)}</h3>
      <p>টাকার পরিমাণ: ${taka(item.amount)}</p>
      <p>মাধ্যম: ${escapeHTML(item.payment_method)}</p>
      <p>মোবাইল নম্বর: ${escapeHTML(item.payment_number)}</p>
      <p>অবস্থা: ${escapeHTML(item.status)}</p>
      <p>তারিখ: ${formatDate(item.created_at)}</p>
    </div>
  `).join("");
}


/* 27. ADMIN WITHDRAWAL LIST */

async function loadAdminWithdrawals() {
  const container = getElement("adminWithdrawalList");
  if (!container) return;

  container.innerHTML = "আবেদন লোড হচ্ছে...";

  const { data, error } = await db
    .from("withdrawal_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = "আবেদন লোড করা যায়নি।";
    console.error(error);
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = "কোনো আবেদন নেই।";
    return;
  }

  container.innerHTML = data.map(item => `
    <div class="withdrawal-card">
      <h3>আবেদন ID: ${Number(item.id)}</h3>
      <p>রিসেলার ID: ${escapeHTML(item.reseller_id)}</p>
      <p>টাকার পরিমাণ: ${taka(item.amount)}</p>
      <p>পেমেন্ট মাধ্যম: ${escapeHTML(item.payment_method)}</p>
      <p>মোবাইল নম্বর: ${escapeHTML(item.payment_number)}</p>
      <p>তারিখ: ${formatDate(item.created_at)}</p>
      <p>অবস্থা: ${escapeHTML(item.status)}</p>
      ${
        item.status === "pending"
          ? `
            <button onclick="processWithdrawal(${Number(item.id)}, 'paid')">
              টাকা পাঠানো হয়েছে
            </button>
            <button onclick="processWithdrawal(${Number(item.id)}, 'rejected')">
              আবেদন বাতিল
            </button>
          `
          : ""
      }
    </div>
  `).join("");
}


/* 28. ADMIN PROCESS WITHDRAWAL */

async function processWithdrawal(id, action) {
  if (!["paid", "rejected"].includes(action)) return;

  const message = action === "paid"
    ? "আপনি কি সত্যিই রিসেলারকে টাকা পাঠিয়েছেন?"
    : "আপনি কি এই আবেদন বাতিল করতে চান?";

  if (!confirm(message)) return;

  if (action === "paid") {
    alert("সতর্কতা: bKash/Nagad-এ বাস্তবে টাকা পাঠানোর পরেই নিশ্চিত করবেন।");
  }

  const { error } = await db.rpc("admin_process_withdrawal", {
    p_request_id: id,
    p_action: action
  });

  if (error) {
    console.error(error);
    showMessage("adminWithdrawalMsg", error.message, true);
    return;
  }

  showMessage("adminWithdrawalMsg", "আবেদনের অবস্থা আপডেট হয়েছে।");
  await loadAdminWithdrawals();
}


/* 29. BONUS SETTINGS */

async function loadBonusSettings() {
  const { data, error } = await db
    .from("bonus_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  if (!data) return;

  const target = getElement("bonusTarget");
  const amount = getElement("bonusAmount");

  if (target) target.value = data.target_sales;
  if (amount) amount.value = data.bonus_amount;
}


/* 30. SAVE BONUS SETTINGS */

async function saveBonusSettings(event) {
  if (event) event.preventDefault();

  const targetSales = Number(getValue("bonusTarget"));
  const bonusAmount = Number(getValue("bonusAmount"));

  if (
    !Number.isFinite(targetSales) ||
    targetSales <= 0 ||
    !Number.isFinite(bonusAmount) ||
    bonusAmount < 0
  ) {
    showMessage("bonusMsg", "সঠিক বোনাসের তথ্য দিন।", true);
    return;
  }

  const { data: existing, error: findError } = await db
    .from("bonus_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (findError) {
    showMessage("bonusMsg", "সেটিংস যাচাই করা যায়নি।", true);
    console.error(findError);
    return;
  }

  let result;

  if (existing) {
    result = await db
      .from("bonus_settings")
      .update({
        target_sales: targetSales,
        bonus_amount: bonusAmount,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id);
  } else {
    result = await db
      .from("bonus_settings")
      .insert({
        target_sales: targetSales,
        bonus_amount: bonusAmount
      });
  }

  if (result.error) {
    console.error(result.error);
    showMessage("bonusMsg", result.error.message, true);
    return;
  }

  showMessage("bonusMsg", "বোনাস সেটিংস সংরক্ষণ হয়েছে।");
}


/* 31. ADMIN BONUS REPORT */

async function loadAdminBonusReport() {
  const container = getElement("adminBonusReport");
  if (!container) return;

  container.innerHTML = "বোনাস রিপোর্ট লোড হচ্ছে...";

  const { data, error } = await db
    .from("reseller_monthly_bonus")
    .select("*");

  if (error) {
    container.innerHTML = "বোনাস রিপোর্ট পাওয়া যায়নি।";
    console.error(error);
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = "এখনো কোনো বোনাস রিপোর্ট নেই।";
    return;
  }

  container.innerHTML = data.map(item => `
    <div class="report-card">
      <p>রিসেলার ID: ${escapeHTML(item.reseller_id || "-")}</p>
      <p>মোট বিক্রয়: ${taka(item.sales_total)}</p>
      <p>লক্ষ্যমাত্রা: ${taka(item.target_sales)}</p>
      <p>বোনাস: ${taka(item.bonus_amount)}</p>
      <p>তারিখ: ${formatDate(item.created_at)}</p>
    </div>
  `).join("");
}


/* 32. ADMIN REFERRAL REPORT */

async function loadAdminReferralReport() {
  const container = getElement("adminReferralReport");
  if (!container) return;

  container.innerHTML = "রেফারেল রিপোর্ট লোড হচ্ছে...";

  const { data, error } = await db
    .from("referral_rewards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = "রেফারেল রিপোর্ট পাওয়া যায়নি।";
    console.error(error);
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = "এখনো কোনো রেফারেল রিওয়ার্ড নেই।";
    return;
  }

  container.innerHTML = data.map(item => `
    <div class="report-card">
      <p>অর্ডার ID: ${Number(item.order_id)}</p>
      <p>রেফারার ID: ${escapeHTML(item.referrer_id)}</p>
      <p>নতুন রিসেলার ID: ${escapeHTML(item.referred_reseller_id)}</p>
      <p>রিওয়ার্ড: ${taka(item.reward_amount)}</p>
      <p>তারিখ: ${formatDate(item.created_at)}</p>
    </div>
  `).join("");
}


/* 33. REFERRAL URL DETECTION */

function detectReferralCode() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("ref");

  if (code) {
    const input = getElement("referralCode");

    if (input) input.value = code.toUpperCase();

    localStorage.setItem(
      "pendingReferralCode",
      code.toUpperCase()
    );
  }
}


/* 34. AUTH STATE LISTENER */

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    currentUser = null;
    currentProfile = null;
    show("store");
  }
});


/* 35. INITIAL APP START */

document.addEventListener("DOMContentLoaded", async () => {
  detectReferralCode();
  await loadStoreProducts();
  await checkSession();
});


/* =====================================================
   END OF DX TRUST MEDIA LIFESTYLE COX
===================================================== */
