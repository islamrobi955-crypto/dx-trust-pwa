/* =====================================
   DX TRUST MEDIA LIFESTYLE COX
   MAIN JAVASCRIPT
===================================== */

/* SUPABASE CONNECTION */

const SUPABASE_URL = "https://oloasnzcnqeakfpwtttc.supabase.co";
const SUPABASE_KEY = "sb_publishable_30my4ITAX9HIVVSf4PVQXA_2PKa0x15";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let selectedProductId = null;
let selectedProductPrice = 0;
let currentResellerUser = null;
let resellerSelectedProductId = null;


/* PAGE CONTROL */

function show(id) {
  const section = document.getElementById(id);

  if (!section) {
    console.error("Section not found:", id);
    return;
  }

  document.querySelectorAll("section").forEach(s => {
    s.classList.remove("active");
  });

  section.classList.add("active");
  window.scrollTo(0, 0);
}

function openLogin() {
  show("login");
}

function showPage(id) {
  ["dashboard", "products", "orders"].forEach(x => {
    const el = document.getElementById(x);
    if (el) el.style.display = x === id ? "block" : "none";
  });

  if (id === "products") loadProducts();
  if (id === "orders") loadOrders();
  if (id === "dashboard") {
    loadBonusSettings();
    loadAdminResellerSummary();
  }
}


/* ADMIN LOGIN */

async function adminLogin() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("loginMsg");

  if (!email || !password) {
    msg.textContent = "ইমেইল ও পাসওয়ার্ড দাও।";
    return;
  }

  msg.textContent = "Login হচ্ছে...";

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      msg.textContent = "Login Error: " + error.message;
      return;
    }

    await verifyAdmin(data.user, "loginMsg");

  } catch (error) {
    msg.textContent = "সমস্যা: " + error.message;
  }
}


/* VERIFY USER ROLE */

async function verifyAdmin(user, msgId = "loginMsg") {
  const msg = document.getElementById(msgId);

  const { data: p, error } = await db
    .from("profiles")
    .select("role,full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !p) {
    await db.auth.signOut();

    if (msg) {
      msg.textContent =
        "প্রোফাইল সমস্যা: " +
        (error?.message || "প্রোফাইল পাওয়া যায়নি");
    }

    show(msgId === "resellerMsg" ? "resellerAuth" : "login");
    return;
  }

  if (p.role === "reseller") {
    currentResellerUser = user;

    document.getElementById("resellerWelcome").textContent =
      "স্বাগতম, " + (p.full_name || user.email);

    show("resellerPanel");

    await loadResellerProducts();
    await loadResellerOrders();
    await loadResellerSummary();
    return;
  }

  if (p.role === "admin") {
    currentResellerUser = null;

    document.getElementById("adminName").textContent =
      "Admin: " + (p.full_name || user.email);

    show("panel");
    showPage("dashboard");
    await loadBonusSettings();
    return;
  }

  await db.auth.signOut();

  currentResellerUser = null;
  show("store");
}


/* ADMIN LOGOUT */

async function logout() {
  await db.auth.signOut();
  currentResellerUser = null;

  document.getElementById("password").value = "";
  show("store");
}


/* RESELLER REGISTRATION */
/* RESELLER REGISTRATION */

async function resellerRegister() {
  const name = document.getElementById("resellerName").value.trim();
  const email = document.getElementById("resellerEmail").value.trim();
  const password = document.getElementById("resellerPassword").value;
  const referralCode = document.getElementById("referralCode").value.trim().toUpperCase();
  const msg = document.getElementById("resellerMsg");

  if (!name || !email || !password) {
    msg.textContent = "সব তথ্য পূরণ করো।";
    return;
  }

  if (password.length < 6) {
    msg.textContent = "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।";
    return;
  }

  msg.textContent = "অ্যাকাউন্ট তৈরি হচ্ছে...";

  const { data, error } = await db.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        full_name: name,
        referral_code: referralCode || null
      }
    }
  });

  if (error) {
    msg.textContent = "সমস্যা: " + error.message;
    return;
  }

  msg.textContent =
    "রেজিস্ট্রেশন সফল হয়েছে। এখন লগইন করো।";

  document.getElementById("resellerName").value = "";
  document.getElementById("resellerEmail").value = "";
  document.getElementById("resellerPassword").value = "";
  document.getElementById("referralCode").value = "";
}


