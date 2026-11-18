/* =====================================
   DX TRUST MEDIA LIFESTYLE COX
   MAIN JAVASCRIPT
===================================== */

/* SUPABASE CONNECTION */

const SUPABASE_URL = "https://oloasnzcnqeakfpwtttc.supabase.co";

const SUPABASE_KEY = "sb_publishable_3Omy4ITAX9HIVvSf4PVQXA_2PKaOxl5";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


/* GLOBAL VARIABLES */

let selectedProductId = null;
let selectedProductPrice = 0;
let currentResellerUser = null;
let resellerSelectedProductId = null;


/* GET PRODUCT IMAGES */

function getProductImages(product) {
  if (
    Array.isArray(product.image_urls) &&
    product.image_urls.length > 0
  ) {
    return product.image_urls.filter(Boolean);
  }

  return product.image_url
    ? [product.image_url]
    : [];
}


/* SHOW PRODUCT IMAGE GALLERY */

function appendProductGallery(container, product) {
  const images = getProductImages(product);

  if (!images.length) return;

  const gallery = document.createElement("div");
  gallery.style.marginBottom = "12px";

  const mainImage = document.createElement("img");

  mainImage.src = images[0];
  mainImage.alt = product.name || "Product";
  mainImage.style.width = "100%";
  mainImage.style.maxWidth = "350px";
  mainImage.style.height = "220px";
  mainImage.style.objectFit = "contain";
  mainImage.style.borderRadius = "10px";
  mainImage.style.display = "block";

  gallery.appendChild(mainImage);

  if (images.length > 1) {
    const thumbnails = document.createElement("div");

    thumbnails.style.display = "flex";
    thumbnails.style.flexWrap = "wrap";
    thumbnails.style.gap = "7px";
    thumbnails.style.marginTop = "8px";

    images.forEach(url => {
      const thumb = document.createElement("img");

      thumb.src = url;
      thumb.alt = "Product image";
      thumb.style.width = "58px";
      thumb.style.height = "58px";
      thumb.style.objectFit = "cover";
      thumb.style.borderRadius = "6px";
      thumb.style.cursor = "pointer";
      thumb.style.border = "2px solid transparent";

      thumb.onclick = () => {
        mainImage.src = url;
      };

      thumbnails.appendChild(thumb);
    });

    gallery.appendChild(thumbnails);
  }

  container.appendChild(gallery);
}

/* =====================================
   PAGE CONTROL
===================================== */

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

    if (el) {
      el.style.display = x === id ? "block" : "none";
    }
  });

  if (id === "products") {
    loadProducts();
  }

  if (id === "orders") {
    loadOrders();
  }

  if (id === "dashboard") {
    loadBonusSettings();
    loadAdminResellerSummary();
    loadAdminWithdrawals();
  }
}


/* =====================================
   ADMIN LOGIN
===================================== */

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


/* =====================================
   VERIFY USER ROLE
===================================== */

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
    await loadResellerWithdrawals();

    return;
  }

  if (p.role === "admin") {
    currentResellerUser = null;

    document.getElementById("adminName").textContent =
      "Admin: " + (p.full_name || user.email);

    show("panel");

    showPage("dashboard");

    return;
  }

  await db.auth.signOut();

  currentResellerUser = null;

  show("store");
}


/* =====================================
   ADMIN LOGOUT
===================================== */

async function logout() {
  await db.auth.signOut();

  currentResellerUser = null;

  document.getElementById("password").value = "";

  show("store");
}

/* =====================================
   RESELLER REGISTRATION
===================================== */

