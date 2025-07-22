import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, BarController, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, Title, Tooltip, Legend);

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBGgrLy-olObxI97-am0Hc3MGj9-R9qIWA",
  authDomain: "escenarios-lma.firebaseapp.com",
  projectId: "escenarios-lma",
  storageBucket: "escenarios-lma.appspot.com",
  messagingSenderId: "460994351152",
  appId: "1:460994351152:web:2dee3f2b3358a6e5deddf5"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Helper Functions
const formatCurrency = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
const formatPercent = (value) => new Intl.NumberFormat('es-CO', { style: 'percent', minimumFractionDigits: 1 }).format(value);

const SERVICIOS = [
    { id: 'tab_sencillo_d', name: 'TAB Sencillo Diurno', tipo: 'TAB', tarifaDefault: 150000, mixDefault: 20 },
    { id: 'tab_sencillo_n', name: 'TAB Sencillo Nocturno', tipo: 'TAB', tarifaDefault: 180000, mixDefault: 10 },
    { id: 'tab_redondo_d', name: 'TAB Redondo Diurno', tipo: 'TAB', tarifaDefault: 200000, mixDefault: 10 },
    { id: 'tab_redondo_n', name: 'TAB Redondo Nocturno', tipo: 'TAB', tarifaDefault: 230000, mixDefault: 5 },
    { id: 'tam_sencillo_d', name: 'TAM Sencillo Diurno', tipo: 'TAM', tarifaDefault: 400000, mixDefault: 20 },
    { id: 'tam_sencillo_n', name: 'TAM Sencillo Nocturno', tipo: 'TAM', tarifaDefault: 480000, mixDefault: 10 },
    { id: 'tam_redondo_d', name: 'TAM Redondo Diurno', tipo: 'TAM', tarifaDefault: 550000, mixDefault: 10 },
    { id: 'tam_redondo_n', name: 'TAM Redondo Nocturno', tipo: 'TAM', tarifaDefault: 660000, mixDefault: 5 },
    { id: 'tab_fallido', name: 'TAB Fallido', tipo: 'TAB', tarifaDefault: 90000, mixDefault: 5 },
    { id: 'tam_fallido', name: 'TAM Fallido', tipo: 'TAM', tarifaDefault: 240000, mixDefault: 5 },
];

const initialInputs = {
    salario_conductor_tab: 1800000,
    salario_auxiliar_tab: 1600000,
    salario_conductor_tam: 1800000,
    salario_auxiliar_tam: 1600000,
    salario_medico_tam: 5000000,
    cargas_prestacionales: 52,
    nomina_admin: 6000000,
    arriendo: 2500000,
    servicios_publicos: 800000,
    seguros: 1000000,
    licencias: 500000,
    software: 700000,
    depreciacion_vehiculo: 2000000,
    depreciacion_equipo_tab: 500000,
    depreciacion_equipo_tam: 1500000,
    costo_combustible_km: 500,
    costo_mantenimiento_km: 200,
    costo_insumos_tab: 20000,
    costo_insumos_tam: 80000,
    num_tab: 2,
    num_tam: 1,
    dias_operacion: 30,
    viajes_por_dia: 4,
    km_por_viaje: 25,
    serviciosMix: SERVICIOS.map(s => ({ id: s.id, mix: s.mixDefault })),
    clientes: [
        { id: 1, name: 'Aseguradora Alfa', mix: 50, tarifas: SERVICIOS.reduce((acc, s) => ({ ...acc, [s.id]: s.tarifaDefault }), {}) },
        { id: 2, name: 'Cliente Particular', mix: 30, tarifas: SERVICIOS.reduce((acc, s) => ({ ...acc, [s.id]: s.tarifaDefault * 1.2 }), {}) },
        { id: 3, name: 'Convenio Empresa', mix: 20, tarifas: SERVICIOS.reduce((acc, s) => ({ ...acc, [s.id]: s.tarifaDefault * 0.9 }), {}) },
    ],
    links: {}
};