/* RESELLER LOGIN */

async function resellerLogin() {
  const email =
    document.getElementById("resellerLoginEmail").value.trim();

  const password =
    document.getElementById("resellerLoginPassword").value;

  const msg = document.getElementById("resellerMsg");

  if (!email || !password) {
    msg.textContent = "ইমেইল ও পাসওয়ার্ড দাও।";
    return;
  }

  msg.textContent = "Login হচ্ছে...";

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg.textContent = "Login সমস্যা: " + error.message;
    return;
  }

  await verifyAdmin(data.user, "resellerMsg");
}


/* RESELLER LOGOUT */

async function resellerLogout() {
  await db.auth.signOut();

  currentResellerUser = null;
  resellerSelectedProductId = null;

  show("store");
}


/* LOAD STORE PRODUCTS */

async function loadStoreProducts() {
  const list = document.getElementById("storeProducts");

  if (!list) return;

  list.textContent = "পণ্য লোড হচ্ছে...";

  const { data, error } = await db
    .from("products")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    list.textContent = "পণ্য লোড সমস্যা: " + error.message;
    return;
  }

  list.innerHTML = "";

  if (!data || data.length === 0) {
    list.textContent = "এখনো কোনো পণ্য যোগ করা হয়নি।";
    return;
  }

  data.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";

    if (p.image_url) {
      const img = document.createElement("img");
      img.src = p.image_url;
      img.alt = p.name;
      card.appendChild(img);
    }

    const title = document.createElement("h3");
    title.textContent = p.name;
    card.appendChild(title);

    const desc = document.createElement("p");
    desc.textContent = p.description || "";
    card.appendChild(desc);

    const price = document.createElement("p");
    price.className = "price";
    price.textContent = "দাম: ৳" + p.price;
    card.appendChild(price);

    const btn = document.createElement("button");
    btn.textContent = "অর্ডার করুন";
    btn.onclick = () => openOrder(p.id, p.name, p.price);
    card.appendChild(btn);

    list.appendChild(card);
  });
}


/* CUSTOMER ORDER FORM */

function openOrder(id, name, price) {
  selectedProductId = id;
  selectedProductPrice = Number(price);

  document.getElementById("selectedProduct").textContent =
    name + " — ৳" + price;

  document.getElementById("orderForm").style.display = "block";
  document.getElementById("orderMsg").textContent = "";

  document.getElementById("orderForm").scrollIntoView({
    behavior: "smooth"
  });
}

function closeOrder() {
  document.getElementById("orderForm").style.display = "none";
  selectedProductId = null;
}


/* CUSTOMER PLACE ORDER */

async function placeOrder() {
  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const address = document.getElementById("customerAddress").value.trim();
  const quantity = Number(document.getElementById("orderQuantity").value);
  const msg = document.getElementById("orderMsg");

  if (!selectedProductId) {
    msg.textContent = "আগে একটি পণ্য নির্বাচন করো।";
    return;
  }

  if (!name || !phone || !address) {
    msg.textContent = "সব তথ্য পূরণ করো।";
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    msg.textContent = "সঠিক পরিমাণ লিখো।";
    return;
  }

  msg.textContent = "অর্ডার জমা হচ্ছে...";

  const { error } = await db.from("orders").insert({
    product_id: selectedProductId,
    customer_name: name,
    phone: phone,
    address: address,
    quantity: quantity
  });

  if (error) {
    msg.textContent = "অর্ডার সমস্যা: " + error.message;
    return;
  }

  msg.textContent = "অর্ডার সফলভাবে জমা হয়েছে।";

  document.getElementById("customerName").value = "";
  document.getElementById("customerPhone").value = "";
  document.getElementById("customerAddress").value = "";
  document.getElementById("orderQuantity").value = "1";

  selectedProductId = null;
}