async function resellerRegister() {
  const name =
    document.getElementById("resellerName").value.trim();

  const email =
    document.getElementById("resellerEmail").value.trim();

  const password =
    document.getElementById("resellerPassword").value;

  const referralCode =
    document.getElementById("referralCode").value.trim().toUpperCase();

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

  const { error } = await db.auth.signUp({
    email,
    password,
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


/* =====================================
   RESELLER LOGIN
===================================== */

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


/* =====================================
   RESELLER LOGOUT
===================================== */

async function resellerLogout() {
  await db.auth.signOut();

  currentResellerUser = null;
  resellerSelectedProductId = null;

  show("store");
}
/* =====================================
   LOAD STORE PRODUCTS
===================================== */

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

    // একাধিক পণ্যের ছবি দেখাবে
    appendProductGallery(card, p);

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


/* =====================================
   CUSTOMER ORDER FORM
===================================== */

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


/* =====================================
   CUSTOMER PLACE ORDER
===================================== */

async function placeOrder() {
  const name =
    document.getElementById("customerName").value.trim();

  const phone =
    document.getElementById("customerPhone").value.trim();

  const address =
    document.getElementById("customerAddress").value.trim();

  const quantity =
    Number(document.getElementById("orderQuantity").value);

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
    phone,
    address,
    quantity
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

/* =====================================
   ADMIN ADD PRODUCT
   MULTIPLE IMAGE UPLOAD
===================================== */

async function addProduct() {
  const name =
    document.getElementById("productName").value.trim();

  const description =
    document.getElementById("productDescription").value.trim();

  const price =
    Number(document.getElementById("productPrice").value);

  const input =
    document.getElementById("productImageFile");

  const files =
    Array.from(input.files || []);

  const msg =
    document.getElementById("productMsg");

  if (!name || !Number.isFinite(price) || price <= 0) {
    msg.textContent = "পণ্যের নাম ও সঠিক দাম লিখুন।";
    return;
  }

  if (files.length > 5) {
    msg.textContent = "সর্বোচ্চ ৫টি ছবি নির্বাচন করতে পারবে।";
    return;
  }

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      msg.textContent = "শুধু ছবির ফাইল নির্বাচন করো।";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      msg.textContent =
        "প্রতিটি ছবির সাইজ সর্বোচ্চ ৫ MB হতে পারবে।";
      return;
    }
  }

  const imageUrls = [];

  if (files.length > 0) {
    msg.textContent = "ছবি আপলোড হচ্ছে...";

    for (const file of files) {
      const extension =
        file.name.split(".").pop().toLowerCase();

      const fileName =
        Date.now() + "-" +
        Math.random().toString(36).slice(2) +
        "." + extension;

      const { error: uploadError } = await db.storage
        .from("product-images")
        .upload(fileName, file);

      if (uploadError) {
        msg.textContent =
          "ছবি আপলোড সমস্যা: " + uploadError.message;
        return;
      }

      const { data: publicData } = db.storage
        .from("product-images")
        .getPublicUrl(fileName);

      imageUrls.push(publicData.publicUrl);
    }
  }

  msg.textContent = "পণ্য সংরক্ষণ হচ্ছে...";

  const { error } = await db.from("products").insert({
    name,
    description,
    price,
    image_url: imageUrls[0] || null,
    image_urls: imageUrls
  });

  if (error) {
    msg.textContent =
      "পণ্য যোগ সমস্যা: " + error.message;
    return;
  }

  msg.textContent = "পণ্য সফলভাবে যোগ হয়েছে।";

  document.getElementById("productName").value = "";
  document.getElementById("productDescription").value = "";
  document.getElementById("productPrice").value = "";
  input.value = "";

  await loadProducts();
  await loadStoreProducts();
}
/* =====================================
   DELETE PRODUCT
===================================== */

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


/* =====================================
   ADMIN LOAD ORDERS
===================================== */

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


/* =====================================
   COMPLETE ORDER
===================================== */

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
/* =====================================
   PART 7: RESELLER PRODUCTS & ORDER
===================================== */


/* LOAD RESELLER PRODUCTS */

async function loadResellerProducts() {
  const box = document.getElementById("resellerProducts");

  if (!box) return;

  box.textContent = "পণ্য লোড হচ্ছে...";

  const { data, error } = await db
    .from("products")
    .select("id,name,description,price,image_url,image_urls")
    .order("id", { ascending: false });

  if (error) {
    box.textContent = "পণ্য লোড করা যায়নি।";
    console.error(error);
    return;
  }

  box.innerHTML = "";

  if (!data || data.length === 0) {
    box.textContent = "এখনো কোনো পণ্য যোগ করা হয়নি।";
    return;
  }

  data.forEach(p => {
    const card = document.createElement("div");

    card.style.border = "1px solid #ddd";
    card.style.borderRadius = "10px";
    card.style.padding = "12px";
    card.style.marginBottom = "12px";

    appendProductGallery(card, p);

    const name = document.createElement("h3");
    name.textContent = p.name;

    const description = document.createElement("p");
    description.textContent = p.description || "";

    const price = document.createElement("p");
    price.textContent = "মূল্য: ৳" + p.price;

    const btn = document.createElement("button");
    btn.textContent = "এই পণ্য নির্বাচন করুন";

    btn.onclick = () => {
      resellerSelectedProductId = p.id;

      box.querySelectorAll("button").forEach(b => {
        b.style.outline = "none";
      });

      btn.style.outline = "2px solid green";

      const msg = document.getElementById("resellerOrderMsg");

      if (msg) {
        msg.textContent = "নির্বাচিত পণ্য: " + p.name;
      }
    };

    card.appendChild(name);
    card.appendChild(description);
    card.appendChild(price);
    card.appendChild(btn);

    box.appendChild(card);
  });
}


/* PLACE RESELLER ORDER */

async function placeResellerOrder() {
  if (!currentResellerUser) {
    alert("আগে রিসেলার লগইন করো।");
    return;
  }

  if (!resellerSelectedProductId) {
    alert("আগে একটি পণ্য নির্বাচন করো।");
    return;
  }

  const name = document.getElementById("resellerCustomerName")?.value.trim();
  const phone = document.getElementById("resellerCustomerPhone")?.value.trim();
  const address = document.getElementById("resellerCustomerAddress")?.value.trim();
  const quantity = Number(
    document.getElementById("resellerQuantity")?.value
  );

  if (!name || !phone || !address || !quantity || quantity < 1) {
    alert("সব তথ্য সঠিকভাবে পূরণ করো।");
    return;
  }

  const { data: product, error: productError } = await db
    .from("products")
    .select("id,name,price")
    .eq("id", resellerSelectedProductId)
    .single();

  if (productError || !product) {
    alert("পণ্যটি পাওয়া যায়নি। আবার নির্বাচন করো।");
    return;
  }

  const total = Number(product.price) * quantity;

  const { error } = await db
    .from("orders")
    .insert([{
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      quantity: quantity,
      total: total,
      customer_name: name,
      customer_phone: phone,
      customer_address: address,
      reseller_id: currentResellerUser.id,
      status: "pending"
    }]);

  if (error) {
    alert("অর্ডার করা যায়নি: " + error.message);
    console.error(error);
    return;
  }

  alert("রিসেলার অর্ডার সফলভাবে জমা হয়েছে।");

  document.getElementById("resellerCustomerName").value = "";
  document.getElementById("resellerCustomerPhone").value = "";
  document.getElementById("resellerCustomerAddress").value = "";
  document.getElementById("resellerQuantity").value = 1;

  resellerSelectedProductId = null;

  const msg = document.getElementById("resellerOrderMsg");

  if (msg) {
    msg.textContent = "";
  }

  await loadResellerOrders();
  }

/* =====================================
   PART 8: RESELLER ORDERS
===================================== */

async function loadResellerOrders() {
  const box = document.getElementById("resellerOrders");

  if (!box) return;

  if (!currentResellerUser) {
    box.textContent = "রিসেলার লগইন করা নেই।";
    return;
  }

  box.textContent = "অর্ডার লোড হচ্ছে...";

  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("reseller_id", currentResellerUser.id)
    .order("id", { ascending: false });

  if (error) {
    box.textContent = "অর্ডার লোড করা যায়নি।";
    console.error(error);
    return;
  }

  box.innerHTML = "";

  if (!data || data.length === 0) {
    box.textContent = "তুমি এখনো কোনো অর্ডার করোনি।";
    return;
  }

  data.forEach(order => {
    const card = document.createElement("div");

    card.style.border = "1px solid #ddd";
    card.style.borderRadius = "10px";
    card.style.padding = "12px";
    card.style.marginBottom = "10px";

    const title = document.createElement("h3");
    title.textContent = order.product_name || "পণ্য";

    const customer = document.createElement("p");
    customer.textContent =
      "কাস্টমারের নাম: " + (order.customer_name || "");

    const phone = document.createElement("p");
    phone.textContent =
      "মোবাইল: " + (order.customer_phone || "");

    const quantity = document.createElement("p");
    quantity.textContent =
      "পরিমাণ: " + (order.quantity || 1);

    const total = document.createElement("p");
    total.textContent =
      "মোট মূল্য: ৳" + (order.total || 0);

    const status = document.createElement("p");
    status.textContent =
      "অর্ডারের অবস্থা: " + (order.status || "pending");

    card.appendChild(title);
    card.appendChild(customer);
    card.appendChild(phone);
    card.appendChild(quantity);
    card.appendChild(total);
    card.appendChild(status);

    box.appendChild(card);
  });
  }
/* =====================================
   PART 9: RESELLER EARNINGS & BONUS
===================================== */

async function loadResellerSummary() {
  if (!currentResellerUser) return;

  const userId = currentResellerUser.id;

  /* RESELLER COMMISSION */

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("commission_balance")
    .eq("id", userId)
    .single();

  if (profileError) {
    console.error("Profile error:", profileError);
  }

  const earningsBox = document.getElementById("resellerEarnings");

  if (earningsBox) {
    earningsBox.textContent =
      "কমিশন আয়: ৳" +
      Number(profile?.commission_balance || 0).toFixed(2);
  }


  /* CURRENT MONTH SALES */

  const now = new Date();

  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const { data: orders, error: ordersError } = await db
    .from("orders")
    .select("product_id,quantity,created_at,status")
    .eq("reseller_id", userId)
    .eq("status", "completed")
    .gte("created_at", monthStart.toISOString());

  if (ordersError) {
    console.error("Monthly orders error:", ordersError);
  }

  let monthlySales = 0;

  if (orders && orders.length > 0) {
    const productIds = [
      ...new Set(orders.map(o => o.product_id).filter(Boolean))
    ];

    const { data: products, error: productsError } = await db
      .from("products")
      .select("id,price")
      .in("id", productIds);

    if (productsError) {
      console.error("Products error:", productsError);
    }

    const priceMap = {};

    (products || []).forEach(p => {
      priceMap[p.id] = Number(p.price || 0);
    });

    orders.forEach(order => {
      monthlySales +=
        (priceMap[order.product_id] || 0) *
        Number(order.quantity || 1);
    });
  }

  const salesBox = document.getElementById("resellerMonthlySales");

  if (salesBox) {
    salesBox.textContent =
      "এই মাসের বিক্রি: ৳" + monthlySales.toFixed(2);
  }


  /* MONTHLY SALES TARGET */

  const { data: targetData, error: targetError } = await db
    .rpc("get_reseller_target");

  if (targetError) {
    console.error("Target error:", targetError);
  }

  let target = Number(targetData) || 100000;

  if (typeof targetData === "object" && targetData !== null) {
    target = Number(
      targetData.target_sales ||
      targetData.target ||
      100000
    );
  }

  const progress = target > 0
    ? Math.min((monthlySales / target) * 100, 100)
    : 0;

  const targetBox = document.getElementById("resellerTarget");

  if (targetBox) {
    targetBox.textContent =
      "মাসিক লক্ষ্য: ৳" + target.toFixed(2) +
      " | অগ্রগতি: " + progress.toFixed(1) + "%";
  }


  /* MONTHLY BONUS STATUS */

  const { data: bonusData, error: bonusError } = await db
    .rpc("get_reseller_bonus_status");

  if (bonusError) {
    console.error("Bonus status error:", bonusError);
  }

  const bonusBox = document.getElementById("resellerBonusStatus");

  if (bonusBox) {
    let earned = false;

    if (typeof bonusData === "boolean") {
      earned = bonusData;
    } else if (bonusData && typeof bonusData === "object") {
      earned =
        bonusData.bonus_eligible === true ||
        bonusData.eligible === true ||
        bonusData.earned === true;
    }

    bonusBox.textContent = earned
      ? "অভিনন্দন! তুমি এই মাসের বোনাস অর্জন করেছ।"
      : "এই মাসের বোনাস এখনো অর্জিত হয়নি।";
  }
}

/* =====================================
   PART 10: RESELLER REFERRAL LINK
===================================== */

async function copyReferralLink() {
  if (!currentResellerUser) {
    alert("আগে রিসেলার লগইন করো।");
    return;
  }

  const { data: profile, error } = await db
    .from("profiles")
    .select("referral_code")
    .eq("id", currentResellerUser.id)
    .single();

  if (error) {
    alert("রেফারেল কোড পাওয়া যায়নি।");
    console.error(error);
    return;
  }

  if (!profile || !profile.referral_code) {
    alert("তোমার রেফারেল কোড তৈরি করা হয়নি।");
    return;
  }

  const referralLink =
    window.location.origin +
    window.location.pathname +
    "?ref=" +
    encodeURIComponent(profile.referral_code);

  try {
    await navigator.clipboard.writeText(referralLink);
    alert("তোমার রেফারেল লিংক কপি হয়েছে!");
  } catch (err) {
    const temp = document.createElement("textarea");
    temp.value = referralLink;
    document.body.appendChild(temp);
    temp.select();

    const copied = document.execCommand("copy");
    temp.remove();

    if (copied) {
      alert("তোমার রেফারেল লিংক কপি হয়েছে!");
    } else {
      alert("লিংক কপি করা যায়নি: " + referralLink);
    }
  }
}
/* =====================================
   PART 11: RESELLER WITHDRAWAL
===================================== */

async function requestWithdrawal() {
  if (!currentResellerUser) {
    alert("আগে রিসেলার লগইন করো।");
    return;
  }

  const amount = Number(
    document.getElementById("withdrawAmount")?.value
  );

  const method =
    document.getElementById("withdrawMethod")?.value;

  const phone =
    document.getElementById("withdrawPhone")?.value.trim();

  if (!amount || amount <= 0) {
    alert("সঠিক টাকার পরিমাণ লিখো।");
    return;
  }

  if (!method || !["bKash", "Nagad"].includes(method)) {
    alert("বিকাশ অথবা নগদ নির্বাচন করো।");
    return;
  }

  if (!/^01[3-9]\d{8}$/.test(phone)) {
    alert("সঠিক ১১ সংখ্যার মোবাইল নম্বর লিখো।");
    return;
  }

  const { data, error } = await db.rpc("request_withdrawal", {
    p_amount: amount,
    p_payment_method: method,
    p_mobile_number: phone
  });

  if (error) {
    alert("আবেদন করা যায়নি: " + error.message);
    console.error(error);
    return;
  }

  alert("টাকা উত্তোলনের আবেদন সফলভাবে জমা হয়েছে।");

  document.getElementById("withdrawAmount").value = "";
  document.getElementById("withdrawPhone").value = "";

  await loadResellerWithdrawals();
}


/* LOAD RESELLER WITHDRAWAL HISTORY */

async function loadResellerWithdrawals() {
  const box = document.getElementById("resellerWithdrawals");

  if (!box || !currentResellerUser) return;

  box.textContent = "আবেদনের তালিকা লোড হচ্ছে...";

  const { data, error } = await db
    .from("withdrawal_requests")
    .select("*")
    .eq("reseller_id", currentResellerUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    box.textContent = "আবেদনের তালিকা লোড করা যায়নি।";
    console.error(error);
    return;
  }

  box.innerHTML = "";

  if (!data || data.length === 0) {
    box.textContent = "এখনো কোনো টাকা উত্তোলনের আবেদন নেই।";
    return;
  }

  data.forEach(item => {
    const card = document.createElement("div");

    card.style.border = "1px solid #ddd";
    card.style.borderRadius = "10px";
    card.style.padding = "12px";
    card.style.marginBottom = "10px";

    const amount = document.createElement("p");
    amount.textContent = "টাকার পরিমাণ: ৳" + item.amount;

    const method = document.createElement("p");
    method.textContent = "পেমেন্ট মাধ্যম: " + item.payment_method;

    const phone = document.createElement("p");
    phone.textContent = "মোবাইল নম্বর: " + item.mobile_number;

    const status = document.createElement("p");
    status.textContent = "অবস্থা: " + item.status;

    card.appendChild(amount);
    card.appendChild(method);
    card.appendChild(phone);
    card.appendChild(status);

    box.appendChild(card);
  });
}
/* =====================================
   PART 12: ADMIN WITHDRAWAL MANAGEMENT
===================================== */


/* LOAD ALL WITHDRAWAL REQUESTS */

async function loadAdminWithdrawals() {
  const box = document.getElementById("adminWithdrawals");

  if (!box) return;

  box.textContent = "আবেদন লোড হচ্ছে...";

  const { data, error } = await db
    .from("withdrawal_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    box.textContent = "আবেদন লোড করা যায়নি।";
    console.error(error);
    return;
  }

  box.innerHTML = "";

  if (!data || data.length === 0) {
    box.textContent = "কোনো টাকা উত্তোলনের আবেদন নেই।";
    return;
  }

  const resellerIds = [
    ...new Set(data.map(item => item.reseller_id).filter(Boolean))
  ];

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id,full_name")
    .in("id", resellerIds);

  if (profileError) {
    console.error(profileError);
  }

  const nameMap = {};

  (profiles || []).forEach(profile => {
    nameMap[profile.id] = profile.full_name || "রিসেলার";
  });

  data.forEach(item => {
    const card = document.createElement("div");

    card.style.border = "1px solid #ddd";
    card.style.borderRadius = "10px";
    card.style.padding = "12px";
    card.style.marginBottom = "12px";

    const reseller = document.createElement("p");
    reseller.textContent =
      "রিসেলার: " + (nameMap[item.reseller_id] || "অজানা");

    const amount = document.createElement("p");
    amount.textContent = "টাকার পরিমাণ: ৳" + item.amount;

    const method = document.createElement("p");
    method.textContent = "পেমেন্ট মাধ্যম: " + item.payment_method;

    const phone = document.createElement("p");
    phone.textContent = "মোবাইল নম্বর: " + item.mobile_number;

    const status = document.createElement("p");
    status.textContent = "অবস্থা: " + item.status;

    const date = document.createElement("p");
    date.textContent = item.created_at
      ? "আবেদনের তারিখ: " + new Date(item.created_at).toLocaleString("bn-BD")
      : "";

    card.appendChild(reseller);
    card.appendChild(amount);
    card.appendChild(method);
    card.appendChild(phone);
    card.appendChild(status);
    card.appendChild(date);

    if (item.status === "pending") {
      const paidBtn = document.createElement("button");
      paidBtn.textContent = "টাকা পাঠানো হয়েছে — Paid";
      paidBtn.style.marginRight = "8px";

      paidBtn.onclick = () => {
        const confirmed = confirm(
          "তুমি কি সত্যিই এই রিসেলারকে ৳" +
          item.amount +
          " পাঠিয়েছ?"
        );

        if (confirmed) {
          processWithdrawal(item.id, "paid");
        }
      };

      const rejectBtn = document.createElement("button");
      rejectBtn.textContent = "Reject";

      rejectBtn.onclick = () => {
        const confirmed = confirm(
          "তুমি কি এই আবেদনটি Reject করতে চাও?"
        );

        if (confirmed) {
          processWithdrawal(item.id, "rejected");
        }
      };

      card.appendChild(paidBtn);
      card.appendChild(rejectBtn);
    }

    box.appendChild(card);
  });
}


/* PROCESS WITHDRAWAL */

async function processWithdrawal(id, status) {
  if (!["paid", "rejected"].includes(status)) {
    alert("ভুল আবেদন অবস্থা।");
    return;
  }

  const { error } = await db.rpc("admin_process_withdrawal", {
    p_request_id: id,
    p_status: status
  });

  if (error) {
    alert("আবেদন আপডেট করা যায়নি: " + error.message);
    console.error(error);
    return;
  }

  alert(
    status === "paid"
      ? "আবেদন Paid হয়েছে।"
      : "আবেদন Reject হয়েছে।"
  );

  await loadAdminWithdrawals();
    }
/* =====================================
   PART 13: ADMIN BONUS SETTINGS
===================================== */


/* LOAD BONUS SETTINGS */

async function loadBonusSettings() {
  const targetInput = document.getElementById("bonusTarget");
  const amountInput = document.getElementById("bonusAmount");

  if (!targetInput || !amountInput) return;

  const { data, error } = await db
    .from("bonus_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Bonus settings error:", error);
    return;
  }

  if (data) {
    targetInput.value = data.target_sales || 100000;
    amountInput.value = data.bonus_amount || 0;
  }
}


/* SAVE BONUS SETTINGS */

async function saveBonusSettings() {
  const target = Number(
    document.getElementById("bonusTarget")?.value
  );

  const amount = Number(
    document.getElementById("bonusAmount")?.value
  );

  if (!target || target <= 0 || !amount || amount <= 0) {
    alert("সঠিক বিক্রির লক্ষ্য ও বোনাসের পরিমাণ লিখো।");
    return;
  }

  const { data: existing, error: readError } = await db
    .from("bonus_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (readError) {
    alert("বোনাস সেটিংস পড়া যায়নি।");
    console.error(readError);
    return;
  }

  let result;

  if (existing) {
    result = await db
      .from("bonus_settings")
      .update({
        target_sales: target,
        bonus_amount: amount
      })
      .eq("id", existing.id);
  } else {
    result = await db
      .from("bonus_settings")
      .insert([{
        target_sales: target,
        bonus_amount: amount
      }]);
  }

  if (result.error) {
    alert("সেটিংস সংরক্ষণ করা যায়নি: " + result.error.message);
    console.error(result.error);
    return;
  }

  alert("বোনাস সেটিংস সংরক্ষণ হয়েছে।");
}


/* LOAD ADMIN BONUS REPORT */

async function loadAdminBonusReport() {
  const box = document.getElementById("adminBonusReport");

  if (!box) return;

  box.textContent = "বোনাস রিপোর্ট লোড হচ্ছে...";

  const { data, error } = await db
    .from("reseller_monthly_bonus")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    box.textContent = "বোনাস রিপোর্ট লোড করা যায়নি।";
    console.error(error);
    return;
  }

  box.innerHTML = "";

  if (!data || data.length === 0) {
    box.textContent = "এখনো কোনো মাসিক বোনাসের তথ্য নেই।";
    return;
  }

  const resellerIds = [
    ...new Set(data.map(item => item.reseller_id).filter(Boolean))
  ];

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id,full_name")
    .in("id", resellerIds);

  if (profileError) {
    console.error(profileError);
  }

  const nameMap = {};

  (profiles || []).forEach(profile => {
    nameMap[profile.id] = profile.full_name || "রিসেলার";
  });

  data.forEach(item => {
    const card = document.createElement("div");

    card.style.border = "1px solid #ddd";
    card.style.borderRadius = "10px";
    card.style.padding = "12px";
    card.style.marginBottom = "10px";

    const name = document.createElement("p");
    name.textContent =
      "রিসেলার: " + (nameMap[item.reseller_id] || "অজানা");

    const amount = document.createElement("p");
    amount.textContent =
      "বোনাস: ৳" + (item.bonus_amount || 0);

    const status = document.createElement("p");
    status.textContent =
      "অবস্থা: " + (item.status || "তথ্য নেই");

    const date = document.createElement("p");
    date.textContent = item.created_at
      ? "তারিখ: " + new Date(item.created_at).toLocaleString("bn-BD")
      : "";

    card.appendChild(name);
    card.appendChild(amount);
    card.appendChild(status);
    card.appendChild(date);

    box.appendChild(card);
  });
  }