// Components
const LinkModal = ({ isOpen, onClose, onSave, currentLink, inputLabel }) => {
    const [link, setLink] = useState('');

    useEffect(() => {
        setLink(currentLink || '');
    }, [currentLink]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(link);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-30">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-lg font-bold mb-2">Fuente de Datos para:</h3>
                <p className="text-md text-gray-700 mb-4">{inputLabel}</p>
                <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://ejemplo.com/reporte"
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 mb-4"
                />
                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Guardar</button>
                </div>
            </div>
        </div>
    );
};

const AccordionItem = ({ title, children, isOpen, onClick }) => (
    <div className="accordion-item border rounded-lg">
        <button onClick={onClick} className="accordion-header w-full flex justify-between items-center p-4 text-left font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100">
            <span>{title}</span>
            <svg className={`accordion-icon w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <div className={`accordion-content overflow-hidden transition-max-height duration-300 ease-out ${isOpen ? 'max-h-screen' : 'max-h-0'}`}>
            <div className="p-4 space-y-4">{children}</div>
        </div>
    </div>
);

const InputField = ({ label, id, value, onChange, type = "number", link, onLinkClick }) => (
    <div>
        <div className="flex justify-between items-center">
            <label htmlFor={id} className="block text-sm font-medium text-gray-600">{label}</label>
            <a href={link || '#'} 
               target="_blank" 
               rel="noopener noreferrer"
               onClick={(e) => { if (!link) { e.preventDefault(); onLinkClick(); } }} 
               title={link || 'Añadir fuente de datos'}
               className={`text-lg ${link ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}>
                🔗
            </a>
        </div>
        <input type={type} id={id} name={id} value={value} onChange={onChange} className="input-field mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"/>
    </div>
);

const BarChart = ({ data, labels }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }
        const ctx = chartRef.current.getContext('2d');
        chartInstance.current = new ChartJS(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Margen de Utilidad (%)',
                    data,
                    backgroundColor: (c) => c.raw >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)',
                    borderColor: (c) => c.raw >= 0 ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: { x: { beginAtZero: true, ticks: { callback: (v) => v + '%' } } },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c) => `${c.dataset.label || ''}: ${c.parsed.x.toFixed(1)}%` } }
                }
            }
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [data, labels]);

    return <canvas ref={chartRef} />;
};

