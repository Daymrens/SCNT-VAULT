(function() {
  var auth = FB.auth;
  var db   = FB.db;

  var currentUser  = null;
  var currentPage  = 'dashboard';
  var productsCache  = [];
  var ordersCache    = [];
  var contactsCache  = [];

  document.addEventListener('DOMContentLoaded', function() {
    initAuth();
    initNavigation();
  });

  function initAuth() {
    auth.onAuthStateChanged(function(user) {
      if (user) { currentUser = user; showAdmin(); loadPage(currentPage); }
      else       { currentUser = null; showLogin(); }
    });
    document.getElementById('loginForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var err = document.getElementById('errorMessage');
      var btn = document.getElementById('loginBtn');
      btn.textContent = 'Signing in...';
      btn.disabled = true;
      err.style.color = '#6366f1'; err.textContent = 'Signing in...';
      auth.signInWithEmailAndPassword(
        document.getElementById('email').value,
        document.getElementById('password').value
      ).then(function() {
        err.textContent = '';
        btn.textContent = 'Sign In';
        btn.disabled = false;
      }).catch(function(ex) {
        btn.textContent = 'Sign In';
        btn.disabled = false;
        err.style.color = '#ef4444';
        err.textContent = ex.code === 'auth/invalid-credential' ? 'Invalid email or password'
          : ex.code === 'auth/too-many-requests' ? 'Too many attempts — try later'
          : ex.code === 'auth/user-not-found' ? 'No account found with this email'
          : ex.code === 'auth/wrong-password' ? 'Wrong password'
          : ex.message;
      });
    });
    document.getElementById('logoutBtn').addEventListener('click', function() {
      auth.signOut().catch(function(e) { console.error(e); });
    });
  }

  function showLogin() {
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('adminContainer').style.display = 'none';
  }
  function showAdmin() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('adminContainer').style.display = 'flex';
    document.getElementById('userEmail').textContent = currentUser.email;
  }

  function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(function(l) { l.classList.remove('active'); });
        link.classList.add('active');
        loadPage(link.dataset.page);
      });
    });
  }

  function loadPage(page) {
    currentPage = page;
    document.getElementById('pageTitle').textContent =
      page.charAt(0).toUpperCase() + page.slice(1).replace(/-/g, ' ');
    var area = document.getElementById('contentArea');
    var map = {
      dashboard: loadDashboard,
      products:  loadProducts,
      orders:    loadOrders,
      contacts:  loadContacts,
      customers: loadCustomers,
      analytics: loadAnalytics,
      settings:  loadSettings
    };
    (map[page] || function() { area.innerHTML = '<p>Page not found</p>'; })(area);
  }

  var fmt  = function(n) { return '₱' + (n||0).toLocaleString('en-PH'); };
  var fmtD = function(ts) {
    if (!ts) return '—';
    var d = ts && ts.toDate ? ts.toDate() : new Date(ts);
    return isNaN(d) ? '—' : d.toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' });
  };
  var fmtDT = function(ts) {
    if (!ts) return '—';
    var d = ts && ts.toDate ? ts.toDate() : new Date(ts);
    return isNaN(d) ? '—' : d.toLocaleString('en-PH', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  };
  var orderStatusColor = function(s) {
    return ({ pending:'warning', confirmed:'info', processing:'primary',
      shipped:'info', delivered:'success', cancelled:'danger' })[(s||'').toLowerCase()] || 'secondary';
  };

  async function getCol(col) {
    var snap = await db.collection(col).get();
    return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  }
  async function getColOrdered(col, field, dir) {
    dir = dir || 'desc';
    var snap = await db.collection(col).orderBy(field, dir).get();
    return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  }

  async function loadDashboard(container) {
    container.innerHTML =
      '<div class="stats-grid">' +
      [['statProducts','Total Products','#6366f1'],
       ['statOrders','Website Orders','#10b981'],
       ['statPending','Pending Orders','#f59e0b'],
       ['statContacts','New Messages','#ef4444']
      ].map(function(a) {
        return '<div class="stat-card" style="border-left:4px solid '+a[2]+'">' +
          '<h3>'+a[1]+'</h3>' +
          '<div class="stat-value" id="'+a[0]+'">...</div>' +
          '<div class="stat-change" id="'+a[0]+'Sub">Loading...</div></div>';
      }).join('') +
      '</div>' +
      '<div class="charts-grid">' +
        '<div class="chart-card"><h3>Orders — Last 30 Days</h3><canvas id="ordersChart"></canvas></div>' +
        '<div class="chart-card"><h3>Orders by Status</h3><canvas id="statusChart"></canvas></div>' +
      '</div>' +
      '<div class="data-table">' +
        '<div class="data-table-header"><h2>Recent Orders</h2>' +
          '<a href="#orders" class="btn btn-secondary" style="font-size:12px;padding:6px 14px" onclick="document.querySelector(\'[data-page=orders]\').click();return false;">View All</a>' +
        '</div>' +
        '<table><thead><tr>' +
          '<th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th>' +
        '</tr></thead>' +
        '<tbody id="recentOrdersBody"><tr><td colspan="6" class="empty-state">Loading...</td></tr></tbody></table>' +
      '</div>';

    try {
      var results = await Promise.all([
        getCol('products'),
        getColOrdered('orders', 'createdAt').catch(function() { return getCol('orders'); }),
        getCol('contacts')
      ]);
      var products = results[0], orders = results[1], contacts = results[2];
      productsCache = products;
      ordersCache   = orders;
      contactsCache = contacts;

      var pending = orders.filter(function(o) { return (o.status||'pending') === 'pending'; });
      var unread  = contacts.filter(function(c) { return c.status === 'unread'; });
      var thirtyDaysAgo = new Date(Date.now() - 86400000*30);
      var thisMonth = orders.filter(function(o) {
        var d = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt||0);
        return d >= thirtyDaysAgo;
      });

      document.getElementById('statProducts').textContent = products.length;
      document.getElementById('statOrders').textContent   = orders.length;
      document.getElementById('statPending').textContent  = pending.length;
      document.getElementById('statContacts').textContent = unread.length;
      document.getElementById('statProductsSub').textContent  = products.filter(function(p){return (p.Stock||0)>0;}).length + ' in stock';
      document.getElementById('statOrdersSub').textContent    = thisMonth.length + ' this month';
      document.getElementById('statPendingSub').textContent   = 'Needs attention';
      document.getElementById('statContactsSub').textContent  = contacts.length + ' total messages';

      buildOrdersChart(orders);
      buildStatusChart(orders);
      renderRecentOrders(orders.slice(0, 10));
    } catch(e) {
      container.innerHTML += '<div class="alert alert-danger">Error: ' + e.message + '</div>';
    }
  }

  function buildOrdersChart(orders) {
    var ctx = document.getElementById('ordersChart'); if (!ctx) return;
    var days = 30, labels = [], data = [];
    for (var i = days-1; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate()-i);
      labels.push(d.toLocaleDateString('en-PH',{month:'short',day:'numeric'}));
      data.push(orders.filter(function(o) {
        var od = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt||0);
        return od.toDateString() === d.toDateString();
      }).length);
    }
    new Chart(ctx, { type:'bar', data:{ labels: labels, datasets:[{
      label:'Orders', data: data, backgroundColor:'rgba(99,102,241,0.7)', borderRadius:4
    }]}, options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }});
  }

  function buildStatusChart(orders) {
    var ctx = document.getElementById('statusChart'); if (!ctx) return;
    var counts = {};
    orders.forEach(function(o) { var s = o.status||'pending'; counts[s]=(counts[s]||0)+1; });
    var colors = { pending:'#f59e0b', confirmed:'#6366f1', processing:'#8b5cf6',
      shipped:'#3b82f6', delivered:'#10b981', cancelled:'#ef4444' };
    new Chart(ctx, { type:'doughnut', data:{
      labels: Object.keys(counts).map(function(s){return s.charAt(0).toUpperCase()+s.slice(1);}),
      datasets:[{ data: Object.values(counts),
        backgroundColor: Object.keys(counts).map(function(s){return colors[s]||'#9ca3af';}), borderWidth:0 }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }});
  }

  function renderRecentOrders(orders) {
    var tbody = document.getElementById('recentOrdersBody');
    if (!orders.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No orders yet</td></tr>'; return; }
    tbody.innerHTML = orders.map(function(o) {
      var items = o.items || o.cartItems || [];
      return '<tr>' +
        '<td style="white-space:nowrap">' + fmtD(o.createdAt) + '</td>' +
        '<td style="font-weight:600">' + (o.fullName||o.name||'—') + '</td>' +
        '<td>' + items.length + ' item(s)</td>' +
        '<td style="font-weight:700;color:#10b981">' + fmt(o.total||o.grandTotal||0) + '</td>' +
        '<td><span class="badge badge-' + orderStatusColor(o.status) + '">' + (o.status||'pending') + '</span></td>' +
        '<td><button class="btn-sm btn-sm-view" onclick="window._viewOrder(\'' + o.id + '\')">View</button> ' +
            '<button class="btn-sm btn-sm-edit" onclick="window._updateStatus(\'' + o.id + '\',\'' + (o.status||'pending') + '\')">Status</button></td>' +
      '</tr>';
    }).join('');
  }

  async function loadProducts(container) {
    container.innerHTML =
      '<div class="toolbar">' +
        '<button class="btn btn-purple" id="addProductBtn">+ Add Product</button>' +
        '<input class="search-input" id="searchProducts" placeholder="Search by name or brand...">' +
        '<select class="filter-select" id="filterGender">' +
          '<option value="">All Genders</option><option>Men</option><option>Women</option><option>Unisex</option>' +
        '</select>' +
      '</div>' +
      '<div class="data-table">' +
        '<table><thead><tr>' +
          '<th>Product</th><th>Brand</th><th>Category</th><th>Gender</th>' +
          '<th>Price</th><th>Stock</th><th>Visible</th><th>Actions</th>' +
        '</tr></thead>' +
        '<tbody id="productsTbody"><tr><td colspan="8" class="empty-state">Loading...</td></tr></tbody></table>' +
      '</div>' +
      '<div class="modal" id="productModal" style="display:none">' +
        '<div class="modal-content">' +
          '<div class="modal-header">' +
            '<h2 id="productModalTitle">Add Product</h2>' +
            '<button class="modal-close" id="closeProductModal">X</button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<form id="productForm">' +
              '<input type="hidden" id="productId">' +
              '<div class="form-grid">' +
                '<div class="form-group full"><label>Product Name *</label><input id="productName" required></div>' +
                '<div class="form-group"><label>Brand</label><input id="productBrand"></div>' +
                '<div class="form-group"><label>Category</label><input id="productCategory" placeholder="e.g. Floral, Woody"></div>' +
                '<div class="form-group"><label>Gender</label>' +
                  '<select id="productGender"><option>Men</option><option>Women</option><option>Unisex</option></select></div>' +
                '<div class="form-group"><label>Size</label><input id="productSize" placeholder="e.g. 85ml"></div>' +
                '<div class="form-group"><label>Selling Price (₱)</label><input type="number" id="productPrice" step="0.01" value="220"></div>' +
                '<div class="form-group"><label>Stock</label><input type="number" id="productStock" value="0"></div>' +
                '<div class="form-group"><label>Visible on Store</label>' +
                  '<select id="productVisible"><option value="true">Yes</option><option value="false">No</option></select></div>' +
                '<div class="form-group full"><label>Image Path</label><input id="productImage" placeholder="images/PERFUME BOTTLES/NAME.png"></div>' +
                '<div class="form-group full"><label>Description</label>' +
                  '<textarea id="productDesc" rows="3" style="resize:vertical"></textarea></div>' +
              '</div>' +
            '</form>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<button class="btn btn-secondary" id="cancelProductBtn">Cancel</button>' +
            '<button class="btn btn-purple" id="saveProductBtn">Save Product</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    productsCache = await getCol('products').catch(function(){return [];});
    renderProducts(productsCache);

    document.getElementById('addProductBtn').onclick    = function() { openProductModal(); };
    document.getElementById('closeProductModal').onclick = closeProductModal;
    document.getElementById('cancelProductBtn').onclick  = closeProductModal;
    document.getElementById('saveProductBtn').onclick    = handleProductSave;
    document.getElementById('searchProducts').oninput   = filterProducts;
    document.getElementById('filterGender').onchange    = filterProducts;
  }

  function renderProducts(list) {
    var tbody = document.getElementById('productsTbody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No products found</td></tr>'; return; }
    tbody.innerHTML = list.map(function(p) {
      var low = (p.Stock||0) <= (p.LowStockThreshold||10);
      var vis = p.visible !== false;
      var genderClass = p.Gender==='Men'?'info':p.Gender==='Women'?'primary':'secondary';
      return '<tr>' +
        '<td style="font-weight:600">' + (p.Name||'') + '</td>' +
        '<td>' + (p.Brand||'—') + '</td><td>' + (p.Category||'—') + '</td>' +
        '<td><span class="badge badge-' + genderClass + '">' + (p.Gender||'—') + '</span></td>' +
        '<td style="font-weight:700;color:#10b981">' + fmt(p.SellingPrice||p.Price||220) + '</td>' +
        '<td><span class="badge badge-' + (low?'danger':'success') + '">' + (p.Stock||0) + '</span></td>' +
        '<td><span class="badge badge-' + (vis?'success':'secondary') + '">' + (vis?'Visible':'Hidden') + '</span></td>' +
        '<td>' +
          '<button class="btn-sm btn-sm-edit" onclick="window._editProduct(\'' + p.id + '\')">Edit</button> ' +
          '<button class="btn-sm btn-sm-delete" onclick="window._delProduct(\'' + p.id + '\',\'' + (p.Name||'').replace(/'/g,"\\'") + '\')">Delete</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function filterProducts() {
    var q = document.getElementById('searchProducts').value.toLowerCase();
    var g = document.getElementById('filterGender').value;
    renderProducts(productsCache.filter(function(p) {
      return (!q || (p.Name||'').toLowerCase().indexOf(q) >= 0 || (p.Brand||'').toLowerCase().indexOf(q) >= 0) &&
        (!g || p.Gender === g);
    }));
  }

  function openProductModal(id) {
    var p = id ? productsCache.find(function(x){return x.id===id;}) : null;
    document.getElementById('productModalTitle').textContent = p ? 'Edit Product' : 'Add Product';
    document.getElementById('productId').value       = (p&&p.id)||'';
    document.getElementById('productName').value     = (p&&p.Name)||'';
    document.getElementById('productBrand').value    = (p&&p.Brand)||'';
    document.getElementById('productCategory').value = (p&&p.Category)||'';
    document.getElementById('productGender').value   = (p&&p.Gender)||'Unisex';
    document.getElementById('productSize').value     = (p&&p.Size)||'85ml';
    document.getElementById('productPrice').value    = (p&&(p.SellingPrice||p.Price))||220;
    document.getElementById('productStock').value    = (p&&p.Stock)||0;
    document.getElementById('productVisible').value  = String(!p || p.visible !== false);
    document.getElementById('productImage').value    = (p&&p.ImagePath)||'';
    document.getElementById('productDesc').value     = (p&&p.Description)||'';
    document.getElementById('productModal').style.display = 'flex';
  }
  function closeProductModal() { document.getElementById('productModal').style.display = 'none'; }

  async function handleProductSave() {
    var id = document.getElementById('productId').value;
    var data = {
      Name:        document.getElementById('productName').value,
      Brand:       document.getElementById('productBrand').value,
      Category:    document.getElementById('productCategory').value,
      Gender:      document.getElementById('productGender').value,
      Size:        document.getElementById('productSize').value,
      SellingPrice: parseFloat(document.getElementById('productPrice').value)||220,
      Stock:       parseInt(document.getElementById('productStock').value)||0,
      visible:     document.getElementById('productVisible').value === 'true',
      ImagePath:   document.getElementById('productImage').value,
      Description: document.getElementById('productDesc').value,
    };
    try {
      if (id) {
        await db.collection('products').doc(id).update(Object.assign({}, data, { updatedAt: new Date().toISOString() }));
      } else {
        await db.collection('products').add(Object.assign({}, data, { createdAt: new Date().toISOString() }));
      }
      closeProductModal();
      productsCache = await getCol('products');
      renderProducts(productsCache);
    } catch(e) { alert('Error: '+e.message); }
  }

  window._editProduct = function(id) { openProductModal(id); };
  window._delProduct  = async function(id, name) {
    if (!confirm('Delete "' + name + '"?')) return;
    await db.collection('products').doc(id).delete().catch(function(e){alert(e.message);});
    productsCache = await getCol('products');
    renderProducts(productsCache);
  };

  async function loadOrders(container) {
    container.innerHTML =
      '<div class="toolbar">' +
        '<input class="search-input" id="ordSearch" placeholder="Search by name, email, phone...">' +
        '<select class="filter-select" id="ordStatus">' +
          '<option value="">All Statuses</option>' +
          '<option value="pending">Pending</option>' +
          '<option value="confirmed">Confirmed</option>' +
          '<option value="processing">Processing</option>' +
          '<option value="shipped">Shipped</option>' +
          '<option value="delivered">Delivered</option>' +
          '<option value="cancelled">Cancelled</option>' +
        '</select>' +
      '</div>' +
      '<div class="data-table">' +
        '<div class="data-table-header">' +
          '<h2>Website Orders</h2>' +
          '<span id="ordCount" style="font-size:12px;color:#9ca3af"></span>' +
        '</div>' +
        '<table><thead><tr>' +
          '<th>Date</th><th>Customer</th><th>Contact</th>' +
          '<th>Items</th><th>Total</th><th>Status</th><th>Actions</th>' +
        '</tr></thead>' +
        '<tbody id="ordTbody"><tr><td colspan="7" class="empty-state">Loading...</td></tr></tbody></table>' +
      '</div>' +
      '<div class="modal" id="orderModal" style="display:none">' +
        '<div class="modal-content" style="max-width:680px">' +
          '<div class="modal-header">' +
            '<h2 id="orderModalTitle">Order Detail</h2>' +
            '<button class="modal-close" onclick="document.getElementById(\'orderModal\').style.display=\'none\'">X</button>' +
          '</div>' +
          '<div class="modal-body" id="orderModalBody"></div>' +
          '<div class="modal-footer" id="orderModalFooter"></div>' +
        '</div>' +
      '</div>';

    ordersCache = await getColOrdered('orders','createdAt').catch(function(){return getCol('orders');}).catch(function(){return [];});

    var render = function() {
      var q = document.getElementById('ordSearch').value.toLowerCase();
      var s = document.getElementById('ordStatus').value;
      var list = ordersCache.filter(function(o) {
        if (s && (o.status||'pending') !== s) return false;
        if (q) {
          var hay = ((o.fullName||o.name||'') + ' ' + (o.email||'') + ' ' + (o.phone||'')).toLowerCase();
          if (hay.indexOf(q) < 0) return false;
        }
        return true;
      });
      document.getElementById('ordCount').textContent = list.length + ' order(s)';
      var tbody = document.getElementById('ordTbody');
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No orders found</td></tr>'; return; }
      tbody.innerHTML = list.map(function(o) {
        var items = o.items || o.cartItems || [];
        return '<tr>' +
          '<td style="white-space:nowrap">' + fmtDT(o.createdAt) + '</td>' +
          '<td style="font-weight:600">' + (o.fullName||o.name||'—') + '</td>' +
          '<td style="font-size:12px;color:#6b7280">' + (o.email||'') + '<br>' + (o.phone||'') + '</td>' +
          '<td>' + items.length + ' item(s)</td>' +
          '<td style="font-weight:700;color:#10b981">' + fmt(o.total||o.grandTotal||0) + '</td>' +
          '<td><span class="badge badge-' + orderStatusColor(o.status) + '">' + (o.status||'pending') + '</span></td>' +
          '<td style="white-space:nowrap">' +
            '<button class="btn-sm btn-sm-view" onclick="window._viewOrder(\'' + o.id + '\')">View</button> ' +
            '<button class="btn-sm btn-sm-edit" onclick="window._updateStatus(\'' + o.id + '\',\'' + (o.status||'pending') + '\')">Status</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    };

    render();
    document.getElementById('ordSearch').oninput  = render;
    document.getElementById('ordStatus').onchange = render;
  }

  window._viewOrder = function(id) {
    var o = ordersCache.find(function(x){return x.id===id;}); if (!o) return;
    var items = o.items || o.cartItems || [];
    var addr  = [o.address,o.city,o.province,o.zipCode].filter(Boolean).join(', ');
    document.getElementById('orderModalTitle').textContent = 'Order — ' + (o.fullName||o.name||'Customer');
    document.getElementById('orderModalBody').innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">' +
        '<div><div class="info-label">Customer</div><div style="font-weight:600">' + (o.fullName||o.name||'—') + '</div></div>' +
        '<div><div class="info-label">Date</div><div>' + fmtDT(o.createdAt) + '</div></div>' +
        '<div><div class="info-label">Email</div><div>' + (o.email||'—') + '</div></div>' +
        '<div><div class="info-label">Phone</div><div>' + (o.phone||'—') + '</div></div>' +
        '<div style="grid-column:1/-1"><div class="info-label">Shipping Address</div><div>' + (addr||'—') + '</div></div>' +
        (o.notes ? '<div style="grid-column:1/-1"><div class="info-label">Notes</div><div style="color:#6b7280">' + o.notes + '</div></div>' : '') +
      '</div>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">' +
        '<thead><tr style="background:#fafafa">' +
          '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase">Product</th>' +
          '<th style="padding:8px 12px;text-align:center;font-size:11px;color:#9ca3af;text-transform:uppercase">Qty</th>' +
          '<th style="padding:8px 12px;text-align:right;font-size:11px;color:#9ca3af;text-transform:uppercase">Price</th>' +
          '<th style="padding:8px 12px;text-align:right;font-size:11px;color:#9ca3af;text-transform:uppercase">Subtotal</th>' +
        '</tr></thead>' +
        '<tbody>' + items.map(function(item) {
          var price = item.price||item.Price||item.SellingPrice||0;
          var qty = item.quantity||item.Quantity||1;
          return '<tr>' +
            '<td style="padding:10px 12px">' + (item.name||item.Name||item.perfumeName||'—') + '</td>' +
            '<td style="padding:10px 12px;text-align:center">' + qty + '</td>' +
            '<td style="padding:10px 12px;text-align:right">' + fmt(price) + '</td>' +
            '<td style="padding:10px 12px;text-align:right;font-weight:700;color:#10b981">' + fmt(price*qty) + '</td>' +
          '</tr>';
        }).join('') + '</tbody>' +
        '<tfoot><tr style="border-top:2px solid #f3f4f6">' +
          '<td colspan="3" style="padding:12px;font-weight:700;text-align:right">Total</td>' +
          '<td style="padding:12px;font-weight:800;color:#10b981;text-align:right">' + fmt(o.total||o.grandTotal||0) + '</td>' +
        '</tr></tfoot>' +
      '</table>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:12px;color:#9ca3af;font-weight:700;text-transform:uppercase">Status:</span>' +
        '<span class="badge badge-' + orderStatusColor(o.status) + '">' + (o.status||'pending') + '</span>' +
      '</div>';
    document.getElementById('orderModalFooter').innerHTML =
      '<button class="btn btn-secondary" onclick="document.getElementById(\'orderModal\').style.display=\'none\'">Close</button>' +
      '<button class="btn btn-purple" onclick="window._updateStatus(\'' + o.id + '\',\'' + (o.status||'pending') + '\')">Update Status</button>';
    document.getElementById('orderModal').style.display = 'flex';
  };

  window._updateStatus = async function(id, current) {
    var statuses = ['pending','confirmed','processing','shipped','delivered','cancelled'];
    var next = prompt(
      'Update status for order.\nCurrent: ' + current + '\n\nOptions:\n' + statuses.map(function(s,i){return (i+1)+'. '+s;}).join('\n') + '\n\nEnter number or status name:',
      current
    );
    if (!next) return;
    var status = isNaN(next) ? next.toLowerCase() : statuses[parseInt(next)-1];
    if (statuses.indexOf(status) < 0) { alert('Invalid status'); return; }
    try {
      await db.collection('orders').doc(id).update({ status: status, updatedAt: new Date().toISOString() });
      ordersCache = ordersCache.map(function(o) { return o.id===id ? Object.assign({}, o, {status:status}) : o; });
      loadOrders(document.getElementById('contentArea'));
    } catch(e) { alert('Error: '+e.message); }
  };

  async function loadContacts(container) {
    container.innerHTML =
      '<div class="toolbar">' +
        '<input class="search-input" id="ctSearch" placeholder="Search by name or email...">' +
        '<select class="filter-select" id="ctStatus">' +
          '<option value="">All</option>' +
          '<option value="unread">Unread</option>' +
          '<option value="read">Read</option>' +
          '<option value="replied">Replied</option>' +
        '</select>' +
      '</div>' +
      '<div class="data-table">' +
        '<div class="data-table-header">' +
          '<h2>Contact Messages</h2>' +
          '<span id="ctCount" style="font-size:12px;color:#9ca3af"></span>' +
        '</div>' +
        '<table><thead><tr>' +
          '<th>Date</th><th>Name</th><th>Email</th><th>Subject</th><th>Status</th><th>Actions</th>' +
        '</tr></thead>' +
        '<tbody id="ctTbody"><tr><td colspan="6" class="empty-state">Loading...</td></tr></tbody></table>' +
      '</div>' +
      '<div class="modal" id="contactModal" style="display:none">' +
        '<div class="modal-content" style="max-width:600px">' +
          '<div class="modal-header">' +
            '<h2 id="ctModalTitle">Message</h2>' +
            '<button class="modal-close" onclick="document.getElementById(\'contactModal\').style.display=\'none\'">X</button>' +
          '</div>' +
          '<div class="modal-body" id="ctModalBody"></div>' +
          '<div class="modal-footer" id="ctModalFooter"></div>' +
        '</div>' +
      '</div>';

    contactsCache = await getColOrdered('contacts','createdAt').catch(function(){return getCol('contacts');}).catch(function(){return [];});

    var render = function() {
      var q = document.getElementById('ctSearch').value.toLowerCase();
      var s = document.getElementById('ctStatus').value;
      var list = contactsCache.filter(function(c) {
        return (!s || c.status===s) &&
          (!q || ((c.name||'') + ' ' + (c.email||'')).toLowerCase().indexOf(q) >= 0);
      });
      document.getElementById('ctCount').textContent = list.length + ' message(s)';
      var tbody = document.getElementById('ctTbody');
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No messages found</td></tr>'; return; }
      tbody.innerHTML = list.map(function(c) {
        var statusColor = ({unread:'danger',read:'secondary',replied:'success'})[c.status||'unread'] || 'secondary';
        var unreadStyle = c.status==='unread' ? 'font-weight:600' : '';
        return '<tr style="' + unreadStyle + '">' +
          '<td style="white-space:nowrap">' + fmtDT(c.createdAt) + '</td>' +
          '<td>' + (c.name||'—') + '</td>' +
          '<td style="color:#6b7280">' + (c.email||'—') + '</td>' +
          '<td>' + (c.subject||'(no subject)') + '</td>' +
          '<td><span class="badge badge-' + statusColor + '">' + (c.status||'unread') + '</span></td>' +
          '<td><button class="btn-sm btn-sm-view" onclick="window._viewContact(\'' + c.id + '\')">View</button></td>' +
        '</tr>';
      }).join('');
    };

    render();
    document.getElementById('ctSearch').oninput  = render;
    document.getElementById('ctStatus').onchange = render;
  }

  window._viewContact = async function(id) {
    var c = contactsCache.find(function(x){return x.id===id;}); if (!c) return;
    document.getElementById('ctModalTitle').textContent = c.subject||'Message';
    var statusMap = {unread:'danger',read:'secondary',replied:'success'};
    document.getElementById('ctModalBody').innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">' +
        '<div><div class="info-label">From</div><div style="font-weight:600">' + (c.name||'—') + '</div></div>' +
        '<div><div class="info-label">Date</div><div>' + fmtDT(c.createdAt) + '</div></div>' +
        '<div><div class="info-label">Email</div><div>' + (c.email||'—') + '</div></div>' +
        '<div><div class="info-label">Status</div>' +
          '<span class="badge badge-' + (statusMap[c.status||'unread']||'secondary') + '">' + (c.status||'unread') + '</span>' +
        '</div>' +
      '</div>' +
      '<div style="background:#f9fafb;border-radius:10px;padding:16px;font-size:14px;line-height:1.6;color:#374151;white-space:pre-wrap">' + (c.message||'(no message)') + '</div>';
    document.getElementById('ctModalFooter').innerHTML =
      '<button class="btn btn-secondary" onclick="document.getElementById(\'contactModal\').style.display=\'none\'">Close</button>' +
      '<button class="btn btn-secondary" onclick="window._markContact(\'' + id + '\',\'read\')">Mark Read</button>' +
      '<button class="btn btn-purple" onclick="window._markContact(\'' + id + '\',\'replied\')">Mark Replied</button>';
    document.getElementById('contactModal').style.display = 'flex';
    if (c.status === 'unread') {
      await db.collection('contacts').doc(id).update({ status:'read' }).catch(function(){});
      contactsCache = contactsCache.map(function(x) { return x.id===id ? Object.assign({}, x, {status:'read'}) : x; });
    }
  };

  window._markContact = async function(id, status) {
    await db.collection('contacts').doc(id).update({ status: status }).catch(function(e){alert(e.message);});
    contactsCache = contactsCache.map(function(x) { return x.id===id ? Object.assign({}, x, {status:status}) : x; });
    document.getElementById('contactModal').style.display = 'none';
    loadContacts(document.getElementById('contentArea'));
  };

  async function loadCustomers(container) {
    container.innerHTML =
      '<div class="toolbar">' +
        '<input class="search-input" id="custSearch" placeholder="Search by name or email...">' +
      '</div>' +
      '<div class="data-table">' +
        '<div class="data-table-header">' +
          '<h2>Website Customers</h2>' +
          '<span id="custCount" style="font-size:12px;color:#9ca3af"></span>' +
        '</div>' +
        '<table><thead><tr>' +
          '<th>Name</th><th>Email</th><th>Phone</th>' +
          '<th>Orders</th><th>Total Spent</th><th>Last Order</th>' +
        '</tr></thead>' +
        '<tbody id="custTbody"><tr><td colspan="6" class="empty-state">Loading...</td></tr></tbody></table>' +
      '</div>';

    var orders = ordersCache.length ? ordersCache
      : await getColOrdered('orders','createdAt').catch(function(){return getCol('orders');}).catch(function(){return [];});

    var custMap = {};
    orders.forEach(function(o) {
      var email = (o.email||'').toLowerCase() || o.id;
      if (!custMap[email]) custMap[email] = { name: o.fullName||o.name||'—', email: o.email||'—', phone: o.phone||'—', orders:0, spent:0, lastOrder:null };
      custMap[email].orders++;
      custMap[email].spent += o.total||o.grandTotal||0;
      var d = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt||0);
      if (!custMap[email].lastOrder || d > custMap[email].lastOrder) custMap[email].lastOrder = d;
    });

    var customers = Object.values(custMap).sort(function(a,b){return b.orders-a.orders;});

    var render = function() {
      var q = document.getElementById('custSearch').value.toLowerCase();
      var list = customers.filter(function(c) {
        return !q || c.name.toLowerCase().indexOf(q) >= 0 || c.email.toLowerCase().indexOf(q) >= 0;
      });
      document.getElementById('custCount').textContent = list.length + ' customer(s)';
      var tbody = document.getElementById('custTbody');
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No customers found</td></tr>'; return; }
      tbody.innerHTML = list.map(function(c) {
        return '<tr>' +
          '<td style="font-weight:600">' + c.name + '</td>' +
          '<td style="color:#6b7280">' + c.email + '</td>' +
          '<td style="color:#6b7280">' + c.phone + '</td>' +
          '<td style="text-align:center"><span class="badge badge-info">' + c.orders + '</span></td>' +
          '<td style="font-weight:700;color:#10b981">' + fmt(c.spent) + '</td>' +
          '<td style="color:#9ca3af;font-size:12px">' + (c.lastOrder ? fmtD(c.lastOrder) : '—') + '</td>' +
        '</tr>';
      }).join('');
    };

    render();
    document.getElementById('custSearch').oninput = render;
  }

  async function loadAnalytics(container) {
    container.innerHTML =
      '<div class="charts-grid" style="margin-bottom:24px">' +
        '<div class="chart-card"><h3>Orders per Month</h3><canvas id="monthlyChart" style="max-height:260px"></canvas></div>' +
        '<div class="chart-card"><h3>Top Ordered Products</h3><canvas id="topProdChart" style="max-height:260px"></canvas></div>' +
      '</div>' +
      '<div class="charts-grid">' +
        '<div class="chart-card"><h3>Order Status Breakdown</h3><canvas id="statusPieChart" style="max-height:260px"></canvas></div>' +
        '<div class="chart-card"><h3>Revenue by Month (₱)</h3><canvas id="revenueChart" style="max-height:260px"></canvas></div>' +
      '</div>';

    var orders = ordersCache.length ? ordersCache
      : await getColOrdered('orders','createdAt').catch(function(){return getCol('orders');}).catch(function(){return [];});

    var monthlyOrders = {}, monthlyRevenue = {};
    orders.forEach(function(o) {
      var d = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt||0);
      if (isNaN(d)) return;
      var key = d.toLocaleDateString('en-PH',{year:'numeric',month:'short'});
      monthlyOrders[key]  = (monthlyOrders[key]||0) + 1;
      monthlyRevenue[key] = (monthlyRevenue[key]||0) + (o.total||o.grandTotal||0);
    });
    var mKeys = Object.keys(monthlyOrders).slice(-6);

    new Chart(document.getElementById('monthlyChart'), {
      type:'bar', data:{ labels:mKeys, datasets:[{
        label:'Orders', data:mKeys.map(function(k){return monthlyOrders[k];}),
        backgroundColor:'rgba(99,102,241,0.7)', borderRadius:6
      }]}, options:{ responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
    });

    new Chart(document.getElementById('revenueChart'), {
      type:'line', data:{ labels:mKeys, datasets:[{
        label:'Revenue', data:mKeys.map(function(k){return monthlyRevenue[k];}),
        borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.08)', tension:.4, fill:true, pointRadius:3
      }]}, options:{ responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });

    var prodCount = {};
    orders.forEach(function(o) { (o.items||o.cartItems||[]).forEach(function(item) {
      var name = item.name||item.Name||item.perfumeName||'Unknown';
      prodCount[name] = (prodCount[name]||0) + (item.quantity||item.Quantity||1);
    }); });
    var top = Object.entries(prodCount).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
    new Chart(document.getElementById('topProdChart'), {
      type:'bar', data:{ labels:top.map(function(t){return t[0].substring(0,18);}), datasets:[{
        label:'Qty Ordered', data:top.map(function(t){return t[1];}),
        backgroundColor:'rgba(139,92,246,0.7)', borderRadius:6
      }]}, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}} }
    });

    var statusCount = {};
    orders.forEach(function(o) { var s=o.status||'pending'; statusCount[s]=(statusCount[s]||0)+1; });
    var colors = {pending:'#f59e0b',confirmed:'#6366f1',processing:'#8b5cf6',shipped:'#3b82f6',delivered:'#10b981',cancelled:'#ef4444'};
    new Chart(document.getElementById('statusPieChart'), {
      type:'doughnut', data:{
        labels:Object.keys(statusCount).map(function(s){return s.charAt(0).toUpperCase()+s.slice(1);}),
        datasets:[{ data:Object.values(statusCount),
          backgroundColor:Object.keys(statusCount).map(function(s){return colors[s]||'#9ca3af';}), borderWidth:0 }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }
    });
  }

  async function loadSettings(container) {
    container.innerHTML =
      '<div style="max-width:560px">' +
        '<div class="data-table" style="margin-bottom:20px">' +
          '<div class="data-table-header"><h2>Store Settings</h2></div>' +
          '<div style="padding:24px;display:flex;flex-direction:column;gap:18px">' +
            '<div class="form-group">' +
              '<label>Store Price (₱) — Default for new products</label>' +
              '<input type="number" id="settPrice" value="220" step="0.01" style="max-width:140px;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none">' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Low Stock Alert Threshold</label>' +
              '<input type="number" id="settThreshold" value="10" style="max-width:140px;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none">' +
              '<span style="font-size:12px;color:#9ca3af;margin-top:4px">Products below this qty will show as low stock</span>' +
            '</div>' +
            '<div>' +
              '<button class="btn btn-purple" id="applyThresholdBtn">Apply Threshold to All Products</button>' +
              '<span id="settMsg" style="margin-left:12px;font-size:13px;color:#10b981"></span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="data-table">' +
          '<div class="data-table-header"><h2>System Info</h2></div>' +
          '<div style="padding:20px;display:flex;flex-direction:column;gap:10px;font-size:13px;color:#374151">' +
            '<div style="display:flex;justify-content:space-between">' +
              '<span style="color:#9ca3af">Firebase Project</span><span style="font-weight:600">scnt-vault</span>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between">' +
              '<span style="color:#9ca3af">Store URL</span>' +
              '<a href="https://scnt-vault.web.app" target="_blank" style="color:#6366f1;font-weight:600">scnt-vault.web.app</a>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between">' +
              '<span style="color:#9ca3af">Logged in as</span><span style="font-weight:600">' + (currentUser?currentUser.email:'—') + '</span>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between">' +
              '<span style="color:#9ca3af">Currency</span><span style="font-weight:600">Philippine Peso (₱)</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('applyThresholdBtn').onclick = async function() {
      var thresh = parseInt(document.getElementById('settThreshold').value)||10;
      var msg = document.getElementById('settMsg');
      msg.textContent = 'Saving...'; msg.style.color = '#6366f1';
      try {
        var products = await getCol('products');
        var batch = db.batch();
        products.forEach(function(p) {
          batch.update(db.collection('products').doc(p.id), { LowStockThreshold: thresh });
        });
        await batch.commit();
        msg.textContent = 'Applied to ' + products.length + ' products'; msg.style.color = '#10b981';
        setTimeout(function(){msg.textContent='';}, 3000);
      } catch(e) { msg.textContent = 'Error: '+e.message; msg.style.color = '#ef4444'; }
    };
  }
})();