/* ADMIN ADD PRODUCT */

async function addProduct() {
  const name = document.getElementById("productName").value.trim();
  const description =
    document.getElementById("productDescription").value.trim();

  const price = Number(
    document.getElementById("productPrice").value
  );

  const file =
    document.getElementById("productImageFile").files[0];

  const msg = document.getElementById("productMsg");

  if (!name || !Number.isFinite(price) || price <= 0) {
    msg.textContent = "পণ্যের নাম ও সঠিক দাম লিখুন।";
    return;
  }

  let imageUrl = null;

  if (file) {
    if (!file.type.startsWith("image/")) {
      msg.textContent = "শুধু ছবির ফাইল নির্বাচন করো।";
      return;
    }

    msg.textContent = "ছবি আপলোড হচ্ছে...";

    const extension = file.name.split(".").pop();
    const fileName =
      Date.now() + "-" + Math.random().toString(36).slice(2) +
      "." + extension;

    const { error: uploadError } = await db.storage
      .from("product-images")
      .upload(fileName, file);

    if (uploadError) {
      msg.textContent = "ছবি আপলোড সমস্যা: " + uploadError.message;
      return;
    }

    const { data: publicData } = db.storage
      .from("product-images")
      .getPublicUrl(fileName);

    imageUrl = publicData.publicUrl;
  }

  msg.textContent = "পণ্য সংরক্ষণ হচ্ছে...";

  const { error } = await db.from("products").insert({
    name: name,
    description: description,
    price: price,
    image_url: imageUrl
  });

  if (error) {
    msg.textContent = "পণ্য যোগ সমস্যা: " + error.message;
    return;
  }

  msg.textContent = "পণ্য সফলভাবে যোগ হয়েছে।";

  document.getElementById("productName").value = "";
  document.getElementById("productDescription").value = "";
  document.getElementById("productPrice").value = "";
  document.getElementById("productImageFile").value = "";

  await loadProducts();
  await loadStoreProducts();
}


/* DELETE PRODUCT */

async function deleteProduct(id) {
  if (!confirm("পণ্যটি মুছে ফেলবে?")) return;

  const { error } = await db
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    alert("সমস্যা: " + error.message);
    return;
  }

  alert("পণ্য মুছে ফেলা হয়েছে।");

  await loadProducts();
  await loadStoreProducts();
}


/* ADMIN LOAD ORDERS */

async function loadOrders() {
  const list = document.getElementById("orderList");

  if (!list) return;

  list.textContent = "অর্ডার লোড হচ্ছে...";

  const { data, error } = await db
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = "অর্ডার সমস্যা: " + error.message;
    return;
  }

  list.innerHTML = "";

  if (!data || data.length === 0) {
    list.textContent = "এখনো কোনো অর্ডার নেই।";
    return;
  }

  data.forEach(o => {
    const card = document.createElement("div");
    card.className = "card";

    const info = document.createElement("p");

    info.textContent =
      "অর্ডার ID: " + o.id +
      "\nকাস্টমার: " + o.customer_name +
      "\nমোবাইল: " + o.phone +
      "\nঠিকানা: " + o.address +
      "\nপণ্যের ID: " + o.product_id +
      "\nপরিমাণ: " + o.quantity +
      "\nরিসেলার ID: " + (o.reseller_id || "কাস্টমার অর্ডার") +
      "\nঅবস্থা: " + o.status;

    card.appendChild(info);

    if (o.status !== "completed") {
      const btn = document.createElement("button");
      btn.textContent = "অর্ডার সম্পন্ন";
      btn.onclick = () => completeOrder(o.id);
      card.appendChild(btn);
    } else {
      const done = document.createElement("p");
      done.className = "status";
      done.textContent = "অর্ডার সম্পন্ন হয়েছে";
      card.appendChild(done);
    }

    list.appendChild(card);
  });
}


/* COMPLETE ORDER */

