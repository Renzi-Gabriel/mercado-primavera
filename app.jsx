import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, onSnapshot, 
  addDoc, updateDoc, deleteDoc, serverTimestamp, getDoc
} from 'firebase/firestore';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup 
} from 'firebase/auth';
import Swal from 'sweetalert2'; 
import { 
  LayoutDashboard, Package, ArrowUpRight, Plus, Search, 
  Trash2, Edit3, ShoppingCart, TrendingUp, AlertTriangle, 
  X, LogOut, Mail, Lock, Barcode, Calendar, Award, Smartphone,
  Calculator, Utensils, Banknote, CreditCard, Download, User, MinusCircle, Receipt, Trash, CheckCircle,
  ArrowUpDown, Percent
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "mercado-6b77c";
const ADMIN_EMAILS = ["gabrielflorencio190@gmail.com", "miscileneflorencio50@gmail.com"];

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('cardapio');
  const [periodoFechamento, setPeriodoFechamento] = useState('hoje');
  const [dataInicio, setDataInicio] = useState(''); 
  const [dataFim, setDataFim] = useState(''); 
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saleSearch, setSaleSearch] = useState('');

  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [amountReceived, setAmountReceived] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('Dinheiro');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSangriaModalOpen, setIsSangriaModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [issaving, setIsSaving] = useState(false);

  const isAdmin = useMemo(() => user && ADMIN_EMAILS.includes(user.email), [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [user]);

  // --- LÓGICA DO CARRINHO ---
  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, cartQty: item.cartQty + 1 } : item));
    } else {
      setCart([...cart, { ...product, cartQty: 1 }]);
    }
    setSaleSearch('');
  };

  const updateCartQty = (id, newQty) => {
    if (newQty <= 0) return setCart(cart.filter(item => item.id !== id));
    setCart(cart.map(item => item.id === id ? { ...item, cartQty: newQty } : item));
  };

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.cartQty), 0), [cart]);
  const cartTotal = useMemo(() => Math.max(0, subtotal - (parseFloat(discount) || 0)), [subtotal, discount]);
  const troco = useMemo(() => {
    const rec = parseFloat(amountReceived) || 0;
    return rec > cartTotal ? rec - cartTotal : 0;
  }, [amountReceived, cartTotal]);

  const finalizeSale = async () => {
    if (cart.length === 0) return;
    try {
      const salePromises = cart.map(async (item) => {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
          type: 'venda', productName: item.name, productId: item.id,
          amount: parseFloat((item.price * item.cartQty).toFixed(2)),
          profit: parseFloat(((item.price - (item.cost || 0)) * item.cartQty).toFixed(2)), 
          paymentMethod: selectedMethod,
          quantity: item.cartQty, 
          discountApplied: parseFloat(discount) || 0,
          timestamp: serverTimestamp(), 
          operator: user.email
        });
        const novoEstoque = Math.max(0, (item.stock || 0) - item.cartQty);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', item.id), { stock: novoEstoque });
      });
      await Promise.all(salePromises);
      setCart([]); setAmountReceived(''); setDiscount(0); setIsCheckoutOpen(false);
      Swal.fire({ icon: 'success', title: 'Venda Concluída!', timer: 800, showConfirmButton: false });
    } catch (err) { Swal.fire('Erro', 'Falha ao salvar', 'error'); }
  };

  const handleCancelSale = async (trans) => {
    if (!isAdmin) return;
    const res = await Swal.fire({ 
        title: 'Cancelar Venda?', 
        text: `Estornar ${trans.quantity} un de "${trans.productName}" ao estoque?`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sim, cancelar!'
    });
    if (res.isConfirmed) {
      try {
        const prodRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', trans.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) await updateDoc(prodRef, { stock: (prodSnap.data().stock || 0) + trans.quantity });
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', trans.id));
        Swal.fire('Cancelada!', 'Venda removida e estoque devolvido.', 'success');
      } catch (e) { Swal.fire('Erro', 'Erro ao estornar.', 'error'); }
    }
  };

  // --- ORDENAÇÃO ---
  const sortedProducts = useMemo(() => {
    let sortable = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    sortable.sort((a, b) => {
      let vA = a[sortConfig.key], vB = b[sortConfig.key];
      if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
      return sortConfig.direction === 'asc' ? (vA < vB ? -1 : 1) : (vA > vB ? -1 : 1);
    });
    return sortable;
  }, [products, sortConfig, searchTerm]);

  const requestSort = (key) => setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });

  // --- ESTATÍSTICAS (DASHBOARD + FECHAMENTO) ---
  const stats = useMemo(() => {
    const agora = new Date();
    const hojeStart = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    const umaSemanaAtras = hojeStart - (7 * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();

    const transFiltradas = transactions.filter(t => {
      const ts = t.timestamp?.toMillis ? t.timestamp.toMillis() : (t.timestamp?.seconds ? t.timestamp.seconds * 1000 : 0);
      if (periodoFechamento === 'hoje') return ts >= hojeStart;
      if (periodoFechamento === 'semana') return ts >= umaSemanaAtras;
      if (periodoFechamento === 'mes') return ts >= inicioMes;
      if (periodoFechamento === 'personalizado' && dataInicio && dataFim) {
        return ts >= new Date(dataInicio).getTime() && ts <= new Date(dataFim).getTime();
      }
      return true;
    }).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

    const vendas = transFiltradas.filter(t => t.type === 'venda');
    const faturamentoTotal = vendas.reduce((a, b) => a + (b.amount || 0), 0);
    const descontosConcedidos = vendas.reduce((a, b) => a + (b.discountApplied || 0), 0);
    const lucroBruto = vendas.reduce((a, b) => a + (b.profit || 0), 0);
    
    const faturamentoLiquido = faturamentoTotal - descontosConcedidos;
    const lucroLiquido = lucroBruto - descontosConcedidos;

    const resumoPagos = {
      Dinheiro: transFiltradas.filter(t => t.paymentMethod === 'Dinheiro').reduce((acc, t) => acc + (t.amount || 0), 0),
      PIX: transFiltradas.filter(t => t.paymentMethod === 'PIX').reduce((acc, t) => acc + (t.amount || 0), 0),
      Cartão: transFiltradas.filter(t => t.paymentMethod === 'Cartão').reduce((acc, t) => acc + (t.amount || 0), 0),
      Vale: transFiltradas.filter(t => t.paymentMethod === 'Alimentação').reduce((acc, t) => acc + (t.amount || 0), 0),
      Sangria: transFiltradas.filter(t => t.type === 'sangria').reduce((acc, t) => acc + (t.amount || 0), 0),
    };

    const rankingSemanaMap = {};
    vendas.forEach(v => { rankingSemanaMap[v.productName] = (rankingSemanaMap[v.productName] || 0) + (v.quantity || 0); });
    const rankingSemana = Object.entries(rankingSemanaMap).sort(([,a],[,b])=>b-a).slice(0, 5);

    const vendasHora = Array.from({ length: 24 }, (_, i) => ({
      hora: `${i}:00`,
      total: vendas.filter(v => {
          const d = v.timestamp?.toMillis ? new Date(v.timestamp.toMillis()) : (v.timestamp?.seconds ? new Date(v.timestamp.seconds * 1000) : null);
          return d && d.getHours() === i;
      }).reduce((acc, v) => acc + v.amount, 0)
    })).filter(h => h.total > 0 || (parseInt(h.hora) >= 8 && parseInt(h.hora) <= 20));

    return { 
      faturamentoLiquido, lucroLiquido, 
      margem: faturamentoLiquido > 0 ? (lucroLiquido / faturamentoLiquido) * 100 : 0, 
      resumoPagos, 
      totalCaixaFinal: Object.values(resumoPagos).reduce((a,b)=>a+b, 0) - descontosConcedidos,
      rankingSemana, vendasHora, listaVendas: vendas,
      lowStock: products.filter(p => (p.stock || 0) <= (p.minStock || 0)) 
    };
  }, [transactions, products, periodoFechamento, dataInicio, dataFim]);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'login') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) { Swal.fire('Erro', 'Dados inválidos.', 'error'); }
  };

  const handleSangria = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const valor = parseFloat(formData.get('valor'));
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
      type: 'sangria', amount: valor * -1, reason: formData.get('motivo'), timestamp: serverTimestamp(), operator: user.email
    });
    setIsSangriaModalOpen(false);
    Swal.fire('OK', 'Sangria registrada', 'success');
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'), price: parseFloat(formData.get('price')) || 0,
      cost: parseFloat(formData.get('cost')) || 0, stock: parseFloat(formData.get('stock')) || 0,
      minStock: parseFloat(formData.get('minStock')) || 0, category: formData.get('category')
    };
    try {
      if (editingProduct) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', editingProduct.id), data);
      else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'products'), data);
      setIsProductModalOpen(false); setEditingProduct(null);
      Swal.fire('Sucesso', 'Produto Salvo!', 'success');
    } catch (err) { Swal.fire('Erro', 'Falha ao salvar', 'error'); } finally { setIsSaving(false); }
  };

  const handleDeleteProduct = async (product) => {
    if (!isAdmin) return;
    const res = await Swal.fire({ title: 'Excluir?', text: product.name, icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', product.id));
  };

  const exportarPlanilha = () => {
    const cabecalho = "Data;Tipo;Item;Valor;Pagamento;Operador\n";
    const linhas = transactions.map(t => {
      let dataExcel = "---";
      const ts = t.timestamp?.toMillis ? t.timestamp.toMillis() : (t.timestamp?.seconds ? t.timestamp.seconds * 1000 : null);
      if (ts) {
        const d = new Date(ts);
        dataExcel = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
      }
      return `${dataExcel};${t.type};${t.productName || t.reason};${t.amount.toString().replace('.',',')};${t.paymentMethod || 'Sangria'};${t.operator}`;
    }).join("\n");
    const blob = new Blob(["\ufeff" + cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'caixa_primavera.csv'; a.click();
  };

  const enviarListaComprasZap = () => {
    const faltantes = products.filter(p => p.category === 'Mercadinho' && (p.stock || 0) <= (p.minStock || 0));
    let msg = `🛒 *REPOSIÇÃO PRIMAVERA*%0A%0A`;
    faltantes.forEach(p => msg += `• *${p.name}* (Saldo: ${p.stock})%0A`);
    window.open(`https://api.whatsapp.com/send?phone=5511967176847&text=${msg}`, '_blank');
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-emerald-600 uppercase">MERCADO PRIMAVERA...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 text-center border">
          <div className="bg-emerald-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg"><ShoppingCart size={32}/></div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Mercado Primavera</h1>
          <form onSubmit={handleAuth} className="space-y-4 mt-6">
            <input type="email" placeholder="E-mail" required className="w-full p-4 bg-gray-50 border rounded-2xl outline-none font-bold" value={email} onChange={(e)=>setEmail(e.target.value)} />
            <input type="password" placeholder="Senha" required className="w-full p-4 bg-gray-50 border rounded-2xl outline-none font-bold" value={password} onChange={(e)=>setPassword(e.target.value)} />
            <button type="submit" className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl uppercase">Entrar no Caixa</button>
          </form>
          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full bg-white border-2 p-4 rounded-2xl font-black mt-4 text-xs uppercase">Google</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-72 bg-slate-900 text-white p-8 flex flex-col shadow-2xl font-black">
        <div className="flex items-center gap-3 mb-10 text-xl text-emerald-400 uppercase tracking-tighter"><Utensils /> PRIMAVERA</div>
        <nav className="space-y-3 flex-1 text-xs uppercase tracking-widest">
          {isAdmin && <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left p-5 rounded-2xl flex items-center gap-4 transition-all ${activeTab === 'dashboard' ? 'bg-emerald-600 shadow-xl' : 'hover:bg-slate-800'}`}><LayoutDashboard size={20}/> Dashboard</button>}
          <button onClick={() => setActiveTab('cardapio')} className={`w-full text-left p-5 rounded-2xl flex items-center gap-4 transition-all ${activeTab === 'cardapio' ? 'bg-orange-500 shadow-xl' : 'hover:bg-slate-800'}`}><ShoppingCart size={20}/> Vendas / PDV</button>
          <button onClick={() => setActiveTab('estoque')} className={`w-full text-left p-5 rounded-2xl flex items-center gap-4 transition-all ${activeTab === 'estoque' ? 'bg-blue-600 shadow-xl' : 'hover:bg-slate-800'}`}><Package size={20}/> Estoque</button>
          {isAdmin && <button onClick={() => setActiveTab('fechamento')} className={`w-full text-left p-5 rounded-2xl flex items-center gap-4 transition-all ${activeTab === 'fechamento' ? 'bg-purple-600 shadow-xl' : 'hover:bg-slate-800'}`}><Calculator size={20}/> Fechamento</button>}
        </nav>
        <button onClick={() => signOut(auth)} className="flex items-center gap-3 text-red-400 uppercase text-[10px] mt-10"><LogOut size={16}/> Sair</button>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div><h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">{activeTab}</h2><p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Mercado Primavera</p></div>
          <div className="flex gap-4">
            <button onClick={() => setIsSangriaModalOpen(true)} className="bg-red-100 text-red-600 px-6 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2"><MinusCircle size={18}/> Sangria</button>
            {isAdmin && <button onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase"><Plus size={18}/> Novo Item</button>}
          </div>
        </header>

        {/* --- DASHBOARD FINANCEIRO --- */}
        {activeTab === 'dashboard' && isAdmin && (
          <div className="space-y-8 animate-in fade-in duration-700 font-black">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl col-span-1 md:col-span-2 flex flex-col justify-center">
                    <p className="text-emerald-400 text-xs uppercase tracking-widest mb-2">Faturamento {periodoFechamento}</p>
                    <h3 className="text-6xl tracking-tighter mb-4">R$ {stats.faturamentoLiquido.toFixed(2)}</h3>
                    <div className="flex gap-4">
                        <div className="bg-white/10 p-3 rounded-xl flex-1"><p className="text-[10px] text-slate-400 uppercase">Lucro</p><p className="text-xl text-emerald-400">R$ {stats.lucroLiquido.toFixed(2)}</p></div>
                        <div className="bg-white/10 p-3 rounded-xl flex-1"><p className="text-[10px] text-slate-400 uppercase">Margem</p><p className="text-xl text-blue-400">{stats.margem.toFixed(1)}%</p></div>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border text-center flex flex-col justify-center">
                    <p className="text-slate-400 text-[10px] uppercase mb-2">Ticket Médio</p>
                    <h3 className="text-3xl text-slate-800">R$ {(stats.faturamentoLiquido / (stats.listaVendas.length || 1)).toFixed(2)}</h3>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border text-center flex flex-col justify-center">
                    <p className="text-slate-400 text-[10px] uppercase mb-2">Críticos</p>
                    <h3 className="text-3xl text-orange-500">{stats.lowStock.length} Itens</h3>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border"><h3 className="uppercase text-xs mb-8 flex items-center gap-2"><TrendingUp size={16} className="text-blue-500"/> Fluxo de Vendas</h3><div className="h-64"><ResponsiveContainer><AreaChart data={stats.vendasHora}><XAxis dataKey="hora" axisLine={false} tickLine={false} tick={{fontSize: 10}} dy={10}/><Tooltip contentStyle={{borderRadius: '20px', border: 'none'}}/><Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={4} fill="#d1fae5"/></AreaChart></ResponsiveContainer></div></div>
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border"><h3 className="uppercase text-xs mb-6">Top 5 Vendidos</h3><div className="space-y-4">{stats.rankingSemana.map(([name, qty], i) => (<div key={name} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl"><span className="text-slate-700 text-xs uppercase">{i+1}. {name}</span><span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-lg text-xs">{qty} un</span></div>))}</div></div>
            </div>
          </div>
        )}

        {/* --- PDV --- */}
        {activeTab === 'cardapio' && (
          <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500 font-black">
            <div className="flex-1 space-y-6">
              <div className="relative">
                <Search className="absolute left-6 top-6 text-slate-300" size={24}/>
                <input type="text" placeholder="Bipar código ou pesquisar..." className="w-full p-6 pl-16 bg-white rounded-[2.5rem] shadow-sm text-xl outline-none border-none font-black" value={saleSearch} onChange={(e)=>setSaleSearch(e.target.value)} autoFocus />
                {saleSearch && (
                  <div className="absolute z-50 w-full mt-4 bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-2xl max-h-96 overflow-y-auto p-4 space-y-2">
                    {products.filter(p => p.name.toLowerCase().includes(saleSearch.toLowerCase()) || p.barcode?.includes(saleSearch)).map(p => (
                      <button key={p.id} onClick={() => addToCart(p)} className="w-full flex justify-between items-center p-5 hover:bg-emerald-50 rounded-2xl transition-all border-b border-slate-50 text-left">
                        <div><p className="font-black text-slate-800 uppercase text-sm">{p.name}</p><p className="text-[10px] text-slate-400">Estoque: {p.stock}</p></div>
                        <p className="text-xl font-black text-emerald-600">R$ {p.price.toFixed(2)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {products.filter(p => p.category !== 'Mercadinho').slice(0, 8).map(p => (
                   <button key={p.id} onClick={() => addToCart(p)} className="bg-white p-6 rounded-[2.5rem] shadow-sm hover:shadow-md transition-all text-center border active:scale-95">
                      <div className="text-4xl mb-2">{p.category === 'Padaria' ? '🥐' : '🍔'}</div>
                      <p className="text-slate-800 text-[10px] uppercase truncate">{p.name}</p>
                      <p className="text-emerald-600 text-sm">R$ {p.price.toFixed(2)}</p>
                   </button>
                ))}
              </div>
            </div>

            <div className="w-full lg:w-96 bg-white rounded-[3rem] shadow-2xl flex flex-col h-[calc(100vh-200px)] sticky top-8 border border-slate-100 font-black overflow-hidden">
              <div className="p-8 border-b bg-slate-50 flex justify-between items-center"><h3 className="uppercase text-sm"><Receipt size={18} className="inline mr-2"/> Cupom</h3><span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px]">{cart.length} ITENS</span></div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? <p className="text-center text-slate-300 mt-20 uppercase text-xs">Caixa Livre</p> : cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center"><div className="flex-1"><p className="text-xs uppercase truncate w-32">{item.name}</p><div className="flex items-center gap-2 mt-1"><button onClick={()=>updateCartQty(item.id, item.cartQty - 1)} className="w-6 h-6 bg-slate-100 rounded-full">-</button><span className="text-xs">{item.cartQty}</span><button onClick={()=>updateCartQty(item.id, item.cartQty + 1)} className="w-6 h-6 bg-slate-100 rounded-full">+</button></div></div><p className="text-sm">R$ {(item.price * item.cartQty).toFixed(2)}</p></div>
                ))}
              </div>
              <div className="p-8 bg-slate-900 text-white space-y-4">
                <div className="flex items-center justify-between bg-white/10 p-3 rounded-xl"><div className="flex items-center gap-2 text-orange-400 uppercase text-[10px]"><Percent size={14}/> Desconto R$</div><input type="number" step="0.01" className="bg-transparent text-right outline-none w-20 text-white font-black" value={discount} onChange={(e)=>setDiscount(e.target.value)} /></div>
                <div className="flex justify-between items-end border-t border-white/10 pt-4"><p className="uppercase text-xs text-slate-400">Total</p><h4 className="text-5xl text-emerald-400">R$ {cartTotal.toFixed(2)}</h4></div>
                <button disabled={cart.length === 0} onClick={() => setIsCheckoutOpen(true)} className="w-full bg-emerald-600 py-5 rounded-2xl uppercase text-xs shadow-xl font-black">Finalizar Venda</button>
              </div>
            </div>
          </div>
        )}

        {/* --- ESTOQUE COM ORDENAÇÃO --- */}
        {activeTab === 'estoque' && (
          <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden font-black">
            <div className="p-8 bg-slate-50 border-b flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex gap-4 items-center flex-1 w-full"><Search className="text-slate-400"/><input className="bg-transparent outline-none w-full text-sm font-black" placeholder="Buscar no estoque..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)}/></div>
                <div className="flex gap-2">
                    <button onClick={()=>requestSort('name')} className="p-3 bg-white border rounded-xl text-[10px] uppercase hover:bg-slate-100"><ArrowUpDown size={14} className="inline mr-1"/> Nome</button>
                    <button onClick={()=>requestSort('price')} className="p-3 bg-white border rounded-xl text-[10px] uppercase hover:bg-slate-100"><ArrowUpDown size={14} className="inline mr-1"/> Preço</button>
                    <button onClick={()=>requestSort('stock')} className="p-3 bg-white border rounded-xl text-[10px] uppercase hover:bg-slate-100"><ArrowUpDown size={14} className="inline mr-1"/> Saldo</button>
                </div>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b"><tr><th className="p-8">Item</th><th className="p-8 text-center">Saldo</th><th className="p-8">Preço</th><th className="p-8 text-center">Ações</th></tr></thead>
              <tbody className="divide-y font-black">
                {sortedProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50"><td className="p-8 text-xs uppercase">{p.name}</td><td className="p-8 text-center"><span className={`px-4 py-2 rounded-xl text-[11px] ${p.stock <= (p.minStock || 0) ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{p.stock} un</span></td><td className="p-8">R$ {p.price.toFixed(2)}</td><td className="p-8 flex justify-center gap-4">{isAdmin && <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="text-blue-500"><Edit3 size={18}/></button>}{isAdmin && <button onClick={() => handleDeleteProduct(p)} className="text-red-500"><Trash2 size={18}/></button>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- FECHAMENTO --- */}
        {activeTab === 'fechamento' && isAdmin && (
          <div className="space-y-8 animate-in fade-in font-black">
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex bg-white p-2 rounded-2xl border w-fit shadow-sm">
                    {['hoje', 'semana', 'mes', 'personalizado'].map(p => (
                        <button key={p} onClick={()=>setPeriodoFechamento(p)} className={`px-6 py-3 rounded-xl text-[10px] uppercase transition-all ${periodoFechamento === p ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>{p}</button>
                    ))}
                </div>
                {periodoFechamento === 'personalizado' && (
                    <div className="flex gap-2 items-center"><input type="date" className="p-3 bg-white border rounded-xl font-bold text-xs" value={dataInicio} onChange={(e)=>setDataInicio(e.target.value)} /><span className="text-slate-400">ATÉ</span><input type="date" className="p-3 bg-white border rounded-xl font-bold text-xs" value={dataFim} onChange={(e)=>setDataFim(e.target.value)} /></div>
                )}
                <button onClick={exportarPlanilha} className="bg-slate-900 text-white px-6 py-4 rounded-2xl text-[10px] uppercase flex items-center gap-2 ml-auto shadow-xl"><Download size={16}/> Baixar CSV</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {['Dinheiro', 'PIX', 'Cartão', 'Vale', 'Sangria'].map(label => (
                <div key={label} className="bg-white p-8 rounded-[2.5rem] border shadow-sm text-center">
                  <p className="text-[10px] text-slate-400 uppercase mb-2">{label}</p>
                  <p className={`text-2xl font-black ${label === 'Sangria' ? 'text-red-500' : 'text-slate-800'}`}>R$ {Math.abs(stats.resumoPagos[label === 'Cartão' ? 'Cartão' : label === 'Vale' ? 'Vale' : label] || 0).toFixed(2)}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[3rem] border shadow-sm p-8">
                <h3 className="text-xs uppercase mb-6 flex items-center gap-2"><ArrowUpRight className="text-emerald-500"/> Histórico Detalhado (Admin)</h3>
                <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="text-[10px] text-slate-400 border-b"><tr><th className="pb-4">Item</th><th className="pb-4 text-center">Qtd</th><th className="pb-4">Valor Final</th><th className="pb-4 text-center">Estornar</th></tr></thead>
                        <tbody className="divide-y">
                            {stats.listaVendas.map(v => (
                                <tr key={v.id} className="hover:bg-slate-50"><td className="py-4 text-xs uppercase">{v.productName}</td><td className="py-4 text-center text-xs">{v.quantity} un</td><td className="py-4 text-emerald-600 text-xs font-black">R$ {(v.amount - (v.discountApplied || 0)).toFixed(2)} {v.discountApplied > 0 && <span className="text-red-400 ml-1">(-R$ {v.discountApplied})</span>}</td><td className="py-4 text-center"><button onClick={()=>handleCancelSale(v)} className="text-red-500 hover:scale-110 transition-transform"><Trash2 size={16}/></button></td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-emerald-600 p-16 rounded-[4rem] text-white shadow-2xl flex justify-between items-center">
                <div><p className="uppercase text-xs opacity-80">Saldo Total ({periodoFechamento})</p><h3 className="text-8xl tracking-tighter">R$ {stats.totalCaixaFinal.toFixed(2)}</h3></div>
                <Calculator size={120} className="opacity-20 hidden md:block"/>
            </div>
          </div>
        )}
      </main>

      {/* --- MODAIS --- */}
      {isProductModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-12 shadow-2xl relative font-black animate-in zoom-in">
            <button onClick={()=>{ setIsProductModalOpen(false); setEditingProduct(null); }} className="absolute top-10 right-10 text-slate-400"><X/></button>
            <h3 className="text-3xl mb-10 text-slate-800 uppercase">{editingProduct ? 'Editar' : 'Novo'} Item</h3>
            <form onSubmit={handleAddProduct} className="space-y-6 text-left font-black">
              <input name="name" placeholder="Nome" defaultValue={editingProduct?.name || ''} required className="w-full p-5 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-emerald-500 font-black" />
              <div className="grid grid-cols-2 gap-4">
                <input name="cost" type="number" step="0.01" placeholder="Custo R$" defaultValue={editingProduct?.cost || 0} required className="w-full p-4 bg-slate-50 rounded-2xl" />
                <input name="price" type="number" step="0.01" placeholder="Venda R$" defaultValue={editingProduct?.price || 0} required className="w-full p-4 bg-slate-50 rounded-2xl text-emerald-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input name="stock" type="number" step="0.01" placeholder="Estoque" defaultValue={editingProduct?.stock || 0} required className="w-full p-4 bg-slate-50 rounded-2xl" />
                <input name="minStock" type="number" step="0.01" placeholder="Mínimo" defaultValue={editingProduct?.minStock || 5} required className="w-full p-4 bg-slate-50 rounded-2xl" />
              </div>
              <select name="category" defaultValue={editingProduct?.category || 'Mercadinho'} className="w-full p-4 bg-slate-50 rounded-2xl outline-none appearance-none font-black">
                <option value="Mercadinho">📦 Mercadinho</option><option value="Padaria">🥐 Padaria</option><option value="Lanchonete">🍔 Lanchonete</option>
              </select>
              <button type="submit" disabled={issaving} className="w-full py-5 rounded-[2rem] font-black text-white bg-slate-900 hover:bg-emerald-600 uppercase text-xs">Confirmar</button>
            </form>
          </div>
        </div>
      )}

      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 z-50 font-black">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg p-12 shadow-2xl relative animate-in zoom-in text-center">
            <button onClick={()=>setIsCheckoutOpen(false)} className="absolute top-10 right-10 text-slate-400"><X/></button>
            <h3 className="text-3xl uppercase mb-8">Pagamento</h3>
            <div className="space-y-6">
              <div className="bg-slate-50 p-8 rounded-[2rem]">
                <p className="text-[10px] text-slate-400 uppercase mb-1">Total Final</p>
                <h4 className="text-6xl text-slate-900">R$ {cartTotal.toFixed(2)}</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full p-5 bg-slate-900 text-white rounded-2xl outline-none appearance-none text-center" value={selectedMethod} onChange={(e) => setSelectedMethod(e.target.value)}>
                  <option value="Dinheiro">💵 Dinheiro</option><option value="PIX">📱 PIX</option><option value="Cartão">💳 Cartão</option><option value="Alimentação">🍴 Vale</option>
                </select>
                <input type="number" placeholder="Recebido" className="w-full p-5 bg-slate-50 border-2 rounded-2xl text-center font-black" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} />
              </div>
              {selectedMethod === 'Dinheiro' && troco > 0 && <div className="bg-emerald-50 p-6 rounded-2xl flex justify-between items-center"><p className="text-emerald-700 text-xs uppercase">Troco</p><p className="text-4xl text-emerald-600 font-black">R$ {troco.toFixed(2)}</p></div>}
              <button onClick={finalizeSale} className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] uppercase shadow-xl font-black">Concluir</button>
            </div>
          </div>
        </div>
      )}

      {isSangriaModalOpen && (
        <div className="fixed inset-0 bg-red-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 font-black">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-12 shadow-2xl relative">
            <button onClick={()=>setIsSangriaModalOpen(false)} className="absolute top-10 right-10 text-slate-400"><X/></button>
            <h3 className="text-3xl mb-10 text-red-600 uppercase flex items-center gap-3 font-black">Sangria</h3>
            <form onSubmit={handleSangria} className="space-y-6">
                <input name="valor" type="number" step="0.01" required placeholder="Valor R$" className="w-full p-8 bg-slate-50 rounded-3xl text-center text-5xl text-red-600 outline-none font-black" />
                <input name="motivo" placeholder="Motivo" required className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-black" />
                <button type="submit" className="w-full py-5 rounded-[2rem] text-white bg-red-600 uppercase text-xs font-black shadow-xl">Confirmar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;