const api = {
  async load(path) {
    try {
      const r = await fetch(path, { cache: 'no-store' });
      if (!r.ok) throw new Error(`فشل تحميل ${path}: ${r.status}`);
      return await r.json();
    } catch (e) {
      console.error(`خطأ في تحميل ${path}:`, e);
      throw e;
    }
  }
};

const CART_KEY = 'bb2-cart';
const FAV_KEY = 'bb2-favorites';
const store = {
  cart: JSON.parse(localStorage.getItem(CART_KEY) || '[]'),
  favorites: JSON.parse(localStorage.getItem(FAV_KEY) || '[]'),
  saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(this.cart)); },
  saveFavorites() { localStorage.setItem(FAV_KEY, JSON.stringify(this.favorites)); },
  addToCart(item) {
    this.cart.push(item);
    this.saveCart();
  },
  removeFromCart(i) {
    this.cart.splice(i, 1);
    this.saveCart();
  },
  updateQty(i, qty) {
    this.cart[i].qty = qty;
    this.saveCart();
  },
  clearCart() {
    this.cart = [];
    this.saveCart();
  },
  toggleFavorite(id) {
    const index = this.favorites.indexOf(id);
    if (index > -1) {
      this.favorites.splice(index, 1);
    } else {
      this.favorites.push(id);
    }
    this.saveFavorites();
  },
  isFavorite(id) {
    return this.favorites.includes(id);
  }
};

function lineTotal(it) {
  const addonsTotal = (it.addons || []).reduce((s, a) => s + a.price, 0);
  const base = it.unitPrice;
  const combo = it.combo ? it.combo.extra : 0;
  return (base + addonsTotal + combo) * it.qty;
}

function cartTotal(cart, applyDiscount = false) {
  const total = cart.reduce((s, it) => s + lineTotal(it), 0);
  if (applyDiscount) {
    const discount = total * 0.05; // 5% discount
    return {
      original: total,
      discount: discount,
      final: total - discount
    };
  }
  return total;
}

const egp = n => `${n.toLocaleString('ar-EG')} ج`;
const encode = str => encodeURIComponent(str);

function showToast(msg) {
  const toast = document.querySelector('#toast');
  if (toast) {
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 2000);
  }
}

function updateStickyCart() {
  const stickyCart = document.querySelector('#sticky-cart');
  if (stickyCart) {
    const count = store.cart.length;
    const totalInfo = cartTotal(store.cart, true);
    document.querySelector('#cart-count').textContent = `${count} عناصر`;
    document.querySelector('#cart-total').textContent = egp(totalInfo.final);
    stickyCart.style.display = count > 0 ? 'flex' : 'none';
  }
}

function createProductCard(item) {
  const card = document.createElement('div');
  card.classList.add('card', 'product');
  card.dataset.id = item.id;

  card.innerHTML = `
    <div class="flex">
      <img src="${item.image || 'https://via.placeholder.com/120'}" alt="${item.name}" width="120" height="120" loading="lazy">
      <div class="ml">
        <h3>${item.name}</h3>
        <p class="muted">${item.desc}</p>
        <div class="price">سينجل ${egp(item.price.single)} — دابل ${egp(item.price.double || item.price.single)}</div>
      </div>
    </div>
    <div class="flex actions">
      <button class="fav-btn ${store.isFavorite(item.id) ? 'favorited' : ''}" data-id="${item.id}">❤️</button>
      <button class="add-cart-btn" data-id="${item.id}">أضف للسلة</button>
    </div>
  `;

  card.addEventListener('click', e => {
    if (!e.target.classList.contains('fav-btn') && !e.target.classList.contains('add-cart-btn')) {
      window.location.href = `product.html?id=${item.id}`;
    }
  });
  return card;
}

async function loadFooterData() {
  try {
    const settings = await api.load('settings.json');
    const addressEl = document.querySelector('#footer-address');
    const hoursEl = document.querySelector('#footer-hours');
    if (addressEl) addressEl.textContent = settings.address;
    if (hoursEl) hoursEl.textContent = settings.hours || '';
  } catch (e) {
    console.error('خطأ في تحميل بيانات الفوتر:', e);
  }
}