async function completeOrder(id) {
  if (!confirm("এই অর্ডারটি সম্পন্ন করতে চাও?")) return;

  const { data, error } = await db
    .from("orders")
    .update({ status: "completed" })
    .eq("id", id)
    .neq("status", "completed")
    .select("id")
    .maybeSingle();

  if (error) {
    alert("অর্ডার আপডেট সমস্যা: " + error.message);
    return;
  }

  if (!data) {
    alert("অর্ডারটি আগে থেকেই সম্পন্ন হয়েছে।");
    await loadOrders();
    return;
  }

  alert("অর্ডার সম্পন্ন হয়েছে।");
  await loadOrders();
}


/* RESELLER LOAD PRODUCTS */

async function loadResellerProducts() {
  const box = document.getElementById("resellerProducts");

  if (!box) return;

  box.textContent = "পণ্য লোড হচ্ছে...";

  const { data, error } = await db
    .from("products")
    .select("id,name,price")
    .order("id", { ascending: false });

  if (error) {
    box.textContent = "পণ্য সমস্যা: " + error.message;
    return;
  }

  box.innerHTML = "";

  if (!data || data.length === 0) {
    box.textContent = "কোনো পণ্য নেই।";
    return;
  }

  data.forEach(p => {
    const btn = document.createElement("button");

    btn.textContent = p.name + " — ৳" + p.price;

    btn.onclick = () => {
      resellerSelectedProductId = p.id;

      box.querySelectorAll("button").forEach(b => {
        b.style.outline = "none";
      });

      btn.style.outline = "2px solid white";

      document.getElementById("resellerOrderMsg").textContent =
        "নির্বাচিত পণ্য: " + p.name;
    };

    box.appendChild(btn);
  });
}


/* RESELLER PLACE ORDER */

async function placeResellerOrder() {
  if (!currentResellerUser) {
    alert("আগে রিসেলার লগইন করো।");
    return;
  }

  const name =
    document.getElementById("resellerCustomerName").value.trim();

  const phone =
    document.getElementById("resellerCustomerPhone").value.trim();

  const address =
    document.getElementById("resellerCustomerAddress").value.trim();

  const quantity =
    Number(document.getElementById("resellerQuantity").value);

  const msg = document.getElementById("resellerOrderMsg");

  if (!resellerSelectedProductId) {
    msg.textContent = "একটি পণ্য নির্বাচন করো।";
    return;
  }

  if (!name || !phone || !address) {
    msg.textContent = "কাস্টমারের সব তথ্য পূরণ করো।";
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    msg.textContent = "সঠিক পরিমাণ লিখো।";
    return;
  }

  msg.textContent = "অর্ডার জমা হচ্ছে...";

  const { error } = await db.from("orders").insert({
    product_id: resellerSelectedProductId,
    customer_name: name,
    phone: phone,
    address: address,
    quantity: quantity,
    reseller_id: currentResellerUser.id,
    status: "pending"
  });

  if (error) {
    msg.textContent = "অর্ডার সমস্যা: " + error.message;
    return;
  }

  msg.textContent = "অর্ডার সফলভাবে জমা হয়েছে।";

  document.getElementById("resellerCustomerName").value = "";
  document.getElementById("resellerCustomerPhone").value = "";
  document.getElementById("resellerCustomerAddress").value = "";
  document.getElementById("resellerQuantity").value = "1";

  await loadResellerOrders();
}


/* RESELLER ORDER LIST */

async function loadResellerOrders() {
  const box = document.getElementById("resellerOrderList");

  if (!box || !currentResellerUser) return;

  box.textContent = "অর্ডার লোড হচ্ছে...";

  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("reseller_id", currentResellerUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    box.textContent = "অর্ডার সমস্যা: " + error.message;
    return;
  }

  box.innerHTML = "";

  if (!data || data.length === 0) {
    box.textContent = "এখনো কোনো অর্ডার জমা হয়নি।";
    return;
  }

  data.forEach(order => {
    const item = document.createElement("div");
    item.className = "card";

    item.textContent =
      "অর্ডার ID: " + order.id +
      "\nকাস্টমার: " + order.customer_name +
      "\nমোবাইল: " + order.phone +
      "\nপরিমাণ: " + order.quantity +
      "\nঅবস্থা: " + order.status;

    box.appendChild(item);
  });
}