const ScenarioManager = ({ scenarios, onSave, onLoad, onDelete, user }) => {
    const [name, setName] = useState('');

    const handleSave = () => {
        if (name.trim()) {
            onSave(name);
            setName('');
        }
    };

    if (!user) {
        return (
            <div className="bg-gray-50 p-4 rounded-lg border border-dashed text-center">
                <p className="text-sm text-gray-600">Inicia sesión para guardar y cargar escenarios.</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 p-4 rounded-lg border border-dashed">
            <h3 className="font-semibold text-gray-700 mb-2">Gestión de Escenarios</h3>
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre del escenario"
                    className="flex-grow border-gray-300 rounded-md shadow-sm p-2"
                />
                <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Guardar</button>
            </div>
            <div className="space-y-2">
                {scenarios.map(sc => (
                    <div key={sc.id} className="flex justify-between items-center bg-white p-2 rounded-md border">
                        <span className="text-sm font-medium">{sc.name}</span>
                        <div className="space-x-2">
                            <button onClick={() => onLoad(sc.id)} className="text-sm text-green-600 hover:text-green-800">Cargar</button>
                            <button onClick={() => onDelete(sc.id)} className="text-sm text-red-600 hover:text-red-800">Eliminar</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Auth = ({ user }) => {
    const handleLogin = () => {
        signInAnonymously(auth).catch(error => {
            console.error("Error en login anónimo:", error);
            signInWithPopup(auth, provider).catch(err => console.error("Error en login con Google:", err));
        });
    };
    const handleLogout = () => {
        signOut(auth);
    };

    return (
        <div className="absolute top-4 right-4 sm:right-6 lg:right-8">
            {user ? (
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 hidden sm:inline">{user.isAnonymous ? "Usuario Anónimo" : (user.displayName || user.email)}</span>
                    <button onClick={handleLogout} className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600">Salir</button>
                </div>
            ) : (
                <button onClick={handleLogin} className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Iniciar Sesión</button>
            )}
        </div>
    );
};


// Main App Component
export default function App() {
    const [activeTab, setActiveTab] = useState('resultados');
    const [openAccordion, setOpenAccordion] = useState('nomina');
    const [inputs, setInputs] = useState(initialInputs);
    const [results, setResults] = useState({});
    const [scenarios, setScenarios] = useState([]);
    const [user, setUser] = useState(null);
    const [modalState, setModalState] = useState({ isOpen: false, inputId: null, inputLabel: '' });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const fetchScenarios = useCallback(async (currentUser) => {
        if (!currentUser) {
            setScenarios([]);
            return;
        }
        const q = query(collection(db, "scenarios"), where("uid", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        const userScenarios = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setScenarios(userScenarios);
    }, []);

    useEffect(() => {
        fetchScenarios(user);
    }, [user, fetchScenarios]);


    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setInputs(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    }, []);

    const handleMixChange = useCallback((id, value) => {
        setInputs(prev => ({
            ...prev,
            serviciosMix: prev.serviciosMix.map(s => s.id === id ? { ...s, mix: parseFloat(value) || 0 } : s)
        }));
    }, []);

    const handleClientChange = useCallback((clientId, field, value) => {
        setInputs(prev => ({
            ...prev,
            clientes: prev.clientes.map(c => c.id === clientId ? { ...c, [field]: value } : c)
        }));
    }, []);

    const handleClientTarifaChange = useCallback((clientId, serviceId, value) => {
        setInputs(prev => ({
            ...prev,
            clientes: prev.clientes.map(c => c.id === clientId ? { ...c, tarifas: { ...c.tarifas, [serviceId]: parseFloat(value) || 0 } } : c)
        }));
    }, []);

    const addClient = () => {
        const newClient = {
            id: Date.now(),
            name: `Nuevo Cliente ${inputs.clientes.length + 1}`,
            mix: 0,
            tarifas: SERVICIOS.reduce((acc, s) => ({ ...acc, [s.id]: s.tarifaDefault }), {})
        };
        setInputs(prev => ({ ...prev, clientes: [...prev.clientes, newClient] }));
    };

    const removeClient = (clientId) => {
        setInputs(prev => ({ ...prev, clientes: prev.clientes.filter(c => c.id !== clientId) }));
    };
    
    const openLinkModal = (inputId, inputLabel) => {
        setModalState({ isOpen: true, inputId, inputLabel });
    };

    const closeLinkModal = () => {
        setModalState({ isOpen: false, inputId: null, inputLabel: '' });
    };

    const saveLink = (link) => {
        setInputs(prev => ({
            ...prev,
            links: {
                ...prev.links,
                [modalState.inputId]: link
            }
        }));
    };


    const calculate = useCallback(() => {
        const cargas = 1 + (inputs.cargas_prestacionales / 100);
        const costoNominaMensualTab = (inputs.salario_conductor_tab + inputs.salario_auxiliar_tab) * cargas;
        const costoNominaMensualTam = (inputs.salario_conductor_tam + inputs.salario_auxiliar_tam + inputs.salario_medico_tam) * cargas;
        const costosFijosComunesAdmin = inputs.arriendo + inputs.servicios_publicos + inputs.seguros + inputs.licencias + inputs.software + inputs.nomina_admin;
        const totalAmbulancias = inputs.num_tab + inputs.num_tam;
        const costoFijoComunPorAmbulancia = totalAmbulancias > 0 ? costosFijosComunesAdmin / totalAmbulancias : 0;
        const costoDepreciacionMensualTab = inputs.depreciacion_vehiculo + inputs.depreciacion_equipo_tab;
        const costoDepreciacionMensualTam = inputs.depreciacion_vehiculo + inputs.depreciacion_equipo_tam;
        const costoFijoTotalMensualTab = costoFijoComunPorAmbulancia + costoNominaMensualTab + costoDepreciacionMensualTab;
        const costoFijoTotalMensualTam = costoFijoComunPorAmbulancia + costoNominaMensualTam + costoDepreciacionMensualTam;
        const costoVariableViajeBase = (inputs.costo_combustible_km + inputs.costo_mantenimiento_km) * inputs.km_por_viaje;
        const variableViajeTab = costoVariableViajeBase + inputs.costo_insumos_tab;
        const variableViajeTam = costoVariableViajeBase + inputs.costo_insumos_tam;
        const viajesMensualesPorAmbulancia = inputs.dias_operacion * inputs.viajes_por_dia;
        
        if (viajesMensualesPorAmbulancia === 0) return;

        const costoServicio = {};
        SERVICIOS.forEach(s => {
            const costoFijoMensual = s.tipo === 'TAB' ? costoFijoTotalMensualTab : costoFijoTotalMensualTam;
            const costoVariable = s.tipo === 'TAB' ? variableViajeTab : variableViajeTam;
            costoServicio[s.id] = (costoFijoMensual / viajesMensualesPorAmbulancia) + costoVariable;
        });

        const totalViajesMensuales = viajesMensualesPorAmbulancia * totalAmbulancias;
        let facturacionTotal = 0;
        let costoTotalOperacion = 0;
        let rentabilidadPorServicio = {};
        let rentabilidadPorCliente = {};

        inputs.clientes.forEach(cliente => {
            rentabilidadPorCliente[cliente.name] = { facturacion: 0, costo: 0, mix: cliente.mix };
        });

        inputs.serviciosMix.forEach(sm => {
            const servicioInfo = SERVICIOS.find(s => s.id === sm.id);
            const viajesEsteServicio = totalViajesMensuales * (sm.mix / 100);
            const costoEsteServicio = costoServicio[sm.id];
            
            let facturacionEsteServicio = 0;
            inputs.clientes.forEach(cliente => {
                const viajesClienteServicio = viajesEsteServicio * (cliente.mix / 100);
                const facturacionClienteServicio = viajesClienteServicio * cliente.tarifas[sm.id];
                facturacionEsteServicio += facturacionClienteServicio;
                
                rentabilidadPorCliente[cliente.name].facturacion += facturacionClienteServicio;
                rentabilidadPorCliente[cliente.name].costo += viajesClienteServicio * costoEsteServicio;
            });

            const costoTotalEsteServicio = viajesEsteServicio * costoEsteServicio;
            const utilidadEsteServicio = facturacionEsteServicio - costoTotalEsteServicio;
            const margenEsteServicio = facturacionEsteServicio > 0 ? utilidadEsteServicio / facturacionEsteServicio : 0;
            
            rentabilidadPorServicio[sm.id] = { name: servicioInfo.name, mix: sm.mix, margen: margenEsteServicio, utilidad: utilidadEsteServicio };
            facturacionTotal += facturacionEsteServicio;
            costoTotalOperacion += costoTotalEsteServicio;
        });

        const utilidadTotal = facturacionTotal - costoTotalOperacion;

        const costoFijosTotalesOperacion = (costoFijoTotalMensualTab * inputs.num_tab) + (costoFijoTotalMensualTam * inputs.num_tam) - (costoFijoComunPorAmbulancia * totalAmbulancias) + costosFijosComunesAdmin;
        let contribucionPonderadaTotal = 0;
        let precioPonderadoGlobal = 0;
        
        inputs.serviciosMix.forEach(sm => {
            let precioPonderadoServicio = 0;
            inputs.clientes.forEach(c => {
                precioPonderadoServicio += c.tarifas[sm.id] * (c.mix / 100);
            });
            const costoVariableServicio = SERVICIOS.find(s => s.id === sm.id).tipo === 'TAB' ? variableViajeTab : variableViajeTam;
            contribucionPonderadaTotal += (precioPonderadoServicio - costoVariableServicio) * (sm.mix / 100);
            precioPonderadoGlobal += precioPonderadoServicio * (sm.mix/100);
        });
        
        const peViajes = contribucionPonderadaTotal > 0 ? costoFijosTotalesOperacion / contribucionPonderadaTotal : Infinity;
        const peFacturacion = peViajes !== Infinity ? peViajes * precioPonderadoGlobal : Infinity;

        setResults({
            facturacionTotal,
            costoTotalOperacion,
            utilidadTotal,
            rentabilidadPorServicio,
            rentabilidadPorCliente,
            peViajes,
            peFacturacion,
        });
    }, [inputs]);

    useEffect(() => {
        calculate();
    }, [calculate]);

    // Scenario handlers
    const handleSaveScenario = async (name) => {
        if (!user) return;
        const scenarioData = {
            name,
            uid: user.uid,
            inputs: { ...inputs },
            createdAt: new Date()
        };
        await addDoc(collection(db, "scenarios"), scenarioData);
        fetchScenarios(user);
    };
    const handleLoadScenario = (id) => {
        const scenarioToLoad = scenarios.find(sc => sc.id === id);
        if (scenarioToLoad) {
            setInputs(scenarioToLoad.inputs);
        }
    };
    const handleDeleteScenario = async (id) => {
        if (!user) return;
        await deleteDoc(doc(db, "scenarios", id));
        fetchScenarios(user);
    };

    const totalServiciosMix = inputs.serviciosMix.reduce((sum, s) => sum + s.mix, 0);
    const totalClientesMix = inputs.clientes.reduce((sum, c) => sum + c.mix, 0);

    return (
        <div className="min-h-screen flex flex-col">
            <header className="bg-white shadow-sm sticky top-0 z-20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 relative">
                    <h1 className="text-2xl font-bold text-gray-800">Simulador</h1>
                    <p className="text-gray-500">LMA</p>
                    <Auth user={user} />
                </div>
            </header>

            <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
                <LinkModal 
                    isOpen={modalState.isOpen} 
                    onClose={closeLinkModal} 
                    onSave={saveLink}
                    currentLink={inputs.links[modalState.inputId]}
                    inputLabel={modalState.inputLabel}
                />
                <div className="mb-6 border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setActiveTab('resultados')} className={`tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'resultados' ? 'active' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                            Dashboard de Resultados
                        </button>
                        <button onClick={() => setActiveTab('control')} className={`tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'control' ? 'active' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                            Panel de Control
                        </button>
                    </nav>
                </div>

                <div id="tab-content">
                    {activeTab === 'resultados' && (
                        <div id="content-resultados" className="space-y-8">
                            <div className="bg-white p-6 rounded-xl shadow-lg result-card">
                                <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4">📊 Resultados Globales de la Operación (Mensual)</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-sm text-gray-500">Facturación Total Estimada</p>
                                        <p className="text-2xl font-bold text-green-600">{formatCurrency(results.facturacionTotal || 0)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Costo Total de Operación</p>
                                        <p className="text-2xl font-bold text-red-600">{formatCurrency(results.costoTotalOperacion || 0)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Utilidad / Pérdida Neta</p>
                                        <p className={`text-2xl font-bold ${results.utilidadTotal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(results.utilidadTotal || 0)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-lg result-card">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Análisis de Rentabilidad por Cliente</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mix</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Margen Prom.</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Utilidad Total Est.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {results.rentabilidadPorCliente && Object.entries(results.rentabilidadPorCliente).map(([name, data]) => {
                                                const utilidad = data.facturacion - data.costo;
                                                const margen = data.facturacion > 0 ? utilidad / data.facturacion : 0;
                                                return (
                                                    <tr key={name}>
                                                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{name}</td>
                                                        <td className="px-4 py-2 text-sm text-gray-700">{data.mix.toFixed(1)}%</td>
                                                        <td className={`px-4 py-2 text-sm font-semibold ${margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(margen)}</td>
                                                        <td className={`px-4 py-2 text-sm font-semibold ${utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(utilidad)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-xl shadow-lg result-card">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Análisis de Rentabilidad por Tipo de Servicio</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mix</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Margen Prom.</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Utilidad Total Est.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {results.rentabilidadPorServicio && Object.values(results.rentabilidadPorServicio).sort((a,b) => b.utilidad - a.utilidad).map(rs => (
                                                <tr key={rs.name}>
                                                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{rs.name}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-700">{rs.mix.toFixed(1)}%</td>
                                                    <td className={`px-4 py-2 text-sm font-semibold ${rs.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(rs.margen)}</td>
                                                    <td className={`px-4 py-2 text-sm font-semibold ${rs.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(rs.utilidad)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-lg result-card border-t-4 border-yellow-500">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Análisis de Punto de Equilibrio Mensual</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                                    <div>
                                        <p className="text-sm text-gray-500">Viajes totales para cubrir costos</p>
                                        <p className="text-2xl font-bold text-yellow-800">{isFinite(results.peViajes) ? Math.ceil(results.peViajes).toLocaleString('es-CO') + ' viajes' : 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Facturación necesaria</p>
                                        <p className="text-2xl font-bold text-yellow-800">{isFinite(results.peFacturacion) ? formatCurrency(results.peFacturacion) : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-lg">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Comparativo: Margen de Utilidad por Servicio</h3>
                                <div className="h-80 w-full">
                                    <BarChart 
                                        labels={results.rentabilidadPorServicio ? Object.values(results.rentabilidadPorServicio).map(rs => rs.name) : []}
                                        data={results.rentabilidadPorServicio ? Object.values(results.rentabilidadPorServicio).map(rs => rs.margen * 100) : []}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'control' && (
                        <div id="content-control">
                            <div className="bg-white p-6 rounded-xl shadow-lg space-y-2 self-start">
                                <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4">⚙️ Panel de Control</h2>
                                <ScenarioManager scenarios={scenarios} onSave={handleSaveScenario} onLoad={handleLoadScenario} onDelete={handleDeleteScenario} user={user} />
                                <div id="accordion-container" className="space-y-2 pt-4">
                                    <AccordionItem title="Costos de Nómina Mensual" isOpen={openAccordion === 'nomina'} onClick={() => setOpenAccordion(openAccordion === 'nomina' ? null : 'nomina')}>
                                         <h4 className="font-semibold text-gray-600">Tripulación Básica (TAB)</h4>
                                         <InputField label="Salario Conductor" id="salario_conductor_tab" value={inputs.salario_conductor_tab} onChange={handleInputChange} link={inputs.links?.salario_conductor_tab} onLinkClick={() => openLinkModal('salario_conductor_tab', 'Salario Conductor (TAB)')} />
                                         <InputField label="Salario Auxiliar de Enfermería" id="salario_auxiliar_tab" value={inputs.salario_auxiliar_tab} onChange={handleInputChange} link={inputs.links?.salario_auxiliar_tab} onLinkClick={() => openLinkModal('salario_auxiliar_tab', 'Salario Auxiliar (TAB)')} />
                                         <h4 className="font-semibold text-gray-600">Tripulación Medicalizada (TAM)</h4>
                                         <InputField label="Salario Conductor" id="salario_conductor_tam" value={inputs.salario_conductor_tam} onChange={handleInputChange} link={inputs.links?.salario_conductor_tam} onLinkClick={() => openLinkModal('salario_conductor_tam', 'Salario Conductor (TAM)')} />
                                         <InputField label="Salario Auxiliar de Enfermería" id="salario_auxiliar_tam" value={inputs.salario_auxiliar_tam} onChange={handleInputChange} link={inputs.links?.salario_auxiliar_tam} onLinkClick={() => openLinkModal('salario_auxiliar_tam', 'Salario Auxiliar (TAM)')} />
                                         <InputField label="Salario Médico" id="salario_medico_tam" value={inputs.salario_medico_tam} onChange={handleInputChange} link={inputs.links?.salario_medico_tam} onLinkClick={() => openLinkModal('salario_medico_tam', 'Salario Médico (TAM)')} />
                                         <h4 className="font-semibold text-gray-600">Cargas y Administración</h4>
                                         <InputField label="Cargas Prestacionales y Seg. Social (%)" id="cargas_prestacionales" value={inputs.cargas_prestacionales} onChange={handleInputChange} link={inputs.links?.cargas_prestacionales} onLinkClick={() => openLinkModal('cargas_prestacionales', 'Cargas Prestacionales (%)')} />
                                         <InputField label="Nómina Administrativa (Total)" id="nomina_admin" value={inputs.nomina_admin} onChange={handleInputChange} link={inputs.links?.nomina_admin} onLinkClick={() => openLinkModal('nomina_admin', 'Nómina Administrativa')} />
                                    </AccordionItem>
                                    <AccordionItem title="Costos Fijos Operativos Mensuales" isOpen={openAccordion === 'fijos'} onClick={() => setOpenAccordion(openAccordion === 'fijos' ? null : 'fijos')}>
                                        <InputField label="Arriendo Base Operativa" id="arriendo" value={inputs.arriendo} onChange={handleInputChange} link={inputs.links?.arriendo} onLinkClick={() => openLinkModal('arriendo', 'Arriendo Base Operativa')} />
                                        <InputField label="Servicios Públicos (Agua, Luz, Internet)" id="servicios_publicos" value={inputs.servicios_publicos} onChange={handleInputChange} link={inputs.links?.servicios_publicos} onLinkClick={() => openLinkModal('servicios_publicos', 'Servicios Públicos')} />
                                        <InputField label="Seguros (Pólizas)" id="seguros" value={inputs.seguros} onChange={handleInputChange} link={inputs.links?.seguros} onLinkClick={() => openLinkModal('seguros', 'Seguros (Pólizas)')} />
                                        <InputField label="Licencias y Permisos (Mensualizado)" id="licencias" value={inputs.licencias} onChange={handleInputChange} link={inputs.links?.licencias} onLinkClick={() => openLinkModal('licencias', 'Licencias y Permisos')} />
                                        <InputField label="Software (Siigo, Emergy, etc.)" id="software" value={inputs.software} onChange={handleInputChange} link={inputs.links?.software} onLinkClick={() => openLinkModal('software', 'Software')} />
                                        <InputField label="Depreciación por Vehículo" id="depreciacion_vehiculo" value={inputs.depreciacion_vehiculo} onChange={handleInputChange} link={inputs.links?.depreciacion_vehiculo} onLinkClick={() => openLinkModal('depreciacion_vehiculo', 'Depreciación por Vehículo')} />
                                        <InputField label="Depreciación Equipo Básico (TAB)" id="depreciacion_equipo_tab" value={inputs.depreciacion_equipo_tab} onChange={handleInputChange} link={inputs.links?.depreciacion_equipo_tab} onLinkClick={() => openLinkModal('depreciacion_equipo_tab', 'Depreciación Equipo (TAB)')} />
                                        <InputField label="Depreciación Equipo Medicalizado (TAM)" id="depreciacion_equipo_tam" value={inputs.depreciacion_equipo_tam} onChange={handleInputChange} link={inputs.links?.depreciacion_equipo_tam} onLinkClick={() => openLinkModal('depreciacion_equipo_tam', 'Depreciación Equipo (TAM)')} />
                                    </AccordionItem>
                                    <AccordionItem title="Costos Variables por Servicio" isOpen={openAccordion === 'variables'} onClick={() => setOpenAccordion(openAccordion === 'variables' ? null : 'variables')}>
                                        <InputField label="Costo Combustible por KM" id="costo_combustible_km" value={inputs.costo_combustible_km} onChange={handleInputChange} link={inputs.links?.costo_combustible_km} onLinkClick={() => openLinkModal('costo_combustible_km', 'Costo Combustible por KM')} />
                                        <InputField label="Costo Mantenimiento por KM" id="costo_mantenimiento_km" value={inputs.costo_mantenimiento_km} onChange={handleInputChange} link={inputs.links?.costo_mantenimiento_km} onLinkClick={() => openLinkModal('costo_mantenimiento_km', 'Costo Mantenimiento por KM')} />
                                        <InputField label="Costo Insumos por Servicio Básico (TAB)" id="costo_insumos_tab" value={inputs.costo_insumos_tab} onChange={handleInputChange} link={inputs.links?.costo_insumos_tab} onLinkClick={() => openLinkModal('costo_insumos_tab', 'Costo Insumos (TAB)')} />
                                        <InputField label="Costo Insumos por Servicio Medicalizado (TAM)" id="costo_insumos_tam" value={inputs.costo_insumos_tam} onChange={handleInputChange} link={inputs.links?.costo_insumos_tam} onLinkClick={() => openLinkModal('costo_insumos_tam', 'Costo Insumos (TAM)')} />
                                    </AccordionItem>
                                    <AccordionItem title="Parámetros Operativos" isOpen={openAccordion === 'operativos'} onClick={() => setOpenAccordion(openAccordion === 'operativos' ? null : 'operativos')}>
                                        <InputField label="Número de Ambulancias Básicas (TAB)" id="num_tab" value={inputs.num_tab} onChange={handleInputChange} link={inputs.links?.num_tab} onLinkClick={() => openLinkModal('num_tab', 'Número de Ambulancias (TAB)')} />
                                        <InputField label="Número de Ambulancias Medicalizadas (TAM)" id="num_tam" value={inputs.num_tam} onChange={handleInputChange} link={inputs.links?.num_tam} onLinkClick={() => openLinkModal('num_tam', 'Número de Ambulancias (TAM)')} />
                                        <InputField label="Días de operación al mes" id="dias_operacion" value={inputs.dias_operacion} onChange={handleInputChange} link={inputs.links?.dias_operacion} onLinkClick={() => openLinkModal('dias_operacion', 'Días de operación al mes')} />
                                        <InputField label="Viajes promedio por día (por ambulancia)" id="viajes_por_dia" value={inputs.viajes_por_dia} onChange={handleInputChange} link={inputs.links?.viajes_por_dia} onLinkClick={() => openLinkModal('viajes_por_dia', 'Viajes promedio por día')} />
                                        <InputField label="Kilómetros promedio por viaje" id="km_por_viaje" value={inputs.km_por_viaje} onChange={handleInputChange} link={inputs.links?.km_por_viaje} onLinkClick={() => openLinkModal('km_por_viaje', 'Kilómetros promedio por viaje')} />
                                    </AccordionItem>
                                    <AccordionItem title="Mix de Servicios (%)" isOpen={openAccordion === 'mix_servicios'} onClick={() => setOpenAccordion(openAccordion === 'mix_servicios' ? null : 'mix_servicios')}>
                                        <div className="space-y-2">
                                            {inputs.serviciosMix.map(s => (
                                                <div key={s.id} className="grid grid-cols-2 gap-2 items-center">
                                                    <label htmlFor={`mix_${s.id}`} className="text-sm text-gray-600">{SERVICIOS.find(serv => serv.id === s.id)?.name}</label>
                                                    <input type="number" id={`mix_${s.id}`} value={s.mix} onChange={(e) => handleMixChange(s.id, e.target.value)} className="input-field service-mix-input mt-1 block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"/>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-right mt-2">
                                            <p className="text-sm font-semibold">Total Mix: <span style={{ color: Math.abs(totalServiciosMix - 100) > 0.1 ? 'red' : 'green' }}>{totalServiciosMix.toFixed(1)}%</span></p>
                                        </div>
                                    </AccordionItem>
                                    <AccordionItem title="Cartera de Clientes y Tarifario" isOpen={openAccordion === 'clientes'} onClick={() => setOpenAccordion(openAccordion === 'clientes' ? null : 'clientes')}>
                                        <>
                                            <div className="space-y-4">
                                                {inputs.clientes.map(cliente => (
                                                    <div key={cliente.id} className="client-row border p-3 rounded-md">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <input type="text" value={cliente.name} onChange={(e) => handleClientChange(cliente.id, 'name', e.target.value)} placeholder="Nombre del Cliente" className="client-name text-sm font-semibold border-0 p-1 w-full"/>
                                                            <button onClick={() => removeClient(cliente.id)} className="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-2">
                                                            <div>
                                                                <label className="block text-xs text-gray-500">Mix de este Cliente (%)</label>
                                                                <input type="number" value={cliente.mix} onChange={(e) => handleClientChange(cliente.id, 'mix', parseFloat(e.target.value) || 0)} className="input-field client-mix mt-1 block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"/>
                                                            </div>
                                                        </div>
                                                        <details className="mt-2">
                                                            <summary className="text-xs font-medium text-blue-600 cursor-pointer">Ver/Editar Tarifario</summary>
                                                            <div className="mt-2 space-y-2 border-t pt-2">
                                                                {SERVICIOS.map(s => (
                                                                    <div key={s.id} className="grid grid-cols-2 gap-2 items-center">
                                                                        <label className="text-xs text-gray-500">{s.name}</label>
                                                                        <input type="number" value={cliente.tarifas[s.id] || 0} onChange={(e) => handleClientTarifaChange(cliente.id, s.id, e.target.value)} className="input-field client-tarifa mt-1 block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"/>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between items-center mt-2">
                                                <button onClick={addClient} className="text-sm font-medium text-blue-600 hover:text-blue-800">+ Añadir Cliente</button>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold">Total Mix: <span style={{ color: Math.abs(totalClientesMix - 100) > 0.1 ? 'red' : 'green' }}>{totalClientesMix.toFixed(1)}%</span></p>
                                                </div>
                                            </div>
                                        </>
                                    </AccordionItem>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