async function loadLogo() {
  try {
    const settings = await api.load('settings.json');
    const logoImgs = document.querySelectorAll('#logo-img');
    logoImgs.forEach(img => img.src = settings.logo || 'https://via.placeholder.com/100');
  } catch (e) {
    console.error('خطأ في تحميل اللوجو:', e);
  }
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('fav-btn')) {
    const id = parseInt(e.target.dataset.id);
    store.toggleFavorite(id);
    e.target.classList.toggle('favorited');
    showToast(store.isFavorite(id) ? 'أضيف للمفضلة' : 'أزيل من المفضلة');
    if (document.querySelector('#favorites-grid')) {
      loadFavorites();
    }
  }
  if (e.target.classList.contains('add-cart-btn')) {
    const id = parseInt(e.target.dataset.id);
    window.location.href = `product.html?id=${id}`;
  }
  if (e.target.classList.contains('remove-fav-btn')) {
    const id = parseInt(e.target.dataset.id);
    store.toggleFavorite(id);
    showToast('أزيل من المفضلة');
    loadFavorites();
  }
  if (e.target.classList.contains('filter-btn')) {
    const category = e.target.dataset.category;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    loadMenu(category);
  }
});

async function loadFavorites() {
  try {
    const items = await api.load('items.json');
    const grid = document.querySelector('#favorites-grid');
    const noFavorites = document.querySelector('#no-favorites');
    if (grid) {
      grid.innerHTML = '';
      const favoriteItems = items.filter(item => store.isFavorite(item.id));
      if (favoriteItems.length === 0) {
        noFavorites.style.display = 'block';
        grid.style.display = 'none';
      } else {
        noFavorites.style.display = 'none';
        grid.style.display = 'grid';
        favoriteItems.forEach(item => {
          const card = createProductCard(item);
          card.querySelector('.add-cart-btn').outerHTML = `<button class="btn btn-danger remove-fav-btn" data-id="${item.id}">إزالة</button>`;
          grid.appendChild(card);
        });
      }
    }
  } catch (e) {
    console.error('خطأ في تحميل المفضلة:', e);
  }
}

async function loadMenu(category = 'all') {
  try {
    const items = await api.load('items.json');
    const categories = await api.load('categories.json');
    const grid = document.querySelector('#menu-grid');
    const filters = document.querySelector('#filters');
    if (grid && filters) {
      grid.innerHTML = '';
      if (!filters.innerHTML) {
        filters.innerHTML = `<button class="btn filter-btn ${category === 'all' ? 'active' : ''}" data-category="all">الكل</button>`;
        categories.forEach(cat => {
          filters.innerHTML += `<button class="btn filter-btn ${category === cat.id ? 'active' : ''}" data-category="${cat.id}">${cat.title}</button>`;
        });
      }
      const filteredItems = category === 'all' ? items : items.filter(item => item.category === category);
      filteredItems.forEach(item => grid.appendChild(createProductCard(item)));
    }
  } catch (e) {
    console.error('خطأ في تحميل المنيو:', e);
  }
}

async function loadFeatured() {
  try {
    const items = await api.load('items.json');
    const grid = document.querySelector('#featured-grid');
    if (grid) {
      grid.innerHTML = '';
      const featuredItems = items.filter(item => item.featured).slice(0, 6);
      featuredItems.forEach(item => grid.appendChild(createProductCard(item)));
    }
  } catch (e) {
    console.error('خطأ في تحميل المنتجات المميزة:', e);
  }
}

async function loadBanner() {
  try {
    const settings = await api.load('settings.json');
    const slider = document.querySelector('.banner-slider');
    if (slider && settings.banners.length > 0) {
      let current = 0;
      const images = settings.banners;
      slider.innerHTML = images.map((src, i) => `<img src="${src}" class="${i === 0 ? 'active' : ''}">`).join('');
      const cycleImages = () => {
        const imgs = slider.querySelectorAll('img');
        imgs[current].classList.remove('active');
        current = (current + 1) % images.length;
        imgs[current].classList.add('active');
      };
      setInterval(cycleImages, 5000);
    }
  } catch (e) {
    console.error('خطأ في تحميل البانر:', e);
  }
}