/* RESELLER EARNINGS AND MONTHLY SALES */

async function loadResellerSummary() {
  if (!currentResellerUser) return;

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("commission_balance,referral_balance,referral_code")
    .eq("id", currentResellerUser.id)
    .maybeSingle();

  if (profileError) {
    document.getElementById("resellerEarnings").textContent =
      "আয়ের হিসাব সমস্যা: " + profileError.message;
    return;
  }

  document.getElementById("resellerEarnings").textContent =
    "৳" + Number(profile?.commission_balance || 0);

  document.getElementById("referralEarnings").textContent =
    "৳" + Number(profile?.referral_balance || 0);

  document.getElementById("myReferralCode").textContent =
    profile?.referral_code || "কোড পাওয়া যায়নি";

  const now = new Date();

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).toISOString();

  const { data: orders, error: orderError } = await db
    .from("orders")
    .select("product_id,quantity,created_at,status")
    .eq("reseller_id", currentResellerUser.id)
    .eq("status", "completed")
    .gte("created_at", start);

  if (orderError) {
    document.getElementById("resellerSales").textContent =
      "বিক্রির হিসাব সমস্যা: " + orderError.message;
    return;
  }

  const ids = [...new Set((orders || []).map(o => o.product_id))];

  let products = [];

  if (ids.length) {
    const { data, error } = await db
      .from("products")
      .select("id,price")
      .in("id", ids);

    if (error) {
      document.getElementById("resellerSales").textContent =
        "পণ্যের হিসাব সমস্যা: " + error.message;
      return;
    }

    products = data || [];
  }

  let sales = 0;

  (orders || []).forEach(order => {
    const product = products.find(p => p.id === order.product_id);

    if (product) {
      sales += Number(product.price) * Number(order.quantity);
    }
  });

  document.getElementById("resellerSales").textContent =
    "এই মাসের বিক্রি: ৳" + sales;

  const { data: targetData, error: targetError } =
    await db.rpc("get_reseller_target");

  if (targetError) {
    document.getElementById("resellerTarget").textContent =
      "লক্ষ্য লোড সমস্যা: " + targetError.message;
  } else {
    const target = Number(targetData || 100000);
    const progress = target > 0
      ? Math.min(100, sales / target * 100).toFixed(1)
      : "0.0";

    document.getElementById("resellerTarget").textContent =
      "মাসিক লক্ষ্য: ৳" + target +
      " | অগ্রগতি: " + progress + "%";
  }

  const { data: bonusData, error: bonusError } =
    await db.rpc("get_reseller_bonus_status");

  if (bonusError) {
    document.getElementById("resellerBonusStatus").textContent =
      "বোনাসের হিসাব সমস্যা: " + bonusError.message;
  } else {
    document.getElementById("resellerBonusStatus").textContent =
      bonusData
        ? "অভিনন্দন! এই মাসের বোনাস অর্জিত হয়েছে।"
        : "এই মাসের বোনাসের লক্ষ্য এখনো পূরণ হয়নি।";
  }
}
/* COPY RESELLER REFERRAL LINK */

async function copyReferralLink() {
  if (!currentResellerUser) return;

  const msg = document.getElementById("referralLinkMsg");

  const { data, error } = await db
    .from("profiles")
    .select("referral_code")
    .eq("id", currentResellerUser.id)
    .maybeSingle();

  if (error || !data?.referral_code) {
    msg.textContent = "রেফারেল কোড পাওয়া যায়নি।";
    return;
  }

  const link = window.location.origin +
    window.location.pathname +
    "?ref=" + encodeURIComponent(data.referral_code);

  try {
    await navigator.clipboard.writeText(link);
    msg.textContent = "রেফারেল লিংক কপি হয়েছে।";
  } catch {
    msg.textContent =
      "লিংক কপি হয়নি। কোড: " + data.referral_code;
  }
               }


