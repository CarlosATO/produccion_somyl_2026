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
import { AlertCircle, TrendingUp, TrendingDown, DollarSign, Wallet, ClipboardList, ArrowLeft } from 'lucide-react';

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
    const [zonaVentaSeleccionada, setZonaVentaSeleccionada] = useState(null); // Nivel 2 Venta
    const [detalleZonaVentaData, setDetalleZonaVentaData] = useState([]);     // Datos Nivel 2 Venta

    // NUEVO MODAL PENDIENTE DE EJECUTAR
    const [showModalPendiente, setShowModalPendiente] = useState(false);
    const [detallePendienteData, setDetallePendienteData] = useState([]); // Nivel 1: Zonas
    const [zonaSeleccionada, setZonaSeleccionada] = useState(null); // Nivel 2: Detalle Actividades de una Zona
    const [detalleZonaData, setDetalleZonaData] = useState([]); // Datos Nivel 2

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
            const ZONA_GLOBAL_KEY = 'GLOBAL';

            if (cubicaciones && cubicaciones.length > 0) {
                cubicaciones.forEach(c => {
                    const cant = Number(c.cantidad) || 0;
                    const precio = Number(c.actividad?.valor_venta || c.sub_actividad?.valor_venta || 0);
                    const totalLinea = cant * precio;

                    // Acumular por Zona (o Global)
                    if (totalLinea > 0) {
                        const zId = c.zona_id || ZONA_GLOBAL_KEY;
                        mapaVentaPorZona[zId] = (mapaVentaPorZona[zId] || 0) + totalLinea;
                    }
                });
            }

            // Preparar Datos para Modal Venta Cubicada
            const listaVentaPorZona = zonas.map(z => ({
                id: z.id,
                nombre: z.nombre,
                total: mapaVentaPorZona[z.id] || 0
            })).filter(z => z.total > 0);

            // Agregar Global si existe
            if (mapaVentaPorZona[ZONA_GLOBAL_KEY] > 0) {
                listaVentaPorZona.push({
                    id: ZONA_GLOBAL_KEY,
                    nombre: 'Global / Sin Zona',
                    total: mapaVentaPorZona[ZONA_GLOBAL_KEY]
                });
            }

            listaVentaPorZona.sort((a, b) => b.total - a.total);
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

            // 3b. CALCULAR PRODUCCIÓN POR ZONA (Para KPI Pendiente)
            const mapaProduccionPorZona = {};
            todasLasTareas.forEach(t => {
                const zonaId = t.zona_id;
                if (!zonaId) return;

                const items = t.items?.length > 0 ? t.items : [t];
                items.forEach(i => {
                    // Consideramos lo producido (cantidad_real)
                    const cant = Number(i.cantidad_real) || 0;
                    const precio = Number(i.precio_venta_unitario) || 0;
                    if (cant > 0) {
                        mapaProduccionPorZona[zonaId] = (mapaProduccionPorZona[zonaId] || 0) + (cant * precio);
                    }
                });
            });

            // 3c. Preparar Datos para Modal Pendiente (Nivel 1: Por Zona)
            const listaPendientePorZona = zonas.map(z => {
                const venta = mapaVentaPorZona[z.id] || 0;
                const prod = mapaProduccionPorZona[z.id] || 0;
                const pendiente = venta - prod;
                return {
                    id: z.id,
                    nombre: z.nombre,
                    venta,
                    prod,
                    pendiente
                };
            }).filter(z => Math.abs(z.pendiente) > 1000); // Mostrar si hay diferencia significativa (> $1000)

            listaPendientePorZona.sort((a, b) => b.pendiente - a.pendiente);
            setDetallePendienteData(listaPendientePorZona);


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

    // --- LÓGICA NIVEL 2: DETALLE POR ACTIVIDAD EN UNA ZONA ---
    const handleZonaClick = async (zona) => {
        setLoading(true);
        try {
            // Recalcular detalle fino para esta zona
            const zonaId = zona.id;
            const [cubicaciones, tareas] = await Promise.all([
                cubicacionService.getCubicaciones(projectId),
                tareasService.getTareas(projectId)
            ]);

            // 1. Mapa de Cubicaciones de la Zona
            const actsMap = {}; // key: "act_ID" o "sub_ID" -> { nombre, unit, precio, cub_cant, prod_cant }

            cubicaciones.filter(c => c.zona_id === zonaId).forEach(c => {
                const isSub = !!c.sub_actividad_id;
                const id = isSub ? `sub_${c.sub_actividad_id}` : `act_${c.actividad_id}`;
                const nombre = isSub ? c.sub_actividad?.nombre : c.actividad?.nombre;
                const unit = isSub ? c.sub_actividad?.unidad : c.actividad?.unidad;
                const precio = Number(isSub ? c.sub_actividad?.valor_venta : c.actividad?.valor_venta) || 0;
                const cant = Number(c.cantidad) || 0;

                if (!actsMap[id]) actsMap[id] = { id, nombre, unit, precio, cub_cant: 0, prod_cant: 0 };
                actsMap[id].cub_cant += cant;
            });

            // 2. Mapa de Producción (Tareas) de la Zona
            tareas.filter(t => t.zona_id === zonaId).forEach(t => {
                const items = t.items?.length > 0 ? t.items : [t];
                items.forEach(i => {
                    const cant = Number(i.cantidad_real) || 0;
                    if (cant > 0) {
                        // Determinar ID compatible con cubicación
                        let id = null;
                        if (i.sub_actividad_id || i.sub_actividad?.id) {
                            id = `sub_${i.sub_actividad_id || i.sub_actividad.id}`;
                        } else if (i.actividad_id || i.actividad?.id) {
                            id = `act_${i.actividad_id || i.actividad.id}`;
                        }

                        if (id) {
                            // Si no existe en cubicación (extra), lo creamos
                            if (!actsMap[id]) {
                                const nombre = i.actividad?.nombre || i.sub_actividad?.nombre || t.nombre;
                                const precio = Number(i.precio_venta_unitario) || 0;
                                actsMap[id] = { id, nombre, unit: 'un', precio, cub_cant: 0, prod_cant: 0 };
                            }
                            actsMap[id].prod_cant += cant;
                        }
                    }
                });
            });

            // 3. Array plano
            const detalle = Object.values(actsMap).map(item => ({
                ...item,
                pendiente_cant: item.cub_cant - item.prod_cant,
                pendiente_monto: (item.cub_cant - item.prod_cant) * item.precio
            })).sort((a, b) => b.pendiente_monto - a.pendiente_monto);

            setDetalleZonaData(detalle);
            setZonaSeleccionada(zona);

        } catch (e) {
            console.error("Error cargando detalle zona", e);
        } finally {
            setLoading(false);
        }
    }

    // --- LÓGICA NIVEL 2 VENTA: DETALLE POR ACTIVIDAD (Exclusivo Cubicaciones) ---
    const handleZonaVentaClick = async (zona) => {
        setLoading(true);
        try {
            const cubicaciones = await cubicacionService.getCubicaciones(projectId);
            const actsMap = {};

            const isGlobal = zona.id === 'GLOBAL';

            cubicaciones.filter(c => isGlobal ? !c.zona_id : c.zona_id === zona.id).forEach(c => {
                const cant = Number(c.cantidad) || 0;
                if (cant <= 0) return;

                const isSub = !!c.sub_actividad_id;
                const id = isSub ? `sub_${c.sub_actividad_id}` : `act_${c.actividad_id}`;
                const nombre = isSub ? c.sub_actividad?.nombre : c.actividad?.nombre;
                const unit = isSub ? c.sub_actividad?.unidad : c.actividad?.unidad;
                const precio = Number(isSub ? c.sub_actividad?.valor_venta : c.actividad?.valor_venta) || 0;

                if (!actsMap[id]) actsMap[id] = { id, nombre, unit, precio, cantidad: 0, total: 0 };
                actsMap[id].cantidad += cant;
                actsMap[id].total += (cant * precio);
            });

            const detalle = Object.values(actsMap).sort((a, b) => b.total - a.total);
            setDetalleZonaVentaData(detalle);
            setZonaVentaSeleccionada(zona);

        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">

                {/* NUEVO: VENTA CUBICADA */}
                <div
                    onDoubleClick={() => setShowModalVenta(true)}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer select-none h-full flex flex-col justify-between"
                    title="Doble Clic para Ver Detalle por Zona"
                >
                    <div>
                        <div className="flex justify-between items-start mb-1">
                            <div className="p-1 bg-cyan-50 text-cyan-600 rounded-lg"><DollarSign size={16} /></div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide text-right flex-1 ml-2">Venta Cubicada</span>
                        </div>
                        <div className="text-lg font-bold text-slate-800 truncate" title={formatMoney(kpis.venta_cubicada)}>{formatMoney(kpis.venta_cubicada)}</div>
                    </div>
                    <div className="text-[9px] text-cyan-500 mt-1 font-bold">Presupuesto Inicial</div>
                </div>

                {/* NUEVO: SALDO POR EJECUTAR (Clickable) */}
                <div
                    onDoubleClick={() => { setZonaSeleccionada(null); setShowModalPendiente(true); }}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer select-none group h-full flex flex-col justify-between"
                    title="Doble Clic para Ver Desglose"
                >
                    <div>
                        <div className="flex justify-between items-start mb-1">
                            <div className="p-1 bg-orange-50 text-orange-600 rounded-lg group-hover:bg-orange-100 transition-colors"><ClipboardList size={16} /></div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide text-right flex-1 ml-2">Saldo x Ejecutar</span>
                        </div>
                        <div className="text-lg font-bold text-slate-800 truncate" title={formatMoney(kpis.venta_cubicada - kpis.ingresos)}>{formatMoney(kpis.venta_cubicada - kpis.ingresos)}</div>
                    </div>
                    <div className="text-[9px] text-orange-400 mt-1 font-bold truncate">Venta - Producción</div>
                </div>

                {/* INGRESOS (Clickable) */}
                <div
                    onClick={() => handleCardClick('ingresos')}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all group h-full flex flex-col justify-between"
                >
                    <div>
                        <div className="flex justify-between items-start mb-1">
                            <div className="p-1 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors"><DollarSign size={16} /></div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide text-right flex-1 ml-2 group-hover:text-blue-600 transition-colors">Ingresos Totales</span>
                        </div>
                        <div className="text-lg font-bold text-slate-800 truncate" title={formatMoney(kpis.ingresos)}>{formatMoney(kpis.ingresos)}</div>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1 truncate">Producción Valorizada</div>
                </div>

                {/* COSTOS MO (Sin Click) */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-1">
                            <div className="p-1 bg-red-50 text-red-600 rounded-lg"><TrendingDown size={16} /></div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide text-right flex-1 ml-2">Costo Mano Obra</span>
                        </div>
                        {/* Monto Principal: PENDIENTE */}
                        <div className="text-lg font-bold text-slate-800 truncate" title="Monto Pendiente de Pago">
                            {formatMoney(kpis.costos_mo)}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Sin Estado de Pago</div>
                    </div>

                    {/* Subtítulo: TOTAL REALIZADO */}
                    <div className="text-[9px] text-red-400 mt-1 pt-1 border-t border-slate-100 truncate">
                        Total: {formatMoney(kpis.costos_mo_total || 0)}
                    </div>
                </div>

                {/* NUEVO: GASTO REALIZADO (NETO) + DEUDA (Clickable) */}
                <div
                    onClick={() => handleCardClick('neto')}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all group relative overflow-hidden h-full flex flex-col justify-between"
                >
                    <div>
                        <div className="flex justify-between items-start mb-1">
                            <div className="p-1 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 transition-colors"><Wallet size={16} /></div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide text-right flex-1 ml-2 group-hover:text-purple-600 transition-colors">Gasto Neto</span>
                        </div>
                        <div className="text-lg font-bold text-slate-800 truncate" title={formatMoney(kpis.gasto_realizado_neto || 0)}>{formatMoney(kpis.gasto_realizado_neto || 0)}</div>
                        <div className="text-[9px] text-purple-400 mt-0.5">Órdenes de Pago</div>
                    </div>

                    {/* Sección Por Pagar (Mini) */}
                    <div
                        onClick={(e) => { e.stopPropagation(); handleCardClick('deuda'); }}
                        className="pt-1 border-t border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors rounded px-1 -mx-1 mt-1"
                        title="Ver detalle deuda pendiente"
                    >
                        <div className="flex items-center gap-1">
                            <AlertCircle size={10} className="text-pink-400" />
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Por Pagar:</span>
                        </div>
                        <span className="text-[10px] font-bold text-pink-500 truncate">{formatMoney(kpis.deuda_pendiente_neto || 0)}</span>
                    </div>
                </div>

                {/* UTILIDAD (Sin Click) */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden h-full flex flex-col justify-between">
                    <div className={`absolute right-0 top-0 w-1 h-full ${kpis.utilidad >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div>
                        <div className="flex justify-between items-start mb-1">
                            <div className={`p-1 rounded-lg ${kpis.utilidad >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                <TrendingUp size={16} />
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide text-right flex-1 ml-2">Utilidad Neta</span>
                        </div>
                        <div className={`text-lg font-bold ${kpis.utilidad >= 0 ? 'text-green-700' : 'text-red-700'} truncate`} title={formatMoney(kpis.utilidad)}>
                            {formatMoney(kpis.utilidad)}
                        </div>
                    </div>
                    <div className="text-[9px] font-bold text-slate-500 mt-1">
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

            {/* 3. MODAL DETALLE VENTA CUBICADA (NIVEL 1 & 2) */}
            <Modal show={showModalVenta} onHide={() => { setShowModalVenta(false); setZonaVentaSeleccionada(null); }} centered scrollable size={zonaVentaSeleccionada ? 'lg' : 'md'}>
                <Modal.Header closeButton className="bg-cyan-50 text-cyan-800 border-bottom-0">
                    <Modal.Title className="h6 fw-bold flex items-center gap-2">
                        {zonaVentaSeleccionada ? (
                            <>
                                <button onClick={() => setZonaVentaSeleccionada(null)} className="btn btn-sm btn-light rounded-circle me-2 p-1" title="Volver">
                                    <ArrowLeft size={16} />
                                </button>
                                <span>{zonaVentaSeleccionada.nombre}</span>
                            </>
                        ) : (
                            <>
                                <i className="bi bi-layers-half me-2"></i>Desglose Venta Cubicada
                            </>
                        )}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-0">
                    {!zonaVentaSeleccionada ? (
                        /* NIVEL 1: LISTA ZONAS */
                        <Table hover striped className="mb-0 small align-middle">
                            <thead className="bg-light text-secondary sticky-top">
                                <tr>
                                    <th className="ps-4 py-3">Zona / Ubicación</th>
                                    <th className="text-end pe-4 py-3">Monto Cubicado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detalleVentaData.length > 0 ? (
                                    detalleVentaData.map((item) => (
                                        <tr
                                            key={item.id}
                                            onClick={() => handleZonaVentaClick(item)}
                                            className="cursor-pointer group hover:bg-cyan-50 transition-colors"
                                            title="Clic para ver detalle de actividades"
                                        >
                                            <td className="ps-4 py-3 fw-medium text-slate-700 group-hover:text-cyan-700 transition-colors">
                                                {item.nombre}
                                                {item.id === 'GLOBAL' && <Badge bg="info" className="ms-2 text-white" style={{ fontSize: '0.65rem' }}>Global</Badge>}
                                            </td>
                                            <td className="text-end pe-4 py-3 font-monospace fw-bold text-slate-700">
                                                {formatMoney(item.total)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="2" className="text-center py-4 text-muted">Sin datos cubicados</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-light border-top">
                                <tr>
                                    <td className="text-end fw-bold text-secondary pe-3 py-3">TOTAL:</td>
                                    <td className="text-end pe-4 fw-bold text-cyan-700 font-monospace text-lg">
                                        {formatMoney(kpis.venta_cubicada)}
                                    </td>
                                </tr>
                            </tfoot>
                        </Table>
                    ) : (
                        /* NIVEL 2: DETALLE ACTIVIDADES */
                        <Table responsive hover className="mb-0 small align-middle">
                            <thead className="bg-light text-secondary sticky-top">
                                <tr>
                                    <th className="ps-4 py-2">Actividad</th>
                                    <th className="text-center py-2">Uni.</th>
                                    <th className="text-end py-2">Precio</th>
                                    <th className="text-center py-2">Cant.</th>
                                    <th className="text-end pe-4 py-2">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detalleZonaVentaData.map((act, i) => (
                                    <tr key={`${act.id}-${i}`}>
                                        <td className="ps-4 py-2 fw-medium text-slate-700 text-break">{act.nombre}</td>
                                        <td className="text-center py-2 text-muted">{act.unit}</td>
                                        <td className="text-end py-2 font-monospace text-muted">{formatMoney(act.precio)}</td>
                                        <td className="text-center py-2 font-monospace fw-bold">{Number(act.cantidad).toLocaleString('es-CL')}</td>
                                        <td className="text-end pe-4 py-2 font-monospace fw-bold text-slate-800">
                                            {formatMoney(act.total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Modal.Body>
                <Modal.Footer className="py-2 bg-light border-top-0 justify-content-between">
                    {!zonaVentaSeleccionada && <small className="text-muted">Doble clic en una fila para ver detalle.</small>}
                    <small className="text-muted ms-auto">Datos según Matriz de Cubicación</small>
                </Modal.Footer>
            </Modal>

            {/* 4. MODAL PENDIENTE DE EJECUTAR (2 NIVELES) */}
            <Modal show={showModalPendiente} onHide={() => setShowModalPendiente(false)} centered size={zonaSeleccionada ? 'lg' : 'md'} scrollable>
                <Modal.Header closeButton className="bg-orange-50 text-orange-800 border-bottom-0">
                    <Modal.Title className="h6 fw-bold flex items-center gap-2">
                        {zonaSeleccionada ? (
                            <>
                                <button onClick={() => setZonaSeleccionada(null)} className="btn btn-sm btn-light rounded-circle me-2 p-1" title="Volver">
                                    <ArrowLeft size={16} />
                                </button>
                                <span>{zonaSeleccionada.nombre}</span>
                                <Badge bg="secondary" className="ms-2">Detalle</Badge>
                            </>
                        ) : (
                            <>
                                <ClipboardList size={20} className="me-1" />
                                Saldo por Ejecutar (Por Zona)
                            </>
                        )}
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body className="p-0">
                    {!zonaSeleccionada ? (
                        /* NIVEL 1: LISTA DE ZONAS */
                        <Table hover striped className="mb-0 small align-middle">
                            <thead className="bg-light text-secondary sticky-top">
                                <tr>
                                    <th className="ps-4 py-3">Zona</th>
                                    <th className="text-end pe-4 py-3">Saldo Pendiente</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detallePendienteData.map((item) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => handleZonaClick(item)}
                                        className="cursor-pointer group hover:bg-orange-50 transition-colors"
                                        title="Click para ver detalle de actividades"
                                    >
                                        <td className="ps-4 py-3 fw-medium text-slate-700 group-hover:text-orange-700 transition-colors">
                                            {item.nombre}
                                            <div className="small text-muted fw-normal" style={{ fontSize: '0.75rem' }}>
                                                Cub: {formatMoney(item.venta)} | Prod: {formatMoney(item.prod)}
                                            </div>
                                        </td>
                                        <td className={`text-end pe-4 font-monospace fw-bold ${item.pendiente >= 0 ? 'text-slate-800' : 'text-red-500'}`}>
                                            {formatMoney(item.pendiente)}
                                            {item.pendiente < 0 && <AlertCircle size={12} className="ms-1 text-red-500 inline" />}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-light border-top">
                                <tr>
                                    <td className="text-end fw-bold text-secondary pe-3 py-3">TOTAL PENDIENTE:</td>
                                    <td className="text-end pe-4 fw-bold text-orange-700 font-monospace">
                                        {formatMoney(detallePendienteData.reduce((acc, curr) => acc + curr.pendiente, 0))}
                                    </td>
                                </tr>
                            </tfoot>
                        </Table>
                    ) : (
                        /* NIVEL 2: DETALLE ACTIVIDADES DE ZONA */
                        <Table responsive hover className="mb-0 small align-middle">
                            <thead className="bg-light text-secondary sticky-top">
                                <tr>
                                    <th className="ps-4 py-2">Actividad</th>
                                    <th className="text-center py-2">Precio</th>
                                    <th className="text-center py-2">Cant.<br />Cub.</th>
                                    <th className="text-center py-2">Cant.<br />Ejec.</th>
                                    <th className="text-center py-2 fw-bold">Cant.<br />Pend.</th>
                                    <th className="text-end pe-4 py-2 fw-bold">Items<br />$ Pendiente</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detalleZonaData.map((act) => (
                                    <tr key={act.id}>
                                        <td className="ps-4 py-2">
                                            <div className="fw-medium text-slate-700 text-break">{act.nombre}</div>
                                            <span className="badge bg-light text-secondary border">{act.unit}</span>
                                        </td>
                                        <td className="text-center py-2 font-monospace text-muted">{formatMoney(act.precio)}</td>
                                        <td className="text-center py-2 font-monospace">{Number(act.cub_cant).toLocaleString('es-CL')}</td>
                                        <td className="text-center py-2 font-monospace text-success">{Number(act.prod_cant).toLocaleString('es-CL')}</td>
                                        <td className={`text-center py-2 font-monospace fw-bold ${act.pendiente_cant >= 0 ? 'text-slate-800' : 'text-red-500'}`}>
                                            {Number(act.pendiente_cant).toLocaleString('es-CL')}
                                        </td>
                                        <td className={`text-end pe-4 py-2 font-monospace fw-bold ${act.pendiente_monto >= 0 ? 'text-slate-800' : 'text-red-500'}`}>
                                            {formatMoney(act.pendiente_monto)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
}
