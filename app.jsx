import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import Swal from 'sweetalert2'; 
import { 
  getFirestore, collection, doc, onSnapshot, 
  addDoc, updateDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup
} from 'firebase/auth';
import { 
  LayoutDashboard, Package, ArrowUpRight, Plus, Search, 
  Trash2, Edit3, ShoppingCart, TrendingUp, AlertTriangle, 
  X, LogOut, Mail, Lock, CreditCard, Banknote, Smartphone
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE PROTEGIDA ---
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

// --- LISTA DE ADMINISTRADORES ---
const ADMIN_EMAILS = ["gabrielflorencio190@gmail.com", "miscileneflorencio50@gmail.com"];

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [issaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const productsRef = collection(db, 'artifacts', appId, 'public', 'data', 'products');
    const unsubProducts = onSnapshot(productsRef, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const transRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const unsubTrans = onSnapshot(transRef, (snapshot) => {
      const tList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenação segura para aceitar formatos antigos e novos de data
      setTransactions(tList.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
        return timeB - timeA;
      }));
    });

    return () => { unsubProducts(); unsubTrans(); };
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        Swal.fire('Sucesso!', 'Conta criada!', 'success');
      }
    } catch (error) { setAuthError('Falha no acesso. Verifique os dados.'); }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } catch (error) { Swal.fire('Erro', 'Falha no login com Google.', 'error'); }
  };

  const handleLogout = () => signOut(auth);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (issaving) return; 
    setIsSaving(true); 
    const formData = new FormData(e.target);
    const productData = {
      name: formData.get('name'),
      price: parseFloat(formData.get('price')),
      cost: parseFloat(formData.get('cost')),
      stock: parseInt(formData.get('stock')),
      category: formData.get('category'),
      minStock: parseInt(formData.get('minStock') || 5)
    };

    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'products');
      if (editingProduct) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', editingProduct.id), productData);
      } else {
        await addDoc(colRef, productData);
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
      Swal.fire({ icon: 'success', title: 'Salvo!', timer: 1000, showConfirmButton: false });
    } catch (err) { Swal.fire('Erro', 'Falha ao salvar.', 'error'); } finally { setIsSaving(false); }
  };

  const handleDeleteProduct = async (id) => {
    if (!ADMIN_EMAILS.includes(user.email)) {
      Swal.fire({ icon: 'error', title: 'Acesso Negado', text: 'Apenas administradores podem excluir itens.' });
      return;
    }
    const result = await Swal.fire({ title: 'Excluir?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim' });
    if (result.isConfirmed) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id));
      Swal.fire('Removido!', '', 'success');
    }
  };

  const handleRecordSale = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const productId = formData.get('productId');
    const quantity = parseInt(formData.get('quantity'));
    const paymentMethod = formData.get('paymentMethod');
    const product = products.find(p => p.id === productId);

    if (!product || product.stock < quantity) {
      Swal.fire('Erro', 'Estoque insuficiente!', 'error');
      return;
    }

    try {
      const novoEstoque = product.stock - quantity;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
        type: 'venda',
        productName: product.name,
        productId: product.id,
        quantity,
        amount: product.price * quantity,
        profit: (product.price - product.cost) * quantity,
        paymentMethod,
        timestamp: serverTimestamp(),
        userEmail: user.email
      });
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', product.id), { stock: novoEstoque });
      setIsSaleModalOpen(false);
      if (novoEstoque <= product.minStock) {
        Swal.fire({ icon: 'warning', title: 'Estoque Baixo!', html: `${product.name} restam ${novoEstoque} un.` });
      } else {
        Swal.fire({ icon: 'success', title: 'Venda Feita!', timer: 1000, showConfirmButton: false });
      }
    } catch (err) { console.error(err); }
  };

  const stats = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicioHoje = hoje.getTime();

    const vendasTotaisArray = transactions.filter(t => t.type === 'venda');
    const vendasHojeArray = transactions.filter(t => {
      const dataTrans = t.timestamp?.toMillis ? t.timestamp.toMillis() : t.timestamp;
      return t.type === 'venda' && dataTrans >= inicioHoje;
    });

    const totalSales = vendasTotaisArray.reduce((acc, curr) => acc + curr.amount, 0);
    const totalProfit = vendasTotaisArray.reduce((acc, curr) => acc + curr.profit, 0);
    const totalHoje = vendasHojeArray.reduce((acc, curr) => acc + curr.amount, 0);
    const lucroHoje = vendasHojeArray.reduce((acc, curr) => acc + curr.profit, 0);

    const porMetodo = {
      dinheiro: vendasHojeArray.filter(v => v.paymentMethod === 'Dinheiro').reduce((acc, v) => acc + v.amount, 0),
      pix: vendasHojeArray.filter(v => v.paymentMethod === 'PIX').reduce((acc, v) => acc + v.amount, 0),
      cartao: vendasHojeArray.filter(v => ['Crédito', 'Débito', 'Alimentação'].includes(v.paymentMethod)).reduce((acc, v) => acc + v.amount, 0)
    };

    const lowStockItems = products.filter(p => p.stock <= p.minStock).length;
    const inventoryValue = products.reduce((acc, curr) => acc + (curr.cost * curr.stock), 0);

    return { totalSales, totalProfit, lowStockItems, inventoryValue, totalHoje, lucroHoje, porMetodo };
  }, [transactions, products]);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-blue-600 border-t-2"></div></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-8 space-y-6">
          <div className="text-center">
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white"><ShoppingCart size={32}/></div>
            <h1 className="text-2xl font-bold">MercadinhoPro</h1>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {authError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs">{authError}</div>}
            <div className="relative"><Mail className="absolute left-3 top-3 text-gray-400" size={20}/><input type="email" placeholder="E-mail" required className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl" value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
            <div className="relative"><Lock className="absolute left-3 top-3 text-gray-400" size={20}/><input type="password" placeholder="Senha" required className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl" value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all">{authMode === 'login' ? 'Entrar' : 'Criar Conta'}</button>
            <button type="button" onClick={handleGoogleLogin} className="w-full bg-white border border-gray-300 py-3 rounded-xl flex items-center justify-center gap-2 mt-2 font-medium"> <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" /> Google </button>
            <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full text-sm text-gray-500 mt-4"> {authMode === 'login' ? 'Cadastre-se' : 'Fazer Login'} </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-10 text-xl font-bold"><ShoppingCart /> MercadinhoPro</div>
        <nav className="space-y-2 flex-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 ${activeTab === 'dashboard' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><LayoutDashboard size={20}/> Dashboard</button>
          <button onClick={() => setActiveTab('estoque')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 ${activeTab === 'estoque' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><Package size={20}/> Estoque</button>
          <button onClick={() => setActiveTab('caixa')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 ${activeTab === 'caixa' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><TrendingUp size={20}/> Caixa</button>
        </nav>
        <button onClick={handleLogout} className="mt-auto flex items-center gap-2 text-red-400 p-3 hover:bg-red-500/10 rounded-lg"><LogOut size={18}/> Sair</button>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold capitalize">{activeTab}</h2>
          <div className="flex gap-2">
            <button onClick={() => {setEditingProduct(null); setIsProductModalOpen(true)}} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md"><Plus size={16}/> Novo Produto</button>
            <button onClick={() => setIsSaleModalOpen(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md"><ArrowUpRight size={16}/> Venda</button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-emerald-600 p-8 rounded-[2rem] text-white shadow-lg shadow-emerald-100">
                <p className="text-emerald-100 text-xs font-bold uppercase mb-1">Vendas de HOJE</p>
                <p className="text-4xl font-black">R$ {stats.totalHoje.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
              </div>
              <div className="bg-blue-600 p-8 rounded-[2rem] text-white shadow-lg shadow-blue-100">
                <p className="text-blue-100 text-xs font-bold uppercase mb-1">Lucro de HOJE</p>
                <p className="text-4xl font-black">R$ {stats.lucroHoje.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl border flex items-center justify-between"><div className="text-slate-500 text-xs font-bold">💵 DINHEIRO</div><div className="font-black text-slate-800">R$ {stats.porMetodo.dinheiro.toFixed(2)}</div></div>
              <div className="bg-white p-6 rounded-2xl border flex items-center justify-between"><div className="text-blue-500 text-xs font-bold">📱 PIX</div><div className="font-black text-slate-800">R$ {stats.porMetodo.pix.toFixed(2)}</div></div>
              <div className="bg-white p-6 rounded-2xl border flex items-center justify-between"><div className="text-purple-500 text-xs font-bold">💳 CARTÕES</div><div className="font-black text-slate-800">R$ {stats.porMetodo.cartao.toFixed(2)}</div></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-70">
              <div className="bg-white p-6 rounded-xl border text-center"><p className="text-gray-400 text-xs">Total Acumulado</p><p className="text-xl font-bold">R$ {stats.totalSales.toFixed(2)}</p></div>
              <div className="bg-white p-6 rounded-xl border text-center"><p className="text-gray-400 text-xs">Capital Estoque</p><p className="text-xl font-bold">R$ {stats.inventoryValue.toFixed(2)}</p></div>
              <div className={`bg-white p-6 rounded-xl border text-center ${stats.lowStockItems > 0 ? 'border-red-200 bg-red-50' : ''}`}><p className="text-gray-400 text-xs">Itens Críticos</p><p className={`text-xl font-bold ${stats.lowStockItems > 0 ? 'text-red-600' : ''}`}>{stats.lowStockItems}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'estoque' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex gap-2"><Search className="text-gray-400"/><input className="bg-transparent outline-none w-full" placeholder="Buscar..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)}/></div>
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400"><tr><th className="p-4">Produto</th><th className="p-4">Qtd</th><th className="p-4">Venda</th><th className="p-4 text-center">Ações</th></tr></thead>
              <tbody>{filteredProducts.map(p=>(
                <tr key={p.id} className={`border-t ${p.stock <= p.minStock ? 'bg-red-50/50' : ''}`}>
                  <td className="p-4 font-bold">{p.name} {p.stock <= p.minStock && <span className="ml-2 text-[8px] bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">REPOR</span>}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${p.stock <= p.minStock ? 'text-red-600' : 'text-blue-600'}`}>{p.stock} un</span></td>
                  <td className="p-4 font-bold">R$ {p.price.toFixed(2)}</td>
                  <td className="p-4 flex gap-3 justify-center"><button onClick={()=>{setEditingProduct(p); setIsProductModalOpen(true)}} className="text-blue-600"><Edit3 size={18}/></button><button onClick={()=>handleDeleteProduct(p.id)} className="text-red-600"><Trash2 size={18}/></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {activeTab === 'caixa' && (
          <div className="bg-white rounded-xl border p-6">
            <table className="w-full text-left">
              <thead className="text-gray-400 text-xs border-b"><tr><th className="pb-3">Data</th><th className="pb-3">Item</th><th className="pb-3">Pagamento</th><th className="pb-3 text-right">Valor</th></tr></thead>
              <tbody>{transactions.map(t=>(
                <tr key={t.id} className="border-b text-sm">
                  <td className="py-4 text-gray-500">{new Date(t.timestamp?.toMillis ? t.timestamp.toMillis() : t.timestamp).toLocaleDateString()}</td>
                  <td className="py-4 font-bold">{t.productName} (x{t.quantity})</td>
                  <td className="py-4"><span className="text-[10px] bg-slate-100 px-2 py-1 rounded-md font-bold uppercase">{t.paymentMethod || 'Dinheiro'}</span></td>
                  <td className="py-4 text-right font-black text-emerald-600">R$ {t.amount.toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </main>

      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">{editingProduct ? 'Editar' : 'Novo'} Produto</h3>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <input name="name" placeholder="Nome" defaultValue={editingProduct?.name} required className="w-full p-4 border-2 border-gray-50 bg-gray-50 rounded-2xl outline-none focus:border-blue-500 font-bold" />
              <div className="grid grid-cols-2 gap-4">
                <input name="cost" type="number" step="0.01" placeholder="Custo R$" defaultValue={editingProduct?.cost} required className="w-full p-4 bg-gray-50 rounded-2xl outline-none" />
                <input name="price" type="number" step="0.01" placeholder="Venda R$" defaultValue={editingProduct?.price} required className="w-full p-4 bg-gray-50 rounded-2xl outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input name="stock" type="number" placeholder="Estoque" defaultValue={editingProduct?.stock} required className="w-full p-4 bg-gray-50 rounded-2xl outline-none" />
                <input name="minStock" type="number" placeholder="Mínimo" defaultValue={editingProduct?.minStock} required className="w-full p-4 bg-gray-50 rounded-2xl outline-none" />
              </div>
              <input name="category" placeholder="Categoria" defaultValue={editingProduct?.category} required className="w-full p-4 bg-gray-50 rounded-2xl outline-none" />
              <button type="submit" disabled={issaving} className={`w-full py-4 rounded-2xl font-bold text-white transition-all ${issaving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {issaving ? 'Salvando...' : 'Salvar Produto'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isSaleModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-10 shadow-2xl">
            <h3 className="text-2xl font-bold mb-8 text-center">Registrar Venda</h3>
            <form onSubmit={handleRecordSale} className="space-y-6">
              <select name="productId" required className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-2 border-transparent focus:border-emerald-500 outline-none">
                <option value="">Selecione o produto...</option>
                {products.filter(p => p.stock > 0).map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Saldo: {p.stock})</option>
                ))}
              </select>
              <div className="grid grid-cols-1 gap-4">
                <input name="quantity" type="number" min="1" placeholder="Quantidade" required className="w-full p-5 bg-gray-50 rounded-2xl font-bold text-center text-xl" />
                <select name="paymentMethod" required className="w-full p-5 bg-gray-50 rounded-2xl font-bold text-center">
                    <option value="Dinheiro">💵 Dinheiro</option>
                    <option value="PIX">📱 PIX</option>
                    <option value="Crédito">💳 Cartão Crédito</option>
                    <option value="Débito">💳 Cartão Débito</option>
                    <option value="Alimentação">🍴 Vale Alimentação</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-5 rounded-[1.5rem] font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg">Confirmar Venda</button>
              <button type="button" onClick={()=>setIsSaleModalOpen(false)} className="w-full text-gray-400 font-bold">Cancelar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;