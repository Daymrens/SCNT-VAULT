import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useSettings } from '../contexts/SettingsContext';
import { FaTrash, FaShoppingCart, FaSearch, FaTimes, FaCheck, FaCheckCircle, FaFilePdf, FaFlask, FaPrint, FaBarcode } from 'react-icons/fa';
import { Timestamp, doc, updateDoc, increment } from 'firebase/firestore';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import BarcodeScanner from '../components/shared/BarcodeScanner';
import Modal, { CancelButton, PrimaryButton } from '../components/shared/Modal';
import { useToast } from '../components/shared/Toast';
import { generateInvoice } from '../utils/invoice';
import { nextInvoiceNumber } from '../utils/numbers';
import { db } from '../firebase/firebase';

const lbl = { fontSize:12, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' };
const inp = { padding:'9px 12px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13,
  outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit', transition:'border-color 0.2s',
  background:'var(--bg-input)', color:'var(--text-primary)' };

export default function POS() {
  const { products, customers, resellers, addSale, adjustStock, updateOrder, getOrder, loading } = useData();
  const { settings } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedReseller, setSelectedReseller] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [shippingFee, setShippingFee] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerType, setCustomerType] = useState('retail');
  const [clearConfirm, setClearConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successSale, setSuccessSale] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [testerKitOpen, setTesterKitOpen] = useState(false);
  const [testerKitPcs, setTesterKitPcs] = useState(settings.testerKit.pcs);
  const [testerKitPrice, setTesterKitPrice] = useState('');
  const searchRef = useRef(null);
  const checkoutRef = useRef(null);
  const [showScanner, setShowScanner] = useState(false);

  const { showToast } = useToast();

  const handleBarcodeScan = (code) => {
    const found = products.find(p =>
      p.BatchNumber?.toLowerCase() === code.toLowerCase() ||
      p.SKU?.toLowerCase() === code.toLowerCase() ||
      p.id?.toLowerCase() === code.toLowerCase()
    );
    if (found) {
      if ((found.Stock || 0) > 0) {
        addToCart(found);
        showToast(`Added: ${found.Name}`, 'success');
      } else {
        showToast(`${found.Name} is out of stock`, 'error');
      }
    } else {
      showToast(`No product found for barcode: ${code}`, 'error');
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      (p.Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.Brand?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (p.Stock || 0) > 0
    );
  }, [products, searchTerm]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  const discountAmount = useMemo(() => (subtotal * discount) / 100, [subtotal, discount]);
  const shippingFeeAmount = useMemo(() => {
    const v = parseFloat(shippingFee);
    return (!isNaN(v) && v > 0) ? v : 0;
  }, [shippingFee]);
  const total = useMemo(() => subtotal - discountAmount + shippingFeeAmount, [subtotal, discountAmount, shippingFeeAmount]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filteredProducts.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && filteredProducts[selectedIdx]) { addToCart(filteredProducts[selectedIdx]); }
      if (e.key === 'Delete' && cart.length > 0) { removeFromCart(cart[cart.length - 1].id); }
      if (e.key === 'F2') { e.preventDefault(); checkoutRef.current?.click(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredProducts, selectedIdx, cart]);

  const posOrderId = searchParams.get('posOrder');

  const loadOrderIntoCart = useCallback((order) => {
    const items = Array.isArray(order.items) ? order.items
      : (Array.isArray(order.order_items) ? order.order_items : []);
    const newCart = items.map((it, idx) => {
      const name = it.name || it.Name || it.perfumeName || it.ProductName || `Item ${idx + 1}`;
      const brand = it.brand || it.Brand || '';
      const quantity = Math.max(1, Number(it.quantity || it.Quantity || it.qty || 1));
      const price = Number(it.price || it.Price || it.SellingPrice || it.unit_price || it.UnitPrice || 0);
      const product = products.find(p =>
        String(p.Name || '').trim().toLowerCase() === String(name).trim().toLowerCase());
      return {
        id: product ? product.id : `order-item-${idx}`,
        name,
        brand: brand || (product ? product.Brand : ''),
        price,
        quantity,
        maxStock: product ? (product.Stock || 0) : 9999,
      };
    });
    setCart(newCart);
    setActiveOrder({
      id: order.id,
      OrderNumber: order.OrderNumber || '',
      customerName: order.customerName || order.fullName || order.name || '',
      phone: order.phone || '',
      email: order.email || '',
      address: [order.address, order.city, order.province, order.zipCode].filter(Boolean).join(', '),
      notes: order.notes || '',
    });
    setCustomerType('retail');
    setDiscount(0);
    setShippingFee('');
  }, [products]);

  useEffect(() => {
    if (!posOrderId || loading) return;
    let cancelled = false;
    (async () => {
      try {
        const order = await getOrder(posOrderId);
        if (cancelled) return;
        if (!order) {
          showToast('Order not found');
        } else {
          loadOrderIntoCart(order);
          showToast(`Order ${order.OrderNumber || order.id.slice(0, 8)} loaded`, 'success');
        }
      } catch (error) {
        console.error('Error loading order:', error);
        showToast('Failed to load order');
      } finally {
        if (!cancelled) setSearchParams({}, { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [posOrderId, loading, getOrder, loadOrderIntoCart, setSearchParams]);

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= (product.Stock || 0)) {
        showToast('Not enough stock available');
        return;
      }
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      const basePrice = customerType === 'reseller'
        ? (product.ResellerPrice || product.SellingPrice || product.Price || 0)
        : (product.SellingPrice || product.Price || 0);
      const discountRate = customerType === 'reseller' && selectedReseller
        ? (Number(selectedReseller.DiscountRate) || 0) / 100
        : 0;
      const price = basePrice * (1 - discountRate);
      setCart([...cart, {
        id: product.id, name: product.Name, brand: product.Brand,
        price, quantity: 1, maxStock: product.Stock || 0,
        basePrice, discountRate
      }]);
    }
  };

  const removeFromCart = (productId) => setCart(cart.filter(item => item.id !== productId));

  const updateQuantity = (productId, newQuantity) => {
    const item = cart.find(i => i.id === productId);
    if (newQuantity > item.maxStock) { showToast('Not enough stock available'); return; }
    if (newQuantity <= 0) { removeFromCart(productId); return; }
    setCart(cart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
  };

  const kitInCart = cart.find(i => i.id === 'tester-kit');

  const openTesterKitDialog = () => {
    setTesterKitPcs(kitInCart?.pcs ?? 100);
    setTesterKitPrice(kitInCart ? String(kitInCart.price) : '');
    setTesterKitOpen(true);
  };

  const confirmTesterKit = () => {
    const pcs = Math.max(1, parseInt(testerKitPcs, 10) || 1);
    const price = parseFloat(testerKitPrice);
    if (isNaN(price) || price <= 0) { showToast('Enter a valid price'); return; }
    const line = { id: 'tester-kit', name: 'Tester Kit', pcs, price, quantity: 1, maxStock: 9999, isTesterKit: true };
    setCart(prev => prev.some(item => item.id === 'tester-kit')
      ? prev.map(item => item.id === 'tester-kit' ? { ...item, pcs, price } : item)
      : [...prev, line]);
    setTesterKitOpen(false);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) { showToast('Cart is empty'); return; }
    if (customerType === 'reseller' && !selectedReseller) { showToast('Please select a reseller'); return; }
    if (!saleDate || isNaN(new Date(saleDate).getTime())) { showToast('Enter a valid sale date'); return; }
    setProcessing(true);
    try {
      const invoiceNumber = await nextInvoiceNumber(db);
      const saleData = {
        SaleDate: Timestamp.fromDate(new Date(saleDate)),
        InvoiceNumber: invoiceNumber,
        CustomerId: customerType === 'retail' ? (selectedCustomer?.id || null) : null,
        ResellerId: customerType === 'reseller' ? selectedReseller.id : null,
        Subtotal: subtotal, Discount: discountAmount, Total: total,
        ShippingFee: shippingFeeAmount,
        PaymentMethod: paymentMethod,
        Items: cart.map(item => item.isTesterKit
          ? { ProductId: 'tester-kit', ProductName: 'Tester Kit', Quantity: 1,
              UnitPrice: item.price, Subtotal: item.price, Pcs: item.pcs }
          : { ProductId: item.id, ProductName: item.name,
              Quantity: item.quantity, UnitPrice: item.price,
              Subtotal: item.price * item.quantity })
      };
      const stockDeltas = cart
        .filter(item => !item.isTesterKit && products.some(p => p.id === item.id))
        .map(item => ({ productId: item.id, delta: -item.quantity }));
      const saleId = await addSale(saleData, { stockDeltas });
      const saleQueuedOffline = typeof saleId === 'string' && saleId.startsWith('SCNT-LOCAL-SALE');
      if (saleQueuedOffline) {
        showToast('Saved locally — invoice generated; will sync when quota resets', 'info');
      } else {
        for (const d of stockDeltas) {
          await adjustStock(d.productId, d.delta);
        }
      }
      const orderForSale = activeOrder;
      const customerInfo = orderForSale
        ? { Name: orderForSale.customerName || 'Walk-in Customer', Phone: orderForSale.phone || '', Address: orderForSale.address || '', Notes: orderForSale.notes || '' }
        : customerType === 'retail'
          ? { Name: selectedCustomer?.Name || 'Walk-in Customer', Phone: selectedCustomer?.Phone || '', Address: selectedCustomer?.Address || '', Notes: selectedCustomer?.Notes || '' }
          : { Name: selectedReseller?.Name || '', Phone: selectedReseller?.Phone || '', Address: selectedReseller?.Address || '', Notes: selectedReseller?.Notes || '' };
      const invoiceRecord = {
        id: saleId,
        InvoiceNumber: invoiceNumber,
        SaleDate: saleData.SaleDate,
        CustomerType: customerType,
        CustomerName: customerInfo.Name,
        CustomerPhone: customerInfo.Phone,
        CustomerAddress: customerInfo.Address,
        CustomerNotes: customerInfo.Notes,
        Subtotal: subtotal,
        Discount: discountAmount,
        ShippingFee: shippingFeeAmount,
        Total: total,
        PaymentMethod: paymentMethod,
        Items: saleData.Items,
        orderId: orderForSale ? orderForSale.id : null,
        orderNumber: orderForSale ? (orderForSale.OrderNumber || null) : null
      };
      if (orderForSale) {
        try {
          await updateOrder(orderForSale.id, {
            posHandled: true,
            posHandledAt: new Date().toISOString(),
            fulfilled: true,
          });
        } catch (error) {
          console.error('Error marking order handled:', error);
        }
        setActiveOrder(null);
      }

      // F3.1: Loyalty points auto-earn
      if (customerType === 'retail' && selectedCustomer) {
        try {
          const earnRate = Number(settings.loyaltyEarnRate) || 1;
          const pointsEarned = Math.floor(total / earnRate);
          if (pointsEarned > 0) {
            const customerRef = doc(db, 'customers', selectedCustomer.id);
            const newTotal = (Number(selectedCustomer.LoyaltyPoints) || 0) + pointsEarned;
            await updateDoc(customerRef, { LoyaltyPoints: increment(pointsEarned) });
            const tiers = settings.loyaltyTiers || {};
            const vip = tiers.VIP ?? 200;
            const gold = tiers.Gold ?? 100;
            const silver = tiers.Silver ?? 50;
            let tierLabel = 'Member';
            if (newTotal >= vip) tierLabel = 'VIP';
            else if (newTotal >= gold) tierLabel = 'Gold';
            else if (newTotal >= silver) tierLabel = 'Silver';
            // Update tier in Firestore
            await updateDoc(customerRef, { LoyaltyTier: tierLabel });
            showToast(`Customer earned ${pointsEarned} points (${newTotal} total — ${tierLabel})`, 'success');
          }
        } catch (error) {
          console.error('Error updating loyalty points:', error);
        }
      }

      setSuccessSale(invoiceRecord);
      showToast('Sale completed!', 'success');
      setCart([]); setSelectedCustomer(null); setSelectedReseller(null);
      setDiscount(0); setShippingFee(''); setPaymentMethod('Cash'); setSaleDate(new Date().toISOString().split('T')[0]); setSearchTerm('');
    } catch (error) {
      console.error('Error completing sale:', error);
      showToast('Failed to complete sale');
    } finally { setProcessing(false); }
  };

  const downloadInvoice = async () => {
    if (!successSale) return;
    setDownloading(true);
    try {
      await generateInvoice(successSale, { orderId: successSale.orderId || undefined, orderNumber: successSale.orderNumber || undefined });
    }
    catch (error) { console.error('Error generating invoice:', error); showToast('Failed to generate invoice PDF'); }
    finally { setDownloading(false); }
  };

  const printReceipt = () => {
    if (!successSale) return;
    const receiptContent = `
      <html>
      <head>
        <title>SCNT Vault Receipt</title>
        <style>
          @media print {
            body { width: 72mm; margin: 0; padding: 0; font-family: monospace; font-size: 10pt; }
            .receipt { width: 72mm; padding: 0; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 8px 0; }
            .item { display: flex; justify-content: space-between; margin: 4px 0; }
            .total { font-weight: bold; font-size: 12pt; margin-top: 8px; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="center bold">SCNT Vault</div>
          <div class="center">${new Date().toLocaleString()}</div>
          <div class="center">Invoice #${successSale.InvoiceNumber || successSale.id}</div>
          <div class="line"></div>
          <div class="item"><span>Customer:</span><span>${successSale.CustomerName || 'Walk-in'}</span></div>
          <div class="item"><span>Payment:</span><span>${successSale.PaymentMethod || 'Cash'}</span></div>
          <div class="line"></div>
          ${(successSale.Items || []).map(item => `
            <div class="item">
              <span>${item.ProductName || 'Product'} x${item.Quantity}</span>
              <span>₱${(item.Subtotal || 0).toLocaleString()}</span>
            </div>
          `).join('')}
          <div class="line"></div>
          <div class="item"><span>Subtotal:</span><span>₱${(successSale.Subtotal || 0).toLocaleString()}</span></div>
          ${successSale.Discount ? `<div class="item"><span>Discount:</span><span>-₱${successSale.Discount.toLocaleString()}</span></div>` : ''}
          ${successSale.ShippingFee ? `<div class="item"><span>Shipping:</span><span>₱${successSale.ShippingFee.toLocaleString()}</span></div>` : ''}
          <div class="item total"><span>TOTAL:</span><span>₱${(successSale.Total || 0).toLocaleString()}</span></div>
          <div class="line"></div>
          <div class="center">Thank you!</div>
          <div class="center">SCNT Vault</div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(receiptContent);
    printWindow.document.close();
  };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <p style={{ color:'var(--text-muted)', fontSize:13 }}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>

      {/* Main layout */}
      <div className="pos-layout" style={{ display:'grid', gridTemplateColumns:'1fr 400px', gap:20, alignItems:'start' }}>

        {/* Products Panel */}
        <div style={{ background:'var(--bg-card)', borderRadius:20, padding:20,
          display:'flex', flexDirection:'column', boxShadow:'0 2px 16px rgba(0,0,0,0.2)', overflow:'hidden',
          height:'calc(100vh - 160px)' }}>
          {/* Search */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:12, padding:'10px 16px',
            display:'flex', alignItems:'center', gap:10, marginBottom:16, border:'1.5px solid var(--border)' }}>
            <FaSearch style={{ color:'var(--text-muted)', fontSize:14 }} />
            <input ref={searchRef} value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedIdx(0); }}
              placeholder="Search products... ( / )"
              style={{ flex:1, border:'none', outline:'none', fontSize:13, color:'var(--text-primary)', background:'transparent' }} />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
                <FaTimes />
              </button>
            )}
            <button onClick={() => setShowScanner(true)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', padding:4, display:'flex', alignItems:'center' }}
              title="Scan barcode">
              <FaBarcode style={{ fontSize:16 }} />
            </button>
          </div>

          {/* Product grid */}
          <div style={{ flex:1, overflowY:'auto', display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:16,
            gridAutoRows:'minmax(260px, auto)' }}>
            {/* Tester Kit card — always visible, pinned at top */}
            <div onClick={openTesterKitDialog}
              style={{ minHeight:260, borderRadius:16, cursor:'pointer', position:'relative',
                background:'linear-gradient(135deg,#2dd4bf,#06b6d4)',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:10, padding:16, boxShadow:'0 2px 12px rgba(0,0,0,0.2)',
                transition:'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(45,212,191,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.2)'; }}>
              <FaFlask style={{ fontSize:30, color:'#0f172a' }} />
              <div style={{ fontSize:15, fontWeight:800, color:'#0f172a' }}>Tester Kit</div>
              <div style={{ fontSize:12, color:'rgba(15,23,42,0.7)' }}>Package — set pcs &amp; price</div>
              {kitInCart && (
                <div style={{ position:'absolute', top:8, right:8, padding:'3px 10px', borderRadius:20,
                  background:'#0f172a', color:'#2dd4bf', fontSize:11, fontWeight:800,
                  boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>
                  {kitInCart.pcs} pcs
                </div>
              )}
            </div>
            {filteredProducts.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-muted)', gridColumn:'1/-1', fontSize:14 }}>
                {searchTerm ? 'No products match your search' : 'No products in stock'}
              </div>
            ) : filteredProducts.map((product, idx) => {
              const price = customerType === 'reseller'
                ? (product.ResellerPrice || product.SellingPrice || product.Price || 0)
                : (product.SellingPrice || product.Price || 0);
              const inCart = cart.find(i => i.id === product.id);
              const imgSrc = product.ImagePath
                ? `https://scnt-vault.web.app/${product.ImagePath}`
                : 'https://scnt-vault.web.app/images/scnt_default.png';
              return (
                <div key={product.id} onClick={() => addToCart(product)}
                  style={{ background:'var(--bg-card)', borderRadius:16, overflow:'hidden', cursor:'pointer',
                    boxShadow: inCart ? '0 0 0 2.5px var(--accent), 0 4px 20px rgba(45,212,191,0.15)'
                      : idx === selectedIdx ? '0 0 0 2px var(--text-muted), 0 4px 16px rgba(0,0,0,0.15)'
                      : '0 2px 12px rgba(0,0,0,0.15)',
                    border: inCart ? '2px solid var(--accent)'
                      : idx === selectedIdx ? '2px solid var(--text-muted)'
                      : '1px solid var(--border)',
                    transition:'transform 0.15s, box-shadow 0.15s', position:'relative' }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='none'; }}
                >
                  <div style={{ background:'var(--bg-secondary)', height:170, display:'flex', alignItems:'center', justifyContent:'center', padding:10 }}>
                    <img src={imgSrc} alt={product.Name}
                      style={{ maxHeight:'100%', maxWidth:'100%', objectFit:'contain' }}
                      onError={e => { e.target.src='https://scnt-vault.web.app/images/scnt_default.png'; }} />
                  </div>
                  <div style={{ padding:'12px 14px 14px' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', lineHeight:1.3, marginBottom:2,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {product.Name}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {product.Brand}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:15, fontWeight:800, color:'var(--accent)' }}>
                        ₱{price.toLocaleString()}
                      </span>
                      <span style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:10,
                        background:'rgba(255,255,255,0.06)', color: (product.Stock || 0) > 10 ? 'var(--text-muted)' : 'var(--danger)' }}>
                        {product.Stock || 0} left
                      </span>
                    </div>
                  </div>
                  {inCart && (
                    <div style={{ position:'absolute', top:8, right:8, width:22, height:22,
                      borderRadius:'50%', background:'var(--accent)', color:'#0f172a',
                      fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center',
                      boxShadow:'0 2px 8px rgba(45,212,191,0.4)' }}>
                      {inCart.quantity}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart Panel */}
        <div style={{ background:'var(--bg-card)', borderRadius:20, padding:20,
          display:'flex', flexDirection:'column', boxShadow:'0 2px 16px rgba(0,0,0,0.2)', overflow:'hidden',
          height:'calc(100vh - 160px)' }}>

          {/* Cart header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700, fontSize:16, color:'var(--text-primary)' }}>
              <FaShoppingCart style={{ color:'var(--accent)', fontSize:15 }} /> Cart
              {cart.length > 0 && (
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'var(--accent-dim)', color:'var(--accent)', fontWeight:700 }}>
                  {cart.reduce((s, i) => s + i.quantity, 0)} items
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={() => setClearConfirm(true)}
                style={{ padding:'6px 12px', background:'rgba(255,255,255,0.06)', color:'var(--text-muted)', border:'none',
                  borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', transition:'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}>
                Clear
              </button>
            )}
          </div>

          {/* Customer type */}
          <div style={{ marginBottom:12 }}>
            <label style={lbl}>Customer Type</label>
            <select value={customerType}
              onChange={e => { setCustomerType(e.target.value); setCart([]); setActiveOrder(null); }}
              style={inp}>
              <option value="retail">Retail Customer</option>
              <option value="reseller">Reseller / Wholesale</option>
            </select>
          </div>

          {/* Customer / Reseller select */}
          {customerType === 'retail' ? (
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Customer (Optional)</label>
              <select value={selectedCustomer?.id || ''}
                onChange={e => setSelectedCustomer(customers.find(c => c.id === e.target.value) || null)}
                style={inp}>
                <option value="">Walk-in Customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.Name}</option>)}
              </select>
            </div>
          ) : (
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Reseller <span style={{ color:'var(--danger)' }}>*</span></label>
              <select value={selectedReseller?.id || ''}
                onChange={e => {
                  const newReseller = resellers.find(r => r.id === e.target.value) || null;
                  setSelectedReseller(newReseller);
                  if (cart.length > 0 && customerType === 'reseller') {
                    setCart(cart.map(item => {
                      if (item.isTesterKit) return item;
                      const prod = products.find(p => p.id === item.id);
                      if (!prod) return item;
                      const newDiscountRate = newReseller ? (Number(newReseller.DiscountRate) || 0) / 100 : 0;
                      const basePrice = prod.ResellerPrice || prod.SellingPrice || prod.Price || 0;
                      const price = basePrice * (1 - newDiscountRate);
                      return { ...item, price, basePrice, discountRate: newDiscountRate };
                    }));
                  }
                }}
                style={inp}>
                <option value="">Select Reseller</option>
                {resellers.filter(r => r.IsActive !== false).map(r => <option key={r.id} value={r.id}>{r.Name}</option>)}
              </select>
            </div>
          )}

          {activeOrder && (
            <div style={{ background:'var(--accent-dim)', border:'1px solid var(--border)', borderRadius:10,
              padding:'10px 12px', marginBottom:12, fontSize:12, color:'var(--accent)' }}>
              <div style={{ fontWeight:700, marginBottom:2 }}>
                Order {activeOrder.OrderNumber || activeOrder.id.slice(0, 8)} loaded
              </div>
              <div style={{ color:'var(--text-secondary)', lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {activeOrder.customerName}{activeOrder.phone ? ` — ${activeOrder.phone}` : ''}
              </div>
            </div>
          )}

          {/* Cart items */}
          <div style={{ flex:1, overflowY:'auto', margin:'8px 0' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-muted)', fontSize:14 }}>
                Cart is empty
              </div>
            ) : cart.map(item => (
              <div key={item.id} style={{ background:'var(--bg-secondary)', borderRadius:12, padding:'12px 14px', marginBottom:8,
                border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:2,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</div>
                    {item.isTesterKit
                      ? <div style={{ fontSize:11, fontWeight:700, color:'var(--accent)' }}>Package</div>
                      : <div style={{ fontSize:11, color:'var(--text-muted)' }}>{item.brand}</div>}
                  </div>
                  <button onClick={() => removeFromCart(item.id)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, flexShrink:0 }}
                    onMouseEnter={e => e.currentTarget.style.color='var(--danger)'}
                    onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>
                    <FaTrash style={{ fontSize:11 }} />
                  </button>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  {item.isTesterKit ? (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:12,
                        background:'var(--accent-dim)', color:'var(--accent)' }}>
                        {item.pcs} pcs
                      </span>
                    </div>
                  ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      style={{ width:28, height:28, border:'1.5px solid var(--border)', background:'var(--bg-card)',
                        borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:13, color:'var(--text-primary)',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>-</button>
                    <input type="number" value={item.quantity} min={1} max={item.maxStock}
                      onChange={e => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                      style={{ width:44, textAlign:'center', padding:4, border:'1.5px solid var(--border)',
                        borderRadius:6, fontSize:13, fontWeight:700, outline:'none',
                        background:'var(--bg-input)', color:'var(--text-primary)' }} />
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      style={{ width:28, height:28, border:'1.5px solid var(--border)', background:'var(--bg-card)',
                        borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:13, color:'var(--text-primary)',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                  </div>
                  )}
                  <span style={{ fontSize:14, fontWeight:800, color:'var(--text-primary)' }}>
                    ₱{(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Payment details */}
          {cart.length > 0 && (
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:14, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={lbl}>Discount (%)</label>
                  <input type="number" min={0} max={100} value={discount}
                    onChange={e => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    style={inp} />
                </div>
                <div>
                  <label style={lbl}>Payment</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={inp}>
                    {settings.paymentMethods.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Shipping Fee (₱)</label>
                <input type="number" min={0} step="0.01" value={shippingFee} placeholder="0"
                  onChange={e => setShippingFee(e.target.value)}
                  style={inp} />
              </div>
              <div>
                <label style={lbl}>Sale Date</label>
                <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} style={inp} />
              </div>

              {/* Totals */}
              <div style={{ borderTop:'2px solid var(--border)', paddingTop:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text-muted)', marginBottom:6 }}>
                  <span>Subtotal</span><span style={{ fontWeight:600 }}>₱{subtotal.toLocaleString()}</span>
                </div>
                {customerType === 'reseller' && selectedReseller && Number(selectedReseller.DiscountRate) > 0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--accent)', marginBottom:6 }}>
                    <span>Reseller discount: -{selectedReseller.DiscountRate}%</span>
                    <span style={{ fontWeight:600 }}>
                      -₱{cart.reduce((s, item) => {
                        if (item.isTesterKit || !item.discountRate) return s;
                        return s + (item.basePrice * item.discountRate * item.quantity);
                      }, 0).toLocaleString()}
                    </span>
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--danger)', marginBottom:8 }}>
                  <span>Discount ({discount}%)</span><span style={{ fontWeight:600 }}>-₱{discountAmount.toLocaleString()}</span>
                </div>
                {shippingFeeAmount > 0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text-muted)', marginBottom:8 }}>
                    <span>Shipping Fee</span><span style={{ fontWeight:600 }}>₱{shippingFeeAmount.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:20, fontWeight:800, color:'var(--text-primary)',
                  paddingTop:10, borderTop:'1px solid var(--border)' }}>
                  <span>Total</span><span style={{ color:'var(--accent)' }}>₱{total.toLocaleString()}</span>
                </div>
              </div>

              {/* Checkout button */}
              <button ref={checkoutRef} onClick={handleCheckout} disabled={processing}
                style={{ width:'100%', padding:'12px 0', marginTop:8,
                  background: processing ? 'rgba(255,255,255,0.08)' : 'var(--accent)',
                  color: processing ? 'var(--text-muted)' : '#0f172a',
                  border:'none', borderRadius:10, fontSize:14, fontWeight:700,
                  cursor: processing ? 'not-allowed' : 'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {processing ? 'Processing...' : <><FaCheck /> Complete Sale</>}
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog isOpen={clearConfirm} onClose={() => setClearConfirm(false)}
        onConfirm={() => { setCart([]); setActiveOrder(null); setClearConfirm(false); }}
        title="Clear Cart?" message="Remove all items from the cart?" confirmLabel="Clear Cart" />

      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
      />

      <Modal isOpen={testerKitOpen} onClose={() => setTesterKitOpen(false)} title="Configure Tester Kit"
        icon={<FaFlask style={{ fontSize: 16 }} />} maxWidth={400}
        gradient="linear-gradient(135deg,#f0abfc,#6366f1)">
        <Modal.Body>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 16px', lineHeight:1.5 }}>
            Set the piece count and fixed price for the tester package. Price is the flat line total — pcs is display only.
          </p>
          <label style={lbl}>Pcs</label>
          <input type="number" min={1} value={testerKitPcs}
            onChange={e => setTesterKitPcs(e.target.value)}
            style={{ ...inp, marginBottom:14 }} />
          <label style={lbl}>Price (₱)</label>
          <input type="number" min={0} step="0.01" value={testerKitPrice} placeholder="0"
            onChange={e => setTesterKitPrice(e.target.value)} style={inp} />
        </Modal.Body>
        <Modal.Footer>
          <CancelButton onClick={() => setTesterKitOpen(false)} />
          <PrimaryButton onClick={confirmTesterKit}>Confirm</PrimaryButton>
        </Modal.Footer>
      </Modal>

      <Modal isOpen={!!successSale} onClose={() => setSuccessSale(null)} title="Sale Completed"
        icon={<FaCheckCircle style={{ fontSize: 16 }} />} maxWidth={420}
        gradient="linear-gradient(135deg,#10b981,#059669)">
        <div style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <FaCheck style={{ fontSize: 24, color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Sale Completed!</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
            Invoice #{successSale?.InvoiceNumber || successSale?.id} is ready. Download the PDF invoice below.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <CancelButton onClick={() => setSuccessSale(null)} label="Done" />
            <button onClick={downloadInvoice} disabled={downloading}
              style={{ padding: '9px 20px', background: downloading ? 'rgba(255,255,255,0.08)' : 'var(--accent)',
                color: downloading ? 'var(--text-muted)' : '#0f172a', border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 700, cursor: downloading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaFilePdf style={{ fontSize: 13 }} />
              {downloading ? 'Generating...' : 'Download Invoice (PDF)'}
            </button>
            <button onClick={printReceipt}
              style={{ padding: '9px 20px', background: 'rgba(255,255,255,0.08)',
                color: 'var(--text-secondary)', border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaPrint style={{ fontSize: 13 }} />
              Print Receipt
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}