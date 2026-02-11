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

            // 1. Carga paralela de datos
            const [todasLasTareas, estadoFinanciero, gastosRaw, cubicaciones, zonas] = await Promise.all([
                tareasService.getTareas(projectId),
                reportesService.getEstadoFinancieroProyecto(projectId),
                reportesService.getGastosRaw(projectId),
                cubicacionService.getCubicaciones(projectId),
                cubicacionService.getZonas(projectId)
            ]);

            // 2. Procesar Tareas y Subcontratistas
            const proveedoresMap = {};
            const subcontratistasIds = new Set();
            let totalCostoMO_Global = 0;
            let totalCostoMO_Pendiente = 0; // Sin EP o Borrador
            let totalVenta = 0;
            let totalVentaCubicada = 0; // <--- NUEVO (Cubicado / Presupuestado)

            // CALCULAR VENTA CUBICADA REAL (Desde Matriz) y DESGLOSAR POR ZONA
            const mapaVentaPorZona = {}; // ZonaID -> Total
            if (cubicaciones && cubicaciones.length > 0) {
                cubicaciones.forEach(c => {
                    const cant = Number(c.cantidad) || 0;
                    const precio = Number(c.actividad?.valor_venta || c.sub_actividad?.valor_venta || 0);
                    const totalLinea = cant * precio;

                    totalVentaCubicada += totalLinea;

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

                // YA NO CALCULAMOS VENTA CUBICADA DESDE TAREAS
                // const itemsTodo = (tarea.items && tarea.items.length > 0) ? tarea.items : [tarea];
                // itemsTodo.forEach(item => { ... });

                if (tarea.proveedor?.id) {
                    subcontratistasIds.add(tarea.proveedor.id);
                }

                // Cálculo de Costos de Mano de Obra
                if (tarea.cantidad_real > 0 || (tarea.items && tarea.items.some(i => i.cantidad_real > 0))) {
                    const itemsProcesar = (tarea.items && tarea.items.length > 0) ? tarea.items : [tarea];

                    itemsProcesar.forEach(item => {
                        const cantReal = Number(item.cantidad_real) || 0;
                        if (cantReal > 0) {
                            const costo = cantReal * (Number(item.precio_costo_unitario) || 0);
                            const venta = cantReal * (Number(item.precio_venta_unitario) || 0);

                            // Acumular Globales
                            totalCostoMO_Global += costo;
                            totalVenta += venta;

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

            // 3. Procesar Gastos (Separar Subcontratos vs Otros)
            let gastosNoSubcontratos = 0;
            const desgloseItems = {};

            gastosRaw.forEach(g => {
                const monto = Number(g.neto_total_recibido) || 0;

                // Si el proveedor NO es un subcontratista, suma a gastos operativos externos
                if (!subcontratistasIds.has(g.proveedor)) {
                    gastosNoSubcontratos += monto;
                }

                // Agrupar por ítem para el gráfico (Todos los gastos)
                const itemNombre = g.item ? g.item.trim() : 'Sin Categoría';
                desgloseItems[itemNombre] = (desgloseItems[itemNombre] || 0) + monto;
            });

            // 4. Calcular Totales Finales
            const gastoRealNeto = estadoFinanciero.total_gasto_neto || 0;

            // UTILIDAD: Ingresos - Mano de Obra Total - Gastos (Excluyendo Subcontratos ya contados arriba)
            const utilidad = totalVenta - totalCostoMO_Global - gastosNoSubcontratos;
            const margen = totalVenta > 0 ? (utilidad / totalVenta) * 100 : 0;

            setKpis({
                ingresos: totalVenta,
                costos_mo: totalCostoMO_Pendiente, // MOSTRAR PENDIENTE
                costos_mo_total: totalCostoMO_Global, // MOSTRAR TOTAL EN SUBTITULO
                utilidad,
                margen,
                gasto_realizado_neto: gastoRealNeto,
                deuda_pendiente_neto: estadoFinanciero.saldo_pendiente_neto,
                venta_cubicada: totalVentaCubicada
            });

            // 5. Preparar Datos Gráfico Barras
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
            // 6. Preparar Datos Gráfico Barras (Distribución Gasto) - HORIZONTAL
            // CAMBIO: Se elimina "MANO DE OBRA" porque ya está incluido en "ESTADO DE PAGO"
            const distribucionTemp = [];

            Object.entries(desgloseItems).forEach(([item, valor]) => {
                if (valor > 0) {
                    distribucionTemp.push({ name: item.toUpperCase(), value: valor });
                }
            });

            // Ordenar de mayor a menor y guardar
            distribucionTemp.sort((a, b) => b.value - a.value);
            setPieData(distribucionTemp); // Reutilizamos variable pieData aunque ahora es barras

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
        let headers = []; // Nuevo

        try {
            if (type === 'ingresos') {
                title = 'Resumen Ingresos (Por Actividad)';
                const tareas = await tareasService.getTareas(projectId);

                // Agrupar por Actividad (Nombre)
                const agrupado = {};

                tareas.forEach(tarea => {
                    const items = (tarea.items && tarea.items.length > 0) ? tarea.items : [tarea];
                    items.forEach(item => {
                        const cant = Number(item.cantidad_real) || 0;
                        if (cant > 0) {
                            // Prioridad: Actividad vinculada > Sub-actividad > Nombre manual > Nombre tarea parent
                            const nombre = item.actividad?.nombre || item.sub_actividad?.nombre || item.nombre || tarea.nombre || 'Sin Nombre';
                            const precio = Number(item.precio_venta_unitario) || 0;

                            if (!agrupado[nombre]) {
                                agrupado[nombre] = {
                                    nombre,
                                    precio,
                                    cantidad_total: 0,
                                    venta_total: 0
                                };
                            }
                            // Acumulamos
                            agrupado[nombre].cantidad_total += cant;
                            agrupado[nombre].venta_total += (cant * precio);
                        }
                    });
                });

                // Convertir a Array para la tabla
                data = Object.values(agrupado).map((a, index) => ({
                    id: index,
                    col1: a.nombre,                      // Actividad
                    col2: formatMoney(a.precio),         // Precio Venta
                    col3: Number(a.cantidad_total).toLocaleString('es-CL'), // Cant. Realizada
                    monto: a.venta_total,                // Total Venta (Monto)
                    status: 'Ejecutado'
                }));

                headers = ['Actividad', 'Precio Unitario', 'Cant. Real', 'Total Venta', 'Estado'];

            } else if (type === 'gastos_op') {
                title = 'Detalle Gastos Operativos (Materiales e Insumos)';
                // Reutilizamos el endpoint de desglose que ya existe o se adapta
                // En este caso, usaremos getGastosOperativos si retorna detalle o un nuevo endpoint
                // Por ahora, asumiremos que reportesService.getDesgloseGastos sirve
                const desglose = await reportesService.getDesgloseGastos(projectId);
                data = desglose.map(d => ({
                    id: d.id || Math.random(),
                    col1: d.item,
                    col2: d.proveedor || '-',
                    col3: d.fecha || '-',
                    monto: d.total_gasto
                }));
            } else if (type === 'neto' || type === 'deuda') {
                const detalles = await reportesService.getDetalleFinancieroProyecto(projectId);

                if (type === 'neto') {
                    title = 'Detalle Gasto Realizado (Neto)';
                    data = detalles.gastos_netos.map(d => ({
                        id: d.id,
                        col1: `OP #${d.orden_numero} - ${d.proveedor}`,
                        col2: d.detalle,
                        col3: d.fecha,
                        monto: d.monto_neto,
                        status: d.estado
                    }));
                } else {
                    title = 'Detalle Deuda Pendiente (Neto)';
                    data = detalles.deuda_neta.map(d => ({
                        id: d.id,
                        col1: `OP #${d.orden_numero} - ${d.proveedor}`,
                        col2: `Saldo Bruto: ${formatMoney(d.saldo_bruto)}`,
                        col3: d.fecha,
                        monto: d.deuda_neta,
                        status: 'Pendiente'
                    }));
                }
            }

            setModalConfig({
                isOpen: true,
                title,
                data,
                type,
                headers // Nuevo
            });

        } catch (error) {
            console.error("Error al cargar detalle:", error);
        }
    };

    const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

    // Componente Modal Interno
    const DetailModal = () => {
        if (!modalConfig.isOpen) return null;

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

                    {/* Body */}
                    <div className="p-0 overflow-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                                <tr>
                                    {tableHeaders.map((h, i) => (
                                        <th key={i} className={`px-6 py-3 ${i === 3 ? 'text-right' : i === 4 ? 'text-center' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {modalConfig.data.length > 0 ? (
                                    modalConfig.data.map((row, idx) => (
                                        <tr key={row.id || idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-slate-700">{row.col1}</td>
                                            <td className="px-6 py-3 text-slate-500 truncate max-w-[200px]" title={row.col2}>{row.col2}</td>
                                            <td className="px-6 py-3 text-slate-500">{row.col3}</td>
                                            <td className="px-6 py-3 text-right font-mono font-medium text-slate-700">
                                                {formatMoney(row.monto)}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase 
                                                    ${row.status === 'Pagado' || row.status === 'Ejecutado' ? 'bg-green-100 text-green-600' :
                                                        row.status === 'Pendiente' ? 'bg-red-100 text-red-600' :
                                                            'bg-orange-100 text-orange-600'}`}>
                                                    {row.status || '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-slate-400 italic">
                                            No hay registros para mostrar
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-medium">
                            {modalConfig.data.length} registros encontrados
                        </span>
                        <div className="text-sm font-bold text-slate-700">
                            Total: {formatMoney(modalConfig.data.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0))}
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