/* =====================================
   PART 14: ADMIN REFERRAL REPORT
===================================== */

async function loadAdminReferralReport() {
  const box = document.getElementById("adminReferralReport");

  if (!box) return;

  box.textContent = "রেফারেল রিপোর্ট লোড হচ্ছে...";

  /* VERIFY ADMIN */

  const {
    data: { user },
    error: authError
  } = await db.auth.getUser();

  if (authError || !user) {
    box.textContent = "Admin লগইন করা নেই।";
    return;
  }

  const { data: adminProfile, error: adminError } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminError || adminProfile?.role !== "admin") {
    box.textContent = "শুধু Admin এই রিপোর্ট দেখতে পারবেন।";
    return;
  }

  /* LOAD REFERRAL REWARDS */

  const { data, error } = await db
    .from("referral_rewards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    box.textContent = "রেফারেল রিপোর্ট লোড করা যায়নি।";
    console.error(error);
    return;
  }

  box.innerHTML = "";

  if (!data || data.length === 0) {
    box.textContent = "এখনো কোনো রেফারেল পুরস্কারের তথ্য নেই।";
    return;
  }

  /* GET RESELLER NAMES */

  const resellerIds = [
    ...new Set(
      data.flatMap(item => [
        item.referrer_id,
        item.referred_reseller_id
      ]).filter(Boolean)
    )
  ];

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id,full_name")
    .in("id", resellerIds);

  if (profileError) {
    console.error(profileError);
  }

  const nameMap = {};

  (profiles || []).forEach(profile => {
    nameMap[profile.id] = profile.full_name || "রিসেলার";
  });

  /* DISPLAY REPORT */

  let totalReward = 0;

  data.forEach(item => {
    const card = document.createElement("div");

    card.style.border = "1px solid #ddd";
    card.style.borderRadius = "10px";
    card.style.padding = "12px";
    card.style.marginBottom = "10px";

    const referrer = document.createElement("p");
    referrer.textContent =
      "যিনি রেফার করেছেন: " +
      (nameMap[item.referrer_id] || "অজানা");

    const referred = document.createElement("p");
    referred.textContent =
      "যিনি রেজিস্ট্রেশন করেছেন: " +
      (nameMap[item.referred_reseller_id] || "অজানা");

    const amount = document.createElement("p");
    amount.textContent =
      "রেফারেল পুরস্কার: ৳" + (item.amount || 0);

    const order = document.createElement("p");
    order.textContent =
      "অর্ডার ID: " + (item.order_id || "তথ্য নেই");

    const date = document.createElement("p");
    date.textContent = item.created_at
      ? "তারিখ: " + new Date(item.created_at).toLocaleString("bn-BD")
      : "";

    totalReward += Number(item.amount || 0);

    card.appendChild(referrer);
    card.appendChild(referred);
    card.appendChild(amount);
    card.appendChild(order);
    card.appendChild(date);

    box.appendChild(card);
  });

  const total = document.createElement("h3");
  total.textContent =
    "মোট রেফারেল পুরস্কার: ৳" + totalReward.toFixed(2);

  box.prepend(total);
}
/* =====================================
   PART 15: ADMIN PRODUCT LIST
===================================== */