if (document.querySelector('#menu-grid')) {
  (async () => {
    updateStickyCart();
    window.addEventListener('storage', updateStickyCart);
    await loadLogo();
    await loadFooterData();
    await loadMenu();
  })();
} else if (document.querySelector('#featured-grid')) {
  (async () => {
    updateStickyCart();
    window.addEventListener('storage', updateStickyCart);
    await loadLogo();
    await loadFooterData();
    await loadFeatured();
    await loadBanner();
  })();
} else if (document.querySelector('#product-details')) {
  (async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = parseInt(params.get('id'));
      console.log('Product ID:', id); // Debugging
      if (!id) {
        document.querySelector('#product-details').innerHTML = '<p>معرف المنتج غير موجود</p>';
        return;
      }

      const items = await api.load('items.json');
      console.log('Items loaded:', items); // Debugging
      const addons = await api.load('addons.json');
      console.log('Addons loaded:', addons); // Debugging
      const item = items.find(i => i.id === id);
      console.log('Selected item:', item); // Debugging
      const combos = [{ id: 'combo', name: 'كومبو', extra: 30 }];
      const details = document.querySelector('#product-details');
      const sizeSelect = document.querySelector('#size');
      const comboCheck = document.querySelector('#combo');
      const qty = document.querySelector('#qty');
      const addonsList = document.querySelector('#addons');
      const totalPrice = document.querySelector('#total-price');
      const addBtn = document.querySelector('#add-btn');
      const favBtn = document.querySelector('#fav-btn');

      if (!item) {
        details.innerHTML = '<p>المنتج غير موجود</p>';
        return;
      }

      details.innerHTML = `
        <img src="${item.image || 'https://via.placeholder.com/200'}" alt="${item.name}" width="200">
        <h2>${item.name}</h2>
        <p class="muted">${item.desc}</p>
      `;
      favBtn.classList.toggle('favorited', store.isFavorite(id));
      addonsList.innerHTML = addons.map(a => `
        <label><input type="checkbox" data-id="${a.id}" data-price="${a.price}"> ${a.name} (${egp(a.price)})</label>
      `).join('');

      // Disable double option if not available
      if (!item.price.double) {
        sizeSelect.querySelector('option[value="double"]').disabled = true;
      }

      function updatePrice() {
        const size = sizeSelect.value;
        const basePrice = item.price[size] || item.price.single;
        const comboExtra = comboCheck.checked ? combos[0].extra : 0;
        const addonsTotal = Array.from(addonsList.querySelectorAll('input:checked')).reduce((s, inp) => s + parseInt(inp.dataset.price), 0);
        const total = (basePrice + comboExtra + addonsTotal) * parseInt(qty.value || 1);
        totalPrice.textContent = `السعر الإجمالي: ${egp(total)}`;
      }

      sizeSelect.addEventListener('change', updatePrice);
      comboCheck.addEventListener('change', updatePrice);
      qty.addEventListener('input', updatePrice);
      addonsList.addEventListener('change', updatePrice);
      updatePrice();

      addBtn.addEventListener('click', () => {
        const size = sizeSelect.value;
        const selectedAddons = Array.from(addonsList.querySelectorAll('input:checked')).map(inp => ({
          id: inp.dataset.id,
          name: addons.find(a => a.id === inp.dataset.id).name,
          price: parseInt(inp.dataset.price)
        }));
        const combo = comboCheck.checked ? combos[0] : null;
        const newItem = {
          id: item.id,
          name: item.name,
          size: size === 'single' ? 'سينجل' : 'دابل',
          unitPrice: item.price[size] || item.price.single,
          qty: parseInt(qty.value || 1),
          addons: selectedAddons,
          combo
        };
        store.addToCart(newItem);
        showToast('تمت الإضافة إلى السلة ✓');
        updateStickyCart();
      });

      favBtn.addEventListener('click', () => {
        store.toggleFavorite(id);
        favBtn.classList.toggle('favorited');
        showToast(store.isFavorite(id) ? 'أضيف للمفضلة' : 'أزيل من المفضلة');
      });

      await loadLogo();
      await loadFooterData();
      updateStickyCart();
    } catch (e) {
      console.error('خطأ في تحميل تفاصيل المنتج:', e);
      document.querySelector('#product-details').innerHTML = '<p>حدث خطأ أثناء تحميل المنتج. حاول مرة أخرى لاحقًا.</p>';
    }
  })();
} else if (document.querySelector('#cart-list')) {
  (async () => {
    try {
      const settings = await api.load('settings.json');
      const phone = settings.whatsapp;

      const name = document.querySelector('#name');
      const mobile = document.querySelector('#mobile');
      const address = document.querySelector('#address');
      const notes = document.querySelector('#notes');
      const payment = document.querySelector('#payment');
      const cartList = document.querySelector('#cart-list');
      const grandTotalEl = document.querySelector('#grand-total');

      function updateCart() {
        cartList.innerHTML = '';
        store.cart.forEach((it, i) => {
          const div = document.createElement('div');
          div.classList.add('card');
          div.innerHTML = `
            <h3>${it.name} - ${it.size}</h3>
            <p>إضافات: ${(it.addons || []).map(a => a.name).join(', ') || 'بدون'}</p>
            <p>كومبو: ${it.combo ? 'نعم' : 'لا'}</p>
            <label>الكمية: <input type="number" class="qty-input" data-i="${i}" value="${it.qty}" min="1"></label>
            <p>السعر: ${egp(lineTotal(it))}</p>
            <button class="btn btn-danger remove-btn" data-i="${i}">إزالة</button>
          `;
          cartList.appendChild(div);
        });

        const totalInfo = cartTotal(store.cart, true);
        grandTotalEl.innerHTML = `
          <p>الإجمالي: ${egp(totalInfo.original)}</p>
          <p>الخصم (5%): ${egp(totalInfo.discount)}</p>
          <p>المجموع النهائي بدون توصيل: ${egp(totalInfo.final)}</p>
        `;
      }

      cartList.addEventListener('click', e => {
        if (e.target.classList.contains('remove-btn')) {
          store.removeFromCart(e.target.dataset.i);
          updateCart();
          updateStickyCart();
        }
      });

      cartList.addEventListener('input', e => {
        if (e.target.classList.contains('qty-input')) {
          const i = e.target.dataset.i;
          const qty = parseInt(e.target.value);
          if (qty >= 1) {
            store.updateQty(i, qty);
            updateCart();
            updateStickyCart();
          }
        }
      });

      document.querySelector('#whatsapp-order').addEventListener('click', () => {
        const totalInfo = cartTotal(store.cart, true);
        const lines = [];
        lines.push(`*طلب جديد - ${settings.brand}*`);
        store.cart.forEach((it, idx) => {
          const addons = (it.addons || []).map(a => a.name).join('، ') || 'بدون إضافات';
          const combo = it.combo ? ` + كومبو` : '';
          lines.push(`${idx + 1}) ${it.name} - ${it.size}${combo} عدد (${it.qty})`);
          lines.push(`   إضافات: ${addons}`);
          lines.push(`   السعر: ${egp(lineTotal(it))}`);
        });
        lines.push(`—`);
        lines.push(`*الإجمالي:*: ${egp(totalInfo.original)}`);
        lines.push(`*الخصم (5%)*: ${egp(totalInfo.discount)}`);
        lines.push(`*المجموع النهائي بدون توصيل*: ${egp(totalInfo.final)}`);
        lines.push(`—`);
        lines.push(`الاسم: ${name.value}`);
        lines.push(`موبايل: ${mobile.value}`);
        lines.push(`العنوان: ${address.value}`);
        if (notes.value) lines.push(`ملاحظات: ${notes.value}`);
        lines.push(`*طريقة الدفع*: ${payment.value}`);
        const msg = encode(lines.join('\n'));
        const url = `https://wa.me/${phone}?text=${msg}`;
        window.location.href = url;
        store.clearCart();
        updateStickyCart();
      });

      updateCart();
      await loadLogo();
      await loadFooterData();
      updateStickyCart();
    } catch (e) {
      console.error('خطأ في تحميل صفحة السلة:', e);
    }
  })();
} else if (document.querySelector('#favorites-grid')) {
  (async () => {
    updateStickyCart();
    window.addEventListener('storage', updateStickyCart);
    await loadLogo();
    await loadFooterData();
    await loadFavorites();
  })();
}
