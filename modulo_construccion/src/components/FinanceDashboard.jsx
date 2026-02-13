import React, { useEffect, useState } from 'react';
import { Modal, Table, Badge } from 'react-bootstrap';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Pie,
    Cell
} from 'recharts';
import { reportesService } from '../services/reportesService';
import { tareasService } from '../services/tareasService';
import { cubicacionService } from '../services/cubicacionService'; // <--- NUEVO IMPORT
import { supabase } from '../services/supabaseClient';
import { AlertCircle, TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function FinanceDashboard({ projectId }) {
    const [kpis, setKpis] = useState({
        ingresos: 0,
        costos_mo: 0,
        costos_mo_total: 0,
        gastos_op: 0,
        utilidad: 0,
        margen: 0,
        gasto_realizado_neto: 0,
        deuda_pendiente_neto: 0,
        venta_cubicada: 0
    });
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailType, setDetailType] = useState(null); // 'ingresos', 'gastos', etc.

    // NUEVO MODAL VENTA CUBICADA
    const [showModalVenta, setShowModalVenta] = useState(false);
    const [detalleVentaData, setDetalleVentaData] = useState([]);

    const [chartData, setChartData] = useState([]); // Para gráfico de barras
    const [pieData, setPieData] = useState([]);     // Para gráfico circular
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        cargarDatosFinancieros();
    }, [projectId]);

    const cargarDatosFinancieros = async () => {
        try {
            setLoading(true);

            // 1. Carga paralela de datos (Incluyendo RPC KPIs para consistencia con Módulo Órdenes Pago)
            const [todasLasTareas, gastosRaw, cubicaciones, zonas, kpisRpc] = await Promise.all([
                tareasService.getTareas(projectId),
                reportesService.getGastosRaw(projectId),
                cubicacionService.getCubicaciones(projectId),
                cubicacionService.getZonas(projectId),
                supabase.rpc('get_panel_general_kpis', { p_proyecto_id: Number(projectId) })
            ]);

            // 2. Procesar Tareas y Subcontratistas (Solo para GRÁFICOS y MO Pendiente)
            const proveedoresMap = {};
            const subcontratistasIds = new Set();
            let totalCostoMO_Pendiente = 0; // Sin EP o Borrador

            // CALCULAR VENTA CUBICADA REAL (Desde Matriz) y DESGLOSAR POR ZONA (Para Modal)
            const mapaVentaPorZona = {}; // ZonaID -> Total
            if (cubicaciones && cubicaciones.length > 0) {
                cubicaciones.forEach(c => {
                    const cant = Number(c.cantidad) || 0;
                    const precio = Number(c.actividad?.valor_venta || c.sub_actividad?.valor_venta || 0);
                    const totalLinea = cant * precio;

                    // Acumular por Zona
                    if (totalLinea > 0 && c.zona_id) {
                        mapaVentaPorZona[c.zona_id] = (mapaVentaPorZona[c.zona_id] || 0) + totalLinea;
                    }
                });
            }

            // Preparar Datos para Modal Venta Cubicada
            const listaVentaPorZona = zonas.map(z => ({
                id: z.id,
                nombre: z.nombre,
                total: mapaVentaPorZona[z.id] || 0
            })).filter(z => z.total > 0).sort((a, b) => b.total - a.total);

            setDetalleVentaData(listaVentaPorZona);

            todasLasTareas.forEach(tarea => {
                if (tarea.proveedor?.id) {
                    subcontratistasIds.add(tarea.proveedor.id);
                }

                // Cálculo de Costos de Mano de Obra (Solo para pendiente y gráfico)
                if (tarea.cantidad_real > 0 || (tarea.items && tarea.items.some(i => i.cantidad_real > 0))) {
                    const itemsProcesar = (tarea.items && tarea.items.length > 0) ? tarea.items : [tarea];

                    itemsProcesar.forEach(item => {
                        const cantReal = Number(item.cantidad_real) || 0;
                        if (cantReal > 0) {
                            const costo = cantReal * (Number(item.precio_costo_unitario) || 0);
                            const venta = cantReal * (Number(item.precio_venta_unitario) || 0);

                            // Acumular Pendiente (Sin Estado Pago o Borrador)
                            const estadoEP = tarea.estado_pago?.estado;
                            if (!estadoEP || estadoEP === 'BORRADOR') {
                                totalCostoMO_Pendiente += costo;
                            }

                            // Agrupar por Proveedor para Gráfico
                            const provId = tarea.proveedor?.id || 'sin_prov';
                            const provNombre = tarea.proveedor?.nombre || 'Proveedor Desconocido';

                            if (!proveedoresMap[provId]) {
                                proveedoresMap[provId] = {
                                    nombre_proveedor: provNombre,
                                    produccion_costo: 0,
                                    produccion_venta: 0
                                };
                            }
                            proveedoresMap[provId].produccion_costo += costo;
                            proveedoresMap[provId].produccion_venta += venta;
                        }
                    });
                }
            });

            // 3. Procesar Gastos (Solo para GRÁFICO de Distribución)
            const desgloseItems = {};

            gastosRaw.forEach(g => {
                const monto = Number(g.neto_total_recibido) || 0;
                // Agrupar por ítem para el gráfico (Todos los gastos)
                const itemNombre = g.item ? g.item.trim() : 'Sin Categoría';
                desgloseItems[itemNombre] = (desgloseItems[itemNombre] || 0) + monto;
            });

            // 4. Set KPIs desde RPC (CONSISTENCIA CON ORDENES DE PAGO)
            // Usamos los valores calculados en SQL que incluyen Gastos Directos y Descuento IVA
            const k = kpisRpc.data || {};

            setKpis({
                ingresos: k.ingresos || 0,
                costos_mo: totalCostoMO_Pendiente, // Único valor calculado en frontend (Pendiente es dinámico UI)
                costos_mo_total: k.costo_mo || 0, // Total Realizado desde SQL
                utilidad: k.utilidad || 0, // Correcto (Ingresos - MO - GastoTotalNeto)
                margen: k.margen || 0,
                gasto_realizado_neto: k.gasto_neto || 0, // Correcto (OP + Gastos Directos Netos)
                deuda_pendiente_neto: k.deuda_neto || 0,
                venta_cubicada: k.venta_cubicada || 0
            });

            // 5. Preparar Datos Gráfico Barras (Top Proveedores)
            const topProveedores = Object.values(proveedoresMap)
                .sort((a, b) => b.produccion_costo - a.produccion_costo)
                .slice(0, 5)
                .map(p => ({
                    name: p.nombre_proveedor.length > 15 ? p.nombre_proveedor.substring(0, 15) + '...' : p.nombre_proveedor,
                    Costo: p.produccion_costo,
                    Venta: p.produccion_venta
                }));
            setChartData(topProveedores);

            // 6. Preparar Datos Gráfico Barras (Distribución Gasto) - HORIZONTAL
            const distribucionTemp = [];
            Object.entries(desgloseItems).forEach(([item, valor]) => {
                if (valor > 0) {
                    distribucionTemp.push({ name: item.toUpperCase(), value: valor });
                }
            });
            distribucionTemp.sort((a, b) => b.value - a.value);
            setPieData(distribucionTemp);

        } catch (error) {
            console.error("Error cargando dashboard financiero:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);

    // Estado para el Modal
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: '',
        data: [],
        type: '' // 'gastos' | 'neto' | 'deuda'
    });

    const handleCardClick = async (type) => {
        if (!projectId) return;

        let title = '';
        let data = [];
        let headers = [];
        let tabs = null;

        try {
            if (type === 'ingresos') {
                title = 'Resumen Ingresos (Por Actividad)';
                const tareas = await tareasService.getTareas(projectId);
                const agrupado = {};

                tareas.forEach(tarea => {
                    const items = (tarea.items && tarea.items.length > 0) ? tarea.items : [tarea];
                    items.forEach(item => {
                        const cant = Number(item.cantidad_real) || 0;
                        if (cant > 0) {
                            const nombre = item.actividad?.nombre || item.sub_actividad?.nombre || item.nombre || tarea.nombre || 'Sin Nombre';
                            const precio = Number(item.precio_venta_unitario) || 0;

                            if (!agrupado[nombre]) agrupado[nombre] = { nombre, precio, cantidad_total: 0, venta_total: 0 };
                            agrupado[nombre].cantidad_total += cant;
                            agrupado[nombre].venta_total += (cant * precio);
                        }
                    });
                });

                data = Object.values(agrupado).map((a, index) => ({
                    id: index,
                    col1: a.nombre,
                    col2: formatMoney(a.precio),
                    col3: Number(a.cantidad_total).toLocaleString('es-CL'),
                    monto: a.venta_total,
                    status: 'Ejecutado'
                }));
                headers = ['Actividad', 'Precio Unitario', 'Cant. Real', 'Total Venta', 'Estado'];

            } else if (type === 'neto') {
                title = 'Detalle Gasto Realizado (Neto)';

                // 1. Obtener Órdenes de Pago (Ya vienen netas desde reportesService)
                const detalles = await reportesService.getDetalleFinancieroProyecto(projectId);

                // 2. Obtener Gastos Directos (Bruto -> Convertir a Neto)
                const { data: gastosDir } = await supabase
                    .from('gastos_directos')
                    .select('*')
                    .eq('proyecto_id', Number(projectId))
                    .order('fecha', { ascending: false });

                // Formatear OP
                const opList = detalles.gastos_netos.map(d => ({
                    id: `op-${d.id}`,
                    col1: d.fecha || '-',
                    col2: d.proveedor || '-',
                    col3: `OP #${d.orden_numero} - ${d.detalle || ''}`,
                    monto: d.monto_neto, // Ya es neto
                    status: d.estado
                }));

                // Formatear GD (Dividir por 1.19)
                const gdList = (gastosDir || []).map(g => ({
                    id: `gd-${g.id}`,
                    col1: g.fecha || '-',
                    col2: 'Gasto Directo',
                    col3: g.descripcion || '-',
                    monto: Math.round((Number(g.monto) || 0) / 1.19), // Convertir a Neto
                    status: 'Pagado'
                }));

                // Combinar y ordenar
                const todos = [...opList, ...gdList].sort((a, b) => new Date(b.col1) - new Date(a.col1));

                // Configurar Tabs
                tabs = [
                    { key: 'todos', label: 'Todos', count: todos.length, data: todos },
                    { key: 'op', label: 'Órdenes de Pago', count: opList.length, data: opList },
                    { key: 'gd', label: 'Gastos Directos', count: gdList.length, data: gdList }
                ];

                headers = ['Fecha', 'Proveedor / Tipo', 'Detalle', 'Monto Neto', 'Estado'];

            } else if (type === 'deuda') {
                title = 'Detalle Deuda Pendiente (Neto)';
                const detalles = await reportesService.getDetalleFinancieroProyecto(projectId);
                data = detalles.deuda_neta.map(d => ({
                    id: d.id,
                    col1: `OP #${d.orden_numero} - ${d.proveedor}`,
                    col2: `Saldo Bruto: ${formatMoney(d.saldo_bruto)}`,
                    col3: d.fecha,
                    monto: d.deuda_neta,
                    status: 'Pendiente'
                }));
                headers = ['Referencia', 'Detalle Saldo', 'Fecha Doc', 'Deuda Neta', 'Estado'];
            }

            setModalConfig({
                isOpen: true,
                title,
                data: tabs ? [] : data,
                type,
                headers,
                tabs // Nuevo
            });

        } catch (error) {
            console.error("Error al cargar detalle:", error);
        }
    };

    const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false, tabs: null });

    // Componente Modal Interno
    const DetailModal = () => {
        if (!modalConfig.isOpen) return null;

        // Estado local para pestaña activa (default: primera pestaña o null)
        const [activeTab, setActiveTab] = useState(modalConfig.tabs ? modalConfig.tabs[0].key : null);

        // Determinar qué data mostrar
        const currentData = modalConfig.tabs
            ? modalConfig.tabs.find(t => t.key === activeTab)?.data || []
            : modalConfig.data;

        const tableHeaders = modalConfig.headers || ['Ítem / Referencia', 'Detalle', 'Fecha', 'Monto', 'Estado'];

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <Wallet size={20} className="text-slate-400" /> {modalConfig.title}
                        </h3>
                        <button onClick={closeModal} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            ✕
                        </button>
                    </div>

                    {/* Tabs (Si existen) */}
                    {modalConfig.tabs && (
                        <div className="flex border-b border-slate-200 px-6 gap-6 bg-white pt-2">
                            {modalConfig.tabs.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === tab.key
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {tab.label}
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-blue-100' : 'bg-slate-100'
                                        }`}>
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Body */}
                    <div className="p-0 overflow-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 font-bold tracking-wider">
                                <tr>
                                    {tableHeaders.map((h, i) => (
                                        <th key={i} className={`px-6 py-3 ${i === 3 ? 'text-right' : i === 4 ? 'text-center' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentData.length > 0 ? (
                                    currentData.map((row, idx) => (
                                        <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-3 whitespace-nowrap text-slate-600 font-medium">{row.col1}</td>
                                            <td className="px-6 py-3 text-slate-600">{row.col2}</td>
                                            <td className="px-6 py-3 text-slate-500 max-w-[250px] truncate" title={row.col3}>{row.col3}</td>
                                            <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">
                                                {formatMoney(row.monto)}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase 
                                                    ${row.status === 'Pagado' || row.status === 'Ejecutado' ? 'bg-green-100 text-green-700' :
                                                        row.status === 'Pendiente' ? 'bg-red-100 text-red-700' :
                                                            'bg-orange-100 text-orange-700'}`}>
                                                    {row.status || '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-10 text-center text-slate-400 italic">
                                            No hay registros para mostrar en esta sección
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer - Total Dinámico según Tab */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between items-center shadow-inner">
                        <span className="text-xs text-slate-400 font-medium">
                            Mostrando {currentData.length} registros
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs uppercase font-bold text-slate-400">Total:</span>
                            <div className="text-lg font-bold text-slate-800">
                                {formatMoney(currentData.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return <div className="p-10 text-center text-slate-400 animate-pulse">Cargando métricas financieras...</div>;

    return (
        <div className="p-3 bg-slate-50 min-h-full">
            <DetailModal />

            {/* 1. KPIs ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">

                {/* NUEVO: VENTA CUBICADA */}
                <div
                    onDoubleClick={() => setShowModalVenta(true)}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer select-none"
                    title="Doble Clic para Ver Detalle por Zona"
                >
                    <div className="flex justify-between items-start mb-1">
                        <div className="p-1.5 bg-cyan-50 text-cyan-600 rounded-lg"><DollarSign size={18} /></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Venta Cubicada</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">{formatMoney(kpis.venta_cubicada)}</div>
                    <div className="text-[10px] text-cyan-500 mt-0.5 font-bold">Presupuesto Inicial</div>
                </div>

                {/* INGRESOS (Clickable) */}
                <div
                    onClick={() => handleCardClick('ingresos')}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all group"
                >
                    <div className="flex justify-between items-start mb-1">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors"><DollarSign size={18} /></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-hover:text-blue-600 transition-colors">Ingresos Totales</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">{formatMoney(kpis.ingresos)}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Producción Valorizada</div>
                </div>

                {/* COSTOS MO (Sin Click) */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-1">
                        <div className="p-1.5 bg-red-50 text-red-600 rounded-lg"><TrendingDown size={18} /></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Costo Mano Obra</span>
                    </div>
                    {/* Monto Principal: PENDIENTE */}
                    <div className="text-xl font-bold text-slate-800" title="Monto Pendiente de Pago">
                        {formatMoney(kpis.costos_mo)}
                    </div>
                    {/* Subtítulo: PENDIENTE */}
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Sin Estado de Pago</div>

                    {/* Subtítulo: TOTAL REALIZADO */}
                    <div className="text-[10px] text-red-400 mt-0.5 pt-2 border-t border-slate-100">
                        Total Realizado: {formatMoney(kpis.costos_mo_total || 0)}
                    </div>
                </div>

                {/* NUEVO: GASTO REALIZADO (NETO) + DEUDA (Clickable) */}
                <div
                    onClick={() => handleCardClick('neto')}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all group relative overflow-hidden"
                >
                    <div className="flex justify-between items-start mb-1">
                        <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 transition-colors"><Wallet size={18} /></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-hover:text-purple-600 transition-colors">Gasto Realizado (Neto)</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">{formatMoney(kpis.gasto_realizado_neto || 0)}</div>
                    <div className="text-[10px] text-purple-400 mt-0.5 mb-2">Órdenes de Pago</div>

                    {/* Sección Por Pagar (Mini) */}
                    <div
                        onClick={(e) => { e.stopPropagation(); handleCardClick('deuda'); }}
                        className="pt-2 border-t border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors rounded px-1 -mx-1"
                        title="Ver detalle deuda pendiente"
                    >
                        <div className="flex items-center gap-1">
                            <AlertCircle size={12} className="text-pink-400" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Por Pagar:</span>
                        </div>
                        <span className="text-xs font-bold text-pink-500">{formatMoney(kpis.deuda_pendiente_neto || 0)}</span>
                    </div>
                </div>



                {/* UTILIDAD (Sin Click) */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className={`absolute right-0 top-0 w-1.5 h-full ${kpis.utilidad >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div className="flex justify-between items-start mb-1">
                        <div className={`p-1.5 rounded-lg ${kpis.utilidad >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            <TrendingUp size={18} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Utilidad Neta</span>
                    </div>
                    <div className={`text-xl font-bold ${kpis.utilidad >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatMoney(kpis.utilidad)}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                        Margen: {kpis.margen.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* 2. CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* BAR CHART: TOP PROVEEDORES */}
                <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <BarChart size={16} className="text-slate-400" />
                        Producción vs Costo (Top 5 Proveedores)
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                                barGap={8}
                            >
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    tickFormatter={(value) => `$${value / 1000}k`}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)',
                                        fontSize: '12px',
                                        padding: '8px 12px'
                                    }}
                                    formatter={(value) => [formatMoney(value), '']}
                                />
                                <Legend
                                    iconType="circle"
                                    wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 600, color: '#64748b' }}
                                />
                                <Bar dataKey="Venta" name="Venta Proyectada" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={24} />
                                <Bar dataKey="Costo" name="Costo Real (MO)" fill="#475569" radius={[6, 6, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* BAR CHART: DISTRIBUCIÓN DE COSTOS (Horizontal) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <BarChart size={16} className="text-slate-400 rotate-90" />
                        Distribución de Costos (Escala Logarítmica)
                    </h3>

                    {/* Contenedor con altura dinámica o scroll si son muchos items */}
                    <div className="flex-grow w-full overflow-hidden" style={{ minHeight: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                layout="vertical"
                                data={pieData}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide scale="log" domain={['auto', 'auto']} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={140}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                    interval={0}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        fontSize: '12px',
                                        padding: '8px 12px'
                                    }}
                                    formatter={(value) => [formatMoney(value), '']}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} background={{ fill: '#f8fafc' }}>
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-2 pt-3 border-top text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Total Gastado</span>
                        <div className="text-lg font-bold text-slate-700 leading-none">
                            {formatMoney(kpis.gasto_realizado_neto || 0)}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. MODAL DETALLE VENTA CUBICADA */}
            <Modal show={showModalVenta} onHide={() => setShowModalVenta(false)} centered scrollable>
                <Modal.Header closeButton className="bg-cyan-50 text-cyan-800">
                    <Modal.Title className="h6 fw-bold">
                        <i className="bi bi-layers-half me-2"></i>Desglose Venta Cubicada
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-0">
                    <Table hover striped className="mb-0 small align-middle">
                        <thead className="bg-light text-secondary">
                            <tr>
                                <th className="ps-4">Zona</th>
                                <th className="text-end pe-4">Monto Cubicado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {detalleVentaData.length > 0 ? (
                                detalleVentaData.map((item) => (
                                    <tr key={item.id}>
                                        <td className="ps-4 fw-medium text-slate-700">{item.nombre}</td>
                                        <td className="text-end pe-4 font-monospace">{formatMoney(item.total)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="2" className="text-center py-3 text-muted">Sin datos cubicados</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-light">
                            <tr>
                                <td className="text-end fw-bold text-secondary pe-3">TOTAL:</td>
                                <td className="text-end pe-4 fw-bold text-cyan-700">{formatMoney(kpis.venta_cubicada)}</td>
                            </tr>
                        </tfoot>
                    </Table>
                </Modal.Body>
                <Modal.Footer className="py-2 bg-light border-top-0">
                    <small className="text-muted w-100 text-center">Datos según Matriz de Cubicación</small>
                </Modal.Footer>
            </Modal>
        </div>
    );
}