async function loadProducts() {
  const box = document.getElementById("adminProducts");

  if (!box) return;

  box.textContent = "পণ্য লোড হচ্ছে...";

  const { data, error } = await db
    .from("products")
    .select("id,name,description,price,image_url,image_urls")
    .order("id", { ascending: false });

  if (error) {
    box.textContent = "পণ্য লোড করা যায়নি।";
    console.error(error);
    return;
  }

  box.innerHTML = "";

  if (!data || data.length === 0) {
    box.textContent = "এখনো কোনো পণ্য যোগ করা হয়নি।";
    return;
  }

  data.forEach(product => {
    const card = document.createElement("div");

    card.style.border = "1px solid #ddd";
    card.style.borderRadius = "10px";
    card.style.padding = "12px";
    card.style.marginBottom = "12px";

    /* PRODUCT IMAGE GALLERY */

    appendProductGallery(card, product);

    /* PRODUCT NAME */

    const name = document.createElement("h3");
    name.textContent = product.name;

    /* PRODUCT DESCRIPTION */

    const description = document.createElement("p");
    description.textContent = product.description || "";

    /* PRODUCT PRICE */

    const price = document.createElement("p");
    price.textContent =
      "পণ্যের দাম: ৳" + product.price;

    /* DELETE BUTTON */

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "পণ্য ডিলিট করুন";

    deleteBtn.style.background = "#dc3545";
    deleteBtn.style.color = "white";
    deleteBtn.style.border = "none";
    deleteBtn.style.padding = "9px 14px";
    deleteBtn.style.borderRadius = "6px";

    deleteBtn.onclick = () => {
      deleteProduct(product.id);
    };

    card.appendChild(name);
    card.appendChild(description);
    card.appendChild(price);
    card.appendChild(deleteBtn);

    box.appendChild(card);
  });
}
/* =====================================
   PART 16: SESSION & APP STARTUP
===================================== */


/* GET REFERRAL CODE FROM URL */

const urlParams = new URLSearchParams(window.location.search);

const referralCodeFromURL = urlParams.get("ref");

if (referralCodeFromURL) {
  const referralInput = document.getElementById("referralCode");

  if (referralInput) {
    referralInput.value = referralCodeFromURL;
  }

  localStorage.setItem("pendingReferralCode", referralCodeFromURL);
}


/* CHECK LOGIN SESSION */

async function checkSession() {
  const {
    data: { session },
    error
  } = await db.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    return;
  }

  if (!session) {
    show("loginPage");
    return;
  }

  await verifyAdmin(
    session.user,
    "loginMsg"
  );
}


/* AUTH STATE CHANGE */

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    currentResellerUser = null;
    show("loginPage");
  }
});


/* APP START */

document.addEventListener("DOMContentLoaded", async () => {
  await loadStoreProducts();
  await checkSession();
});