/* ADMIN BONUS SETTINGS */

async function loadBonusSettings() {
  const { data, error } = await db
    .from("bonus_settings")
    .select("target_sales,bonus_amount")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    document.getElementById("bonusMsg").textContent =
      "লোড সমস্যা: " + error.message;
    return;
  }

  if (data) {
    document.getElementById("bonusTarget").value =
      data.target_sales;

    document.getElementById("bonusAmount").value =
      data.bonus_amount;
  }
}


async function saveBonusSettings() {
  const target =
    Number(document.getElementById("bonusTarget").value);

  const bonus =
    Number(document.getElementById("bonusAmount").value);

  const msg = document.getElementById("bonusMsg");

  if (
    !Number.isFinite(target) ||
    target <= 0 ||
    !Number.isFinite(bonus) ||
    bonus < 0
  ) {
    msg.textContent = "সঠিক টাকার পরিমাণ লিখুন।";
    return;
  }

  msg.textContent = "সংরক্ষণ হচ্ছে...";

  const { error } = await db
    .from("bonus_settings")
    .update({
      target_sales: target,
      bonus_amount: bonus,
      updated_at: new Date().toISOString()
    })
    .eq("id", 1);

  if (error) {
    msg.textContent = "সংরক্ষণ সমস্যা: " + error.message;
    return;
  }

  msg.textContent = "বোনাস সেটিংস সফলভাবে সংরক্ষিত হয়েছে।";
}


/* ADMIN RESELLER BONUS REPORT */

async function loadAdminBonusReport() {
  const box = document.getElementById("adminBonusReport");

  box.textContent = "বোনাসের হিসাব লোড হচ্ছে...";

  const { data: bonuses, error } = await db
    .from("reseller_monthly_bonus")
    .select("reseller_id,month_start,bonus_amount")
    .order("month_start", { ascending: false });

  if (error) {
    box.textContent = "রিপোর্ট সমস্যা: " + error.message;
    return;
  }

  if (!bonuses || bonuses.length === 0) {
    box.textContent = "এখনো কোনো রিসেলার বোনাস অর্জন করেনি।";
    return;
  }

  const ids = [...new Set(bonuses.map(b => b.reseller_id))];

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id,full_name")
    .in("id", ids);

  if (profileError) {
    box.textContent = "রিসেলার তথ্য সমস্যা: " + profileError.message;
    return;
  }

  box.innerHTML = "";

  bonuses.forEach(b => {
    const profile = profiles.find(p => p.id === b.reseller_id);

    const item = document.createElement("div");
    item.className = "card";

    item.textContent =
      "রিসেলার: " + (profile?.full_name || "নাম পাওয়া যায়নি") +
      " | মাস: " + b.month_start +
      " | বোনাস: ৳" + Number(b.bonus_amount);

    box.appendChild(item);
  });
}


/* ADMIN ALL RESELLER REPORT */

async function loadAdminResellerSummary() {
  const box = document.getElementById("adminBonusReport");

  box.textContent = "সব রিসেলারের হিসাব লোড হচ্ছে...";

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id,full_name")
    .eq("role", "reseller");

  if (profileError) {
    box.textContent = "রিসেলার তথ্য সমস্যা: " + profileError.message;
    return;
  }

  if (!profiles || profiles.length === 0) {
    box.textContent = "কোনো রিসেলার পাওয়া যায়নি।";
    return;
  }

  const now = new Date();

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const startDate =
    now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-01";

  const { data: targetData, error: targetError } =
    await db.rpc("get_reseller_target");

  if (targetError) {
    box.textContent = "লক্ষ্য লোড সমস্যা: " + targetError.message;
    return;
  }

  const target = Number(targetData || 100000);

  const { data: orders, error: orderError } = await db
    .from("orders")
    .select("reseller_id,product_id,quantity,status,commission_amount,created_at");

  if (orderError) {
    box.textContent = "অর্ডারের হিসাব সমস্যা: " + orderError.message;
    return;
  }

  const { data: bonuses, error: bonusError } = await db
    .from("reseller_monthly_bonus")
    .select("reseller_id,month_start,bonus_amount")
    .eq("month_start", startDate);

  if (bonusError) {
    box.textContent = "বোনাসের হিসাব সমস্যা: " + bonusError.message;
    return;
  }

  const ids = [...new Set((orders || []).map(o => o.product_id))];

  let products = [];

  if (ids.length) {
    const { data, error } = await db
      .from("products")
      .select("id,price")
      .in("id", ids);

    if (error) {
      box.textContent = "পণ্যের হিসাব সমস্যা: " + error.message;
      return;
    }

    products = data || [];
  }

  box.innerHTML = "";

  profiles.forEach(profile => {
    const resellerOrders = (orders || []).filter(
      o => o.reseller_id === profile.id
    );

    const totalOrders = resellerOrders.length;

    const completedOrders = resellerOrders.filter(
      o => o.status === "completed"
    );

    const completedCount = completedOrders.length;

    let monthlySales = 0;
    let totalCommission = 0;

    completedOrders.forEach(order => {
      totalCommission += Number(order.commission_amount || 0);

      const orderDate = new Date(order.created_at);

      if (orderDate >= start) {
        const product = products.find(
          p => p.id === order.product_id
        );

        if (product) {
          monthlySales +=
            Number(product.price) * Number(order.quantity);
        }
      }
    });

    const progress = target > 0
      ? Math.min(100, monthlySales / target * 100).toFixed(1)
      : "0.0";

    const bonus = (bonuses || []).find(
      b => b.reseller_id === profile.id
    );

    const item = document.createElement("div");
    item.className = "card";

    item.textContent =
      "রিসেলার: " + (profile.full_name || "নাম পাওয়া যায়নি") +
      " | মোট অর্ডার: " + totalOrders +
      " | সম্পন্ন অর্ডার: " + completedCount +
      " | এই মাসের বিক্রি: ৳" + monthlySales +
      " | মোট কমিশন আয়: ৳" + totalCommission +
      " | লক্ষ্যের অগ্রগতি: " + progress + "%" +
      " | বোনাস: " +
      (bonus
        ? "অর্জিত ৳" + Number(bonus.bonus_amount)
        : "অর্জিত হয়নি");

    box.appendChild(item);
  });
}


/* ADMIN LOAD PRODUCTS */

async function loadProducts() {
  const list = document.getElementById("productList");

  if (!list) return;

  list.textContent = "পণ্য লোড হচ্ছে...";

  const { data, error } = await db
    .from("products")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    list.textContent = "সমস্যা: " + error.message;
    return;
  }

  list.innerHTML = "";

  if (!data || data.length === 0) {
    list.textContent = "কোনো পণ্য নেই।";
    return;
  }

  data.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";

    if (p.image_url) {
      const img = document.createElement("img");
      img.src = p.image_url;
      img.alt = p.name;
      card.appendChild(img);
    }

    const title = document.createElement("h3");
    title.textContent = p.name;
    card.appendChild(title);

    const desc = document.createElement("p");
    desc.textContent = p.description || "";
    card.appendChild(desc);

    const price = document.createElement("p");
    price.className = "price";
    price.textContent = "দাম: ৳" + p.price;
    card.appendChild(price);

    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "পণ্য মুছুন";
    del.onclick = () => deleteProduct(p.id);

    card.appendChild(del);
    list.appendChild(card);
  });
}


/* CHECK EXISTING LOGIN SESSION */

async function checkSession() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    console.log(error.message);
    return;
  }

  if (data.session) {
    await verifyAdmin(data.session.user);
  }
}

/* AUTO FILL REFERRAL CODE FROM URL */

function loadReferralCodeFromURL() {
  const code = new URLSearchParams(window.location.search).get("ref");

  if (code) {
    const input = document.getElementById("referralCode");

    if (input) {
      input.value = code.trim().toUpperCase();
    }
  }
}


/* START APP */

loadReferralCodeFromURL();
loadStoreProducts();
checkSession();
